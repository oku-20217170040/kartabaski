// AI Stüdyo saf yardımcıları (sunucu/istemci güvenli, testli). Firestore'a dokunmaz.
import type { Product } from '@/types';
import type { StudioColor, StudioDraft, StudioPhoto, StudioProduct, StudioStats } from './studio-types';

export const isRemoteId = (id: string) => /^https?:\/\//i.test(id);

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Ham Firestore değerinden StudioPhoto[] okur (bozuk kayıtlar elenir). */
export function readStudioPhotos(raw: unknown): StudioPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: StudioPhoto[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    if (!isStr(r.publicId) || !isStr(r.originalId)) continue;
    out.push({
      publicId: r.publicId,
      originalId: r.originalId,
      approvedAt: typeof r.approvedAt === 'number' ? r.approvedAt : 0,
      ...(r.originalPurged === true ? { originalPurged: true } : {}),
    });
  }
  return out;
}

/** Ham değerden renk varyantlarını (ad + görseller) okur. */
export function readColors(raw: unknown): StudioColor[] {
  if (!Array.isArray(raw)) return [];
  const out: StudioColor[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const images = Array.isArray(r.images) ? r.images.filter(isStr) : [];
    out.push({ name: typeof r.name === 'string' ? r.name : '', images });
  }
  return out;
}

/** Ürünün tüm gerçek (Cloudinary) görselleri: kapak + renk varyantları, tekrarsız, sıra korunur. */
export function collectProductImages(images: string[], colors: StudioColor[]): string[] {
  const seen = new Set<string>();
  for (const id of [...images, ...colors.flatMap((c) => c.images)]) {
    if (id && !isRemoteId(id)) seen.add(id);
  }
  return Array.from(seen);
}

/** Ürünün TÜM gerçek fotoğrafları (kapak + renkler) stüdyo onaylıysa true. */
export function computeStudioEnhanced(images: string[], colors: StudioColor[], photos: StudioPhoto[]): boolean {
  const real = collectProductImages(images, colors);
  if (!real.length) return false;
  const done = new Set(photos.map((p) => p.publicId));
  return real.every((i) => done.has(i));
}

/** Kapak ve renk görsellerinde `from` kimliğini `to` ile değiştirir. */
export function replaceImageId(
  images: string[],
  colors: StudioColor[],
  from: string,
  to: string
): { images: string[]; colors: StudioColor[]; changed: boolean } {
  let changed = false;
  const swap = (arr: string[]) =>
    arr.map((i) => {
      if (i !== from) return i;
      changed = true;
      return to;
    });
  const nextImages = swap(images);
  const nextColors = colors.map((c) => ({ ...c, images: swap(c.images) }));
  return { images: nextImages, colors: nextColors, changed };
}

/** Firestore ürün verisinden arayüz görünümü üretir. */
export function toStudioProduct(p: Product): StudioProduct {
  const raw = p as unknown as Record<string, unknown>;
  const images = Array.isArray(p.images) ? p.images.filter(isStr) : [];
  const colors = readColors(raw.colors);
  const studioPhotos = readStudioPhotos(raw.studioPhotos);
  return {
    id: p.id,
    title: p.title,
    active: p.active !== false,
    images,
    colors,
    studioPhotos,
    studioEnhanced: computeStudioEnhanced(images, colors, studioPhotos),
  };
}

export function computeStats(drafts: StudioDraft[], now = Date.now()): StudioStats {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const counted = drafts.filter((x) => x.status !== 'failed' && x.status !== 'generating');
  const month = counted.filter((x) => x.createdAt >= monthStart);
  return {
    generatedThisMonth: month.length,
    costThisMonthUSD: month.reduce((s, x) => s + (x.costUSD || 0), 0),
    costTotalUSD: counted.reduce((s, x) => s + (x.costUSD || 0), 0),
    generatedTotal: counted.length,
    failedTotal: drafts.filter((x) => x.status === 'failed').length,
  };
}
