import 'server-only';
import crypto from 'crypto';
import { adminDb } from './firebase-admin';
import { rateLimit } from './rate-limit';
import { uploadToCloudinary, deleteCloudinaryImages } from './cloudinary-admin';
import { getPhotoroomSettings, transformImageWithPhotoroom, type PhotoroomMode, type PhotoroomEnv } from './photoroom';
import {
  collectProductImages,
  computeStudioEnhanced,
  isRemoteId,
  readColors,
  readStudioPhotos,
  replaceImageId,
} from './studio-utils';
import type { ApproveResult, StudioDraft, StudioGenOptions, StudioPhoto } from './studio-types';

/**
 * AI Stüdyo çekirdeği (Photoroom).
 *
 * Akış (fotoğraf düzeyinde):
 *   üret → taslak (orijinal + yeni YAN YANA Cloudinary'de durur, site değişmez)
 *   → onay (site yeni görseli gösterir, orijinal saklanır) / red (taslak silinir)
 *   → istenirse geri al (orijinale dön) veya orijinalleri toplu temizle.
 *
 * Kapak görselleri (images) ve renk varyantı görselleri (colors[].images) birlikte desteklenir.
 * `studio_drafts` koleksiyonu aynı zamanda üretim geçmişi + maliyet defteridir:
 * her üretim ayrı belge olarak kalır (başarısız olanlar `failed` + hata mesajıyla).
 */

const COL = 'studio_drafts';
export const STUDIO_FOLDER = 'karta-baski/studio';
const GENERATING_STALE_MS = 2 * 60 * 1000;

const cloudName = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const cldUrl = (publicId: string) => `https://res.cloudinary.com/${cloudName()}/image/upload/f_jpg,q_auto/${publicId}`;

function toDraft(id: string, d: FirebaseFirestore.DocumentData): StudioDraft {
  return { ...(d as Omit<StudioDraft, 'id'>), id };
}

async function patchDraft(id: string, data: Record<string, unknown>) {
  await adminDb.collection(COL).doc(id).set(data, { merge: true });
}

/** Aynı orijinal için eski bekleyen taslağı iptal eder ve Cloudinary'deki görselini siler. */
async function supersedePending(productId: string, originalPublicId: string, exceptId: string) {
  const snap = await adminDb
    .collection(COL)
    .where('productId', '==', productId)
    .where('originalPublicId', '==', originalPublicId)
    .get();
  const toDelete: string[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (d.id !== exceptId && data.status === 'pending') {
      if (data.draftPublicId) toDelete.push(data.draftPublicId);
      await d.ref.set({ status: 'rejected', rejectedAt: Date.now(), error: 'Yenisi üretildiği için iptal edildi' }, { merge: true });
    }
  }
  if (toDelete.length) await deleteCloudinaryImages(toDelete).catch(() => {});
}

