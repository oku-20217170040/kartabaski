'use server';

import { revalidateTag } from 'next/cache';
import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { updateProduct } from './products-admin';
import type { SocialPlatform } from './social-types';
import { parsePriceLines, priceSourceKey } from './paylasim/fiyat';
import { clearPending, clearTarget, getAyar, getGorsel, getItem, listItems, patchItem, saveAyar } from './paylasim/depo';
import { productImages, groupKey } from './paylasim/sira';
import { uzunMetin } from './paylasim/metin';
import { slotTimes } from './paylasim/zaman';
import { hemenYayinla, runPaylasimStep, urunSatiri } from './paylasim/tur';
import { MAX_KADEME, type Ayar, type Kademe } from './paylasim/types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Canlıda sunucu hatalarının metni gizlendiği için yöneticiye gösterilecek mesaj sonuçla döner. */
export type Sonuc = { error?: string };

async function dene(job: () => Promise<unknown>): Promise<Sonuc> {
  await requireAdmin();
  try {
    const out = (await job()) as { errors?: string[] } | undefined;
    return out?.errors?.length ? { error: out.errors.join(' · ').slice(0, 300) } : {};
  } catch (e) {
    console.error('[actions-paylasim]', e);
    return { error: e instanceof Error ? e.message : 'İşlem yapılamadı' };
  }
}

export async function getPaylasimPanelAction() {
  await requireAdmin();
  const now = Date.now();
  const [ayar, gorsel, items, products] = await Promise.all([getAyar(true), getGorsel(), listItems(now), getProductsServer()]);
  const urunler = products.filter((p) => p.active !== false).map((p) => {
    const u = urunSatiri(p);
    return {
      id: u.id,
      title: u.title,
      approved: u.tiers.length > 0,
      tiers: u.tiers.length ? u.tiers : p.priceTiers?.length ? p.priceTiers : parsePriceLines(p.description),
      suggestion: parsePriceLines(p.description),
      images: productImages(u),
      groups: [{ key: groupKey(u.id, ''), name: 'Karışık', images: productImages(u) },
        ...u.colors.filter((c) => c.images.length).map((c) => ({ key: groupKey(u.id, c.name), name: c.name, images: c.images }))],
    };
  });
  const captions: Record<string, string> = {};
  for (const i of items) {
    const p = products.find((x) => x.id === i.productId);
    if (p && i.kind === 'karusel') captions[i.key] = i.caption || uzunMetin(urunSatiri(p), i.color);
  }
  return { ayar, white: gorsel.white, items, urunler, captions };
}

export type PanelData = Awaited<ReturnType<typeof getPaylasimPanelAction>>;

export async function saveAyarAction(patch: Partial<Ayar>): Promise<Sonuc> {
  return dene(async () => {
    const clean: Partial<Ayar> = {};
    if (patch.mode === 'onizleme' || patch.mode === 'canli') clean.mode = patch.mode;
    if (typeof patch.paused === 'boolean') clean.paused = patch.paused;
    if (patch.platforms) clean.platforms = patch.platforms;
    if (patch.kinds) clean.kinds = patch.kinds;
    for (const k of ['carouselTimes', 'storyTimes'] as const) {
      const v = patch[k];
      if (v) {
        const list = Array.from(new Set(v.filter((t) => TIME.test(t)))).sort();
        if (!list.length || list.length > 6) throw new Error('1 ile 6 arasında saat girin (ör. 11:00).');
        clean[k] = list;
      }
    }
    await saveAyar(clean);
    await runPaylasimStepIfPreview();
  });
}

/** Ayar ya da onay sonrası sıranın hemen görünmesi için: yalnız önizlemede tur çalıştırılır (yayın yapmaz). */
async function runPaylasimStepIfPreview() {
  if ((await getAyar(true)).mode === 'onizleme') await runPaylasimStep();
}

/**
 * Önizlemede sırayı baştan kurar: yeni onaylanan ürünler dolu saatlerin arkasında beklemez.
 * Elle yapılan sıra değişiklikleri silinir; canlıda ve durdurulmuşken dokunulmaz.
 */
async function sirayiYenidenKur(): Promise<boolean> {
  const ayar = await getAyar(true);
  if (ayar.mode !== 'onizleme' || ayar.paused) return false;
  await clearPending();
  await runPaylasimStep();
  return true;
}

export async function yenileAction(): Promise<Sonuc> {
  return dene(async () => {
    if (!(await sirayiYenidenKur())) throw new Error('Sıra yalnız önizleme modunda yeniden kurulur.');
  });
}

export async function ertleAction(key: string): Promise<Sonuc> {
  return dene(async () => {
    const now = Date.now();
    const [ayar, items, item] = await Promise.all([getAyar(), listItems(now), getItem(key)]);
    if (!item || item.status !== 'bekliyor') throw new Error('Yalnız bekleyen paylaşım ertelenir.');
    if (item.kind !== 'karusel') throw new Error('Hikâye ertelenmez; iptal edebilirsiniz.');
    const taken = new Set(items.filter((i) => i.kind === 'karusel' && i.status === 'bekliyor').map((i) => i.at));
    const at = slotTimes(ayar.carouselTimes, Math.max(now, item.at), 30).find((t) => t > item.at && !taken.has(t));
    if (!at) throw new Error('Boş saat bulunamadı.');
    await patchItem(key, { at });
  });
}

export async function iptalAction(key: string): Promise<Sonuc> {
  return dene(async () => {
    await patchItem(key, { status: 'iptal' });
    await runPaylasimStepIfPreview();
  });
}

export async function metinAction(key: string, caption: string): Promise<Sonuc> {
  return dene(() => patchItem(key, { caption: caption.trim().slice(0, 2200) }));
}

export async function gorsellerAction(key: string, imageIds: string[]): Promise<Sonuc> {
  return dene(async () => {
    const item = await getItem(key);
    if (!item || item.status !== 'bekliyor') throw new Error('Yalnız bekleyen paylaşım düzenlenir.');
    const p = (await getProductsServer()).find((x) => x.id === item.productId);
    const allowed = new Set(p ? productImages(urunSatiri(p)) : []);
    const ids = imageIds.filter((id) => allowed.has(id)).slice(0, item.kind === 'hikaye' ? 1 : 10);
    if (!ids.length) throw new Error('En az bir görsel seçin.');
    await patchItem(key, { imageIds: ids });
  });
}

export async function hemenAction(key: string): Promise<Sonuc> {
  return dene(() => hemenYayinla(key));
}

export async function tekrarAction(key: string, platform: SocialPlatform): Promise<Sonuc> {
  return dene(async () => {
    await clearTarget(key, platform);
    return hemenYayinla(key);
  });
}

export async function kademeOnayAction(productId: string, tiers: Kademe[]): Promise<Sonuc> {
  return dene(async () => {
    const p = (await getProductsServer()).find((x) => x.id === productId);
    if (!p) throw new Error('Ürün bulunamadı.');
    const clean = tiers.map((t) => ({ label: t.label.trim(), price: t.price.trim() })).filter((t) => t.label && t.price).slice(0, MAX_KADEME);
    if (!clean.length) throw new Error('En az bir fiyat satırı girin.');
    await updateProduct(productId, { slug: p.slug, priceTiers: clean, priceTiersSource: priceSourceKey(p.description) });
    revalidateTag('products');
    await sirayiYenidenKur();
  });
}

export async function kapakAction(key: string, imageId: string): Promise<Sonuc> {
  return dene(async () => {
    const ayar = await getAyar(true);
    await saveAyar({ covers: { ...ayar.covers, [key]: imageId } });
  });
}
