import 'server-only';
import { getProductsServer } from '../products-server';
import { toSocialRow } from '../social-content-utils';
import { notifyAdmin } from '../notify';
import { SITE_URL } from '../site';
import type { Product } from '@/types';
import { approvedTiers } from './fiyat';
import { isPlain, whiteProbeUrl } from './kapak';
import { planla } from './plan';
import { carouselCandidates, productImages, type Beyaz } from './sira';
import { applyPlan, claimTarget, finishTarget, getAyar, getGorsel, getItem, listItems, markUsed, saveWhite, setTukendi } from './depo';
import { yayinla } from './yayin';
import { isDue } from './zaman';
import { MAX_DENEME, PLATFORMLAR, type Ayar, type Paylasim, type PaylasimUrun } from './types';

const PROBE_PER_RUN = 60;
const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

/** Ürünü paylaşım satırına çevirir; `tiers` onaysızsa boş kalır. */
export function urunSatiri(p: Product): PaylasimUrun {
  const r = toSocialRow(p);
  const colors = (p.colors ?? []).map((c) => ({ name: c.name, images: (c.images ?? []).filter((i) => i && !i.startsWith('http')) }));
  return {
    id: r.id, title: r.title, slug: r.slug || r.id, category: r.category, shortDesc: r.shortDesc,
    deliveryDays: r.deliveryDays, createdAt: r.createdAt, images: r.imageIds, colors, tiers: approvedTiers(p) ?? [],
  };
}

export async function urunleriOku(): Promise<PaylasimUrun[]> {
  return (await getProductsServer())
    .filter((p) => p.active !== false)
    .map(urunSatiri)
    .filter((u) => u.tiers.length && productImages(u).length);
}

async function olcBeyaz(products: PaylasimUrun[], white: Beyaz): Promise<Beyaz> {
  const missing = products.flatMap(productImages).filter((id) => !(id in white)).slice(0, PROBE_PER_RUN);
  const found: Beyaz = {};
  for (const id of missing) {
    try {
      const res = await fetch(whiteProbeUrl(cloud(), id), { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (res.ok) found[id] = isPlain(new Uint8Array(await res.arrayBuffer()));
    } catch (e) {
      console.warn('[paylasim] kapak ölçümü', id, e);
    }
  }
  if (Object.keys(found).length) await saveWhite(found);
  return { ...white, ...found };
}

async function gonder(item: Paylasim, u: PaylasimUrun, ayar: Ayar, now: number, posted: string[], errors: string[]) {
  const platforms = PLATFORMLAR[item.kind].filter((p) => ayar.platforms[p]);
  for (const platform of platforms) {
    if (!(await claimTarget(item.key, platform, now))) continue;
    try {
      const out = await yayinla(platform, item, u);
      if ('atlandi' in out) {
        await finishTarget(item.key, platform, { status: 'atlandi', error: out.atlandi }, platforms);
      } else {
        await finishTarget(item.key, platform, { status: 'tamam', remoteId: out.remoteId }, platforms);
        posted.push(`${item.key}@${platform}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'bilinmeyen hata';
      const t = await finishTarget(item.key, platform, { status: 'hata', error }, platforms);
      errors.push(`${u.title.slice(0, 24)} ${platform}: ${error.slice(0, 120)}`);
      if (t && t.attempts >= MAX_DENEME) await notifyAdmin('Paylaşım başarısız', `${u.title} (${platform}): ${error}\n${SITE_URL}/admin/paylasim`);
    }
  }
}

export async function runPaylasimStep(now = Date.now()) {
  const posted: string[] = [];
  const errors: string[] = [];
  const ayar = await getAyar(true);
  if (ayar.paused) return { skipped: 'durduruldu', posted, errors, planned: 0 };

  const [products, gorsel] = await Promise.all([urunleriOku(), getGorsel()]);
  // Ürün okunamazsa (boş liste) bekleyenler silinmesin
  if (!products.length) return { skipped: 'fiyatı onaylı ürün yok', posted, errors, planned: 0 };
  const white = await olcBeyaz(products, gorsel.white);
  const plan = planla({ products, items: await listItems(now), ayar, imageUsedAt: gorsel.usedAt, white, now });
  await applyPlan(plan);

  const items = await listItems(now);
  const left = items.some((i) => i.kind === 'karusel' && i.status === 'bekliyor')
    || carouselCandidates(products, new Set(items.map((i) => i.key))).length > 0;
  if (!left && !gorsel.tukendiBildirildi) {
    await notifyAdmin('Karusel sırası bitti', `Fiyatı onaylı ürünlerin tüm karuselleri paylaşıldı.\n${SITE_URL}/admin/paylasim`);
    await setTukendi(true);
  } else if (left && gorsel.tukendiBildirildi) await setTukendi(false);

  if (ayar.mode !== 'canli') return { skipped: 'önizleme modu', posted, errors, planned: plan.create.length };

  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of items.filter((i) => i.status === 'bekliyor' && ayar.kinds[i.kind] && isDue(i.at, now)).slice(0, 2)) {
    const u = byId.get(item.productId);
    if (!u) continue;
    await gonder(item, u, ayar, now, posted, errors);
    await markUsed(item.imageIds, now);
  }
  return { posted, errors, planned: plan.create.length };
}

/** Panelden "Hemen paylaş": mod ve saat beklemez. */
export async function hemenYayinla(key: string) {
  const posted: string[] = [];
  const errors: string[] = [];
  const [item, ayar, products] = await Promise.all([getItem(key), getAyar(true), urunleriOku()]);
  if (!item || item.status === 'iptal') throw new Error('Paylaşım bulunamadı');
  const u = products.find((p) => p.id === item.productId);
  if (!u) throw new Error('Ürün paylaşıma uygun değil (pasif ya da fiyat onaysız)');
  await gonder(item, u, ayar, Date.now(), posted, errors);
  return { posted, errors };
}