async function loadProduct(productId: string) {
  const ref = adminDb.collection('products').doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Ürün bulunamadı.');
  const data = snap.data() as Record<string, unknown>;
  return {
    ref,
    title: typeof data.title === 'string' ? data.title : productId,
    images: Array.isArray(data.images) ? (data.images as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    colors: readColors(data.colors),
    photos: readStudioPhotos(data.studioPhotos),
    hasColors: Array.isArray(data.colors),
  };
}

/**
 * Tek bir fotoğraf için Photoroom taslağı üretir. Siteye DOKUNMAZ.
 * Çift tıklama / eşzamanlı istek koruması: 'generating' kaydı + rate limit.
 */
export async function generateDraft(
  productId: string,
  originalPublicId: string,
  options: StudioGenOptions = {}
): Promise<StudioDraft> {
  if (!rateLimit('studio-generate', 40, 60_000)) {
    throw new Error('Çok hızlı istek gönderdiniz (dakikada en fazla 40 görsel). Birkaç saniye bekleyin.');
  }

  const prod = await loadProduct(productId);
  const all = collectProductImages(prod.images, prod.colors);
  if (!all.includes(originalPublicId)) throw new Error('Bu fotoğraf artık üründe değil. Sayfayı yenileyin.');
  if (isRemoteId(originalPublicId)) throw new Error('Yalnızca Cloudinary fotoğrafları dönüştürülebilir.');
  if (prod.photos.some((p) => p.publicId === originalPublicId)) {
    throw new Error('Bu fotoğraf zaten stüdyo onaylı. Yeniden üretmek için önce "Orijinale dön" yapın.');
  }

  // Çift tıklama koruması: son 2 dk içinde aynı fotoğraf için çalışan iş var mı?
  const running = await adminDb
    .collection(COL)
    .where('productId', '==', productId)
    .where('originalPublicId', '==', originalPublicId)
    .get();
  const now = Date.now();
  if (running.docs.some((d) => d.data().status === 'generating' && now - (d.data().createdAt || 0) < GENERATING_STALE_MS)) {
    throw new Error('Bu fotoğraf için üretim zaten sürüyor.');
  }

  const settings = await getPhotoroomSettings();
  const environment: PhotoroomEnv = options.environment || settings.activeEnvironment;
  const mode: PhotoroomMode = options.mode || settings.defaultMode;
  const prompt = options.prompt || settings.defaultPrompt;
  const blurRadius = options.blurRadius ?? settings.defaultBlur;

  const id = crypto.randomUUID();
  const base: StudioDraft = {
    id,
    productId,
    productTitle: prod.title,
    originalPublicId,
    mode,
    prompt,
    ...(options.sceneId ? { sceneId: options.sceneId } : {}),
    blurRadius,
    environment,
    status: 'generating',
    costUSD: 0,
    createdAt: now,
  };
  await adminDb.collection(COL).doc(id).set(base);

  try {
    const { dataUri } = await transformImageWithPhotoroom(cldUrl(originalPublicId), { mode, prompt, blurRadius, environment });
    // Firestore 1 MB sınırı yüzünden sonucu hemen Cloudinary'ye taslak olarak koyuyoruz.
    const draftPublicId = await uploadToCloudinary(dataUri, STUDIO_FOLDER);
    await supersedePending(productId, originalPublicId, id).catch(() => {});

    const done: Partial<StudioDraft> = {
      status: 'pending',
      draftPublicId,
      costUSD: environment === 'live' ? settings.costPerImageUSD : 0,
    };
    await patchDraft(id, done);
    return { ...base, ...done } as StudioDraft;
  } catch (e) {
    const error = (e instanceof Error ? e.message : 'Görsel üretilemedi').slice(0, 400);
    await patchDraft(id, { status: 'failed', error }).catch(() => {});
    throw new Error(error);
  }
}

/** Taslakları onaylar. Orijinaller varsayılan olarak SAKLANIR (geri dönüş için). */
export async function approveDrafts(ids: string[], opts: { deleteOriginals?: boolean } = {}): Promise<ApproveResult[]> {
  const results: ApproveResult[] = [];
  const toPurge: string[] = [];

  for (const id of ids) {
    try {
      const dSnap = await adminDb.collection(COL).doc(id).get();
      if (!dSnap.exists) throw new Error('Taslak bulunamadı.');
      const draft = toDraft(id, dSnap.data()!);
      if (draft.status !== 'pending') throw new Error('Taslak onaya uygun değil (durum: ' + draft.status + ').');
      if (draft.environment === 'sandbox') {
        throw new Error('Sandbox (filigranlı) taslak yayınlanamaz. Canlı modda yeniden üretin.');
      }
      if (!draft.draftPublicId) throw new Error('Taslak görseli yok.');

      const prod = await loadProduct(draft.productId);
      const swapped = replaceImageId(prod.images, prod.colors, draft.originalPublicId, draft.draftPublicId);
      if (!swapped.changed) throw new Error('Orijinal fotoğraf üründen kaldırılmış; taslak uygulanamaz.');

      const purge = !!opts.deleteOriginals;
      const photos: StudioPhoto[] = [
        ...prod.photos,
        { publicId: draft.draftPublicId, originalId: draft.originalPublicId, approvedAt: Date.now(), ...(purge ? { originalPurged: true } : {}) },
      ];
      await prod.ref.update({
        images: swapped.images,
        ...(prod.hasColors ? { colors: swapped.colors } : {}),
        studioPhotos: photos,
        studioEnhanced: computeStudioEnhanced(swapped.images, swapped.colors, photos),
        updatedAt: Date.now(),
      });
      await patchDraft(id, { status: 'approved', approvedAt: Date.now() });
      if (purge) toPurge.push(draft.originalPublicId);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : 'Onay başarısız' });
    }
  }

  if (toPurge.length) await deleteCloudinaryImages(toPurge).catch(() => {});
  return results;
}

