import 'server-only';

import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { Product } from '@/types';

const COL = 'products';

// ── Cloudinary silme ──────────────────────────────────────────────────────────

/** Cloudinary'den görselleri siler (best effort — hatalar loglanır, fırlatılmaz). */
export async function deleteCloudinaryImages(publicIds: string[]): Promise<void> {
  const ids = Array.from(new Set(publicIds.filter(Boolean)));
  if (!ids.length) return;

  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    console.warn('[cloudinary] Yapılandırma eksik, görseller silinmedi:', ids);
    return;
  }

  const results = await Promise.allSettled(
    ids.map(async (publicId) => {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto
        .createHash('sha256')
        .update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
        .digest('hex');

      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', API_KEY);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[cloudinary] Silinemedi: ${ids[i]}`, r.reason);
  });
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

/** Ürünün tüm Cloudinary public_id'leri (kapak görselleri + renk varyant görselleri). */
function collectImageIds(p: { images?: string[]; colors?: { images?: string[] }[] } | undefined): string[] {
  if (!p) return [];
  const ids = new Set<string>(p.images ?? []);
  for (const c of p.colors ?? []) {
    for (const id of c.images ?? []) ids.add(id);
  }
  return Array.from(ids);
}

/**
 * "Kopyala" ile oluşturulan ürünler aynı public_id'leri paylaşır. Silmeden önce
 * diğer ürünlerin (images + colors[].images) hâlâ kullandığı id'leri ayıklar.
 */
async function withoutSharedIds(ids: string[], selfId: string): Promise<string[]> {
  if (!ids.length) return [];
  try {
    const snap = await adminDb.collection(COL).select('images', 'colors').get();
    const used = new Set<string>();
    for (const d of snap.docs) {
      if (d.id === selfId) continue;
      collectImageIds(d.data() as { images?: string[]; colors?: { images?: string[] }[] }).forEach((x) => used.add(x));
    }
    return ids.filter((x) => !used.has(x));
  } catch (err) {
    // Emin olamıyorsak görseli silmeyiz (veri kaybı > artık dosya)
    console.error('[cloudinary] Paylaşım kontrolü başarısız, silme atlandı:', err);
    return [];
  }
}

async function assertSlugUnique(slug: string | undefined, selfId?: string): Promise<void> {
  if (!slug) return;
  const snap = await adminDb.collection(COL).where('slug', '==', slug).limit(5).get();
  if (snap.docs.some((d) => d.id !== selfId)) {
    throw new Error('Bu slug başka bir üründe kullanılıyor');
  }
}

/** undefined alanları temizler (Firestore undefined kabul etmez). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ── Ürün Yazma ────────────────────────────────────────────────────────────────

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  await assertSlugUnique(data.slug);
  const now = Date.now();
  const ref = await adminDb.collection(COL).add({
    ...stripUndefined(data as unknown as Record<string, unknown>),
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await assertSlugUnique(data.slug, id);

  const docRef = adminDb.collection(COL).doc(id);
  const touchesImages = 'images' in data || 'colors' in data;
  const oldIds = touchesImages ? collectImageIds((await docRef.get()).data()) : [];

  // Form, boş alanları `undefined` gönderir → Firestore'da alanı sil
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    payload[k] = v === undefined ? FieldValue.delete() : v;
  }
  payload.updatedAt = Date.now();

  // 1) Önce Firestore
  await docRef.update(payload);

  // 2) Sonra kaldırılan görselleri sil (best effort)
  if (touchesImages) {
    const after = (await docRef.get()).data();
    const keep = new Set(collectImageIds(after));
    const removed = oldIds.filter((x) => !keep.has(x));
    await deleteCloudinaryImages(await withoutSharedIds(removed, id));
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const docRef = adminDb.collection(COL).doc(id);
  const ids = collectImageIds((await docRef.get()).data());
  await docRef.delete();
  await deleteCloudinaryImages(await withoutSharedIds(ids, id));
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ featured, updatedAt: Date.now() });
}
