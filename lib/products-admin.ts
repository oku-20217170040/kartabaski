'server-only';

import crypto from 'crypto';
import { adminDb } from './firebase-admin';
import { Product } from '@/types';

const COL = 'products';

// ── Cloudinary silme ──────────────────────────────────────────────────────────

async function deleteCloudinaryImages(publicIds: string[]): Promise<void> {
  if (!publicIds.length) return;

  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const API_KEY = process.env.CLOUDINARY_API_KEY!;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return;

  await Promise.allSettled(
    publicIds.map(async (publicId) => {
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

      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
        method: 'POST',
        body: form,
      });
    })
  );
}

// ── Ürün Yazma ────────────────────────────────────────────────────────────────

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await adminDb.collection(COL).add({
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  if (data.images) {
    const snap = await adminDb.collection(COL).doc(id).get();
    const oldImages: string[] = snap.data()?.images ?? [];
    const newImages = data.images;
    const removed = oldImages.filter((img) => !newImages.includes(img));
    await deleteCloudinaryImages(removed);
  }

  await adminDb.collection(COL).doc(id).update({ ...data, updatedAt: Date.now() });
}

export async function deleteProduct(id: string): Promise<void> {
  const snap = await adminDb.collection(COL).doc(id).get();
  const images: string[] = snap.data()?.images ?? [];
  await deleteCloudinaryImages(images);
  await adminDb.collection(COL).doc(id).delete();
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ featured, updatedAt: Date.now() });
}