/** Taslakları reddeder: taslak görseli Cloudinary'den silinir, kayıt geçmişte kalır. Siteye dokunulmaz. */
export async function rejectDrafts(ids: string[]): Promise<ApproveResult[]> {
  const results: ApproveResult[] = [];
  const toDelete: string[] = [];
  for (const id of ids) {
    try {
      const dSnap = await adminDb.collection(COL).doc(id).get();
      if (!dSnap.exists) throw new Error('Taslak bulunamadı.');
      const d = dSnap.data()!;
      if (d.status !== 'pending' && d.status !== 'failed') throw new Error('Yalnızca bekleyen/başarısız taslak reddedilebilir.');
      if (d.draftPublicId) toDelete.push(d.draftPublicId);
      await patchDraft(id, { status: 'rejected', rejectedAt: Date.now() });
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : 'Reddedilemedi' });
    }
  }
  if (toDelete.length) await deleteCloudinaryImages(toDelete).catch(() => {});
  return results;
}

/** Onaylı bir fotoğrafı orijinaline döndürür (orijinal silinmediyse). */
export async function revertPhoto(productId: string, publicId: string): Promise<void> {
  const prod = await loadProduct(productId);
  const entry = prod.photos.find((p) => p.publicId === publicId);
  if (!entry) throw new Error('Bu fotoğraf için stüdyo kaydı yok.');
  if (entry.originalPurged) throw new Error("Orijinal fotoğraf Cloudinary'den silinmiş; geri dönüş mümkün değil.");

  const swapped = replaceImageId(prod.images, prod.colors, publicId, entry.originalId);
  if (!swapped.changed) throw new Error('Fotoğraf üründe bulunamadı.');
  const rest = prod.photos.filter((p) => p.publicId !== publicId);
  await prod.ref.update({
    images: swapped.images,
    ...(prod.hasColors ? { colors: swapped.colors } : {}),
    studioPhotos: rest,
    studioEnhanced: computeStudioEnhanced(swapped.images, swapped.colors, rest),
    updatedAt: Date.now(),
  });

  const hist = await adminDb.collection(COL).where('productId', '==', productId).where('draftPublicId', '==', publicId).get();
  for (const d of hist.docs) await d.ref.set({ status: 'reverted', revertedAt: Date.now() }, { merge: true });
  await deleteCloudinaryImages([publicId]).catch(() => {});
}

/** Onaylanmış fotoğrafların orijinallerini Cloudinary'den siler (geri dönüş artık mümkün olmaz). */
export async function purgeOriginals(productIds?: string[]): Promise<{ purged: number }> {
  let docs: FirebaseFirestore.DocumentSnapshot[];
  if (productIds?.length) {
    docs = await Promise.all(productIds.map((id) => adminDb.collection('products').doc(id).get()));
  } else {
    docs = (await adminDb.collection('products').select('studioPhotos').get()).docs;
  }

  let purged = 0;
  for (const doc of docs) {
    if (!doc.exists) continue;
    const photos = readStudioPhotos(doc.data()?.studioPhotos);
    const ids = photos.filter((x) => !x.originalPurged).map((x) => x.originalId);
    if (!ids.length) continue;
    await deleteCloudinaryImages(ids);
    await doc.ref.update({
      studioPhotos: photos.map((x) => ({ ...x, originalPurged: true })),
      updatedAt: Date.now(),
    });
    purged += ids.length;
  }
  return { purged };
}

/** Son 300 üretim (geçmiş). Hata yutulmaz, çağıran gösterir. */
export async function listDrafts(limit = 300): Promise<StudioDraft[]> {
  const snap = await adminDb.collection(COL).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => toDraft(d.id, d.data()));
}

/** Takılı kalmış 'generating' kayıtlarını (sunucu kesilmesi vb.) 'failed' yapar. */
export async function sweepStaleGenerating(now = Date.now()): Promise<number> {
  const snap = await adminDb.collection(COL).where('status', '==', 'generating').get();
  let n = 0;
  for (const d of snap.docs) {
    if (now - (d.data().createdAt || 0) > GENERATING_STALE_MS) {
      await d.ref.set({ status: 'failed', error: 'İşlem zaman aşımına uğradı (sunucu yanıtı kesildi).' }, { merge: true });
      n++;
    }
  }
  return n;
}

export { cldUrl };
