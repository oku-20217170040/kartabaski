'use server';

import { revalidateTag } from 'next/cache';
import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { getPhotoroomSettings, savePhotoroomSettings, getPhotoroomKeyStatus } from './photoroom';
import {
  generateDraft,
  approveDrafts,
  rejectDrafts,
  revertPhoto,
  purgeOriginals,
  listDrafts,
  sweepStaleGenerating,
} from './studio';
import { computeStats, toStudioProduct } from './studio-utils';
import type {
  ApproveResult,
  PhotoroomSettings,
  StudioDraft,
  StudioGenOptions,
  StudioOverviewData,
} from './studio-types';

const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** AI Stüdyo sayfası için ürünler, taslaklar/geçmiş, ayarlar, maliyet ve uyarılar. */
export async function getStudioDataAction(): Promise<StudioOverviewData> {
  await requireAdmin();
  const warnings: string[] = [];

  let products: StudioOverviewData['products'] = [];
  try {
    products = (await getProductsServer()).map(toStudioProduct);
  } catch (e) {
    warnings.push(`Ürünler okunamadı: ${msg(e, 'bilinmeyen hata')}`);
  }

  await sweepStaleGenerating().catch((e) => warnings.push(`Takılı işler temizlenemedi: ${msg(e, '')}`));

  let drafts: StudioDraft[] = [];
  try {
    drafts = await listDrafts();
  } catch (e) {
    warnings.push(`Taslaklar/geçmiş okunamadı: ${msg(e, 'bilinmeyen hata')}. Firestore izinlerini veya indeksi kontrol edin.`);
  }

  const settings = await getPhotoroomSettings();
  const keys = getPhotoroomKeyStatus();
  if (!keys.live && !keys.sandbox) {
    warnings.push('Photoroom bağlı değil: sunucu ortam değişkenlerine PHOTOROOM_LIVE_API_KEY (ve test için PHOTOROOM_SANDBOX_API_KEY) ekleyin.');
  } else if (settings.activeEnvironment === 'live' && !keys.live) {
    warnings.push('Aktif ortam "live" seçili ancak PHOTOROOM_LIVE_API_KEY tanımlı değil.');
  } else if (settings.activeEnvironment === 'sandbox' && !keys.sandbox) {
    warnings.push('Aktif ortam "sandbox" seçili ancak PHOTOROOM_SANDBOX_API_KEY tanımlı değil.');
  }

  return { products, drafts, settings, keys, stats: computeStats(drafts), warnings };
}

export async function saveStudioSettingsAction(data: Partial<PhotoroomSettings>): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await savePhotoroomSettings(data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'Ayarlar kaydedilemedi.') };
  }
}

/** Tek fotoğraf için taslak üretir (toplu üretimde istemci bunu sırayla çağırır → zaman aşımı olmaz). */
export async function generateDraftAction(
  productId: string,
  originalPublicId: string,
  options?: StudioGenOptions
): Promise<{ ok: boolean; draft?: StudioDraft; error?: string }> {
  await requireAdmin();
  try {
    const draft = await generateDraft(productId, originalPublicId, options);
    return { ok: true, draft };
  } catch (e) {
    return { ok: false, error: msg(e, 'Görsel üretilemedi.') };
  }
}

export async function approveDraftsAction(ids: string[], deleteOriginals = false): Promise<{ ok: boolean; results: ApproveResult[] }> {
  await requireAdmin();
  const results = await approveDrafts(ids.slice(0, 200), { deleteOriginals });
  revalidateTag('products');
  return { ok: results.every((r) => r.ok), results };
}

export async function rejectDraftsAction(ids: string[]): Promise<{ ok: boolean; results: ApproveResult[] }> {
  await requireAdmin();
  const results = await rejectDrafts(ids.slice(0, 200));
  return { ok: results.every((r) => r.ok), results };
}

export async function revertPhotoAction(productId: string, publicId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await revertPhoto(productId, publicId);
    revalidateTag('products');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'Geri alınamadı.') };
  }
}

/** Onaylı fotoğrafların orijinallerini Cloudinary'den kalıcı siler (geri dönüş biter). */
export async function purgeOriginalsAction(productIds?: string[]): Promise<{ ok: boolean; purged?: number; error?: string }> {
  await requireAdmin();
  try {
    const { purged } = await purgeOriginals(productIds);
    revalidateTag('products');
    return { ok: true, purged };
  } catch (e) {
    return { ok: false, error: msg(e, 'Orijinaller silinemedi.') };
  }
}
