'server-only';

import { adminDb } from './firebase-admin';
import { Product } from '@/types';
import { ProductSchema } from './schemas';

const COL = 'products';

function parseProduct(id: string, data: Record<string, unknown>): Product | null {
  const result = ProductSchema.safeParse({ id, ...data });
  if (!result.success) {
    console.warn(`[products-server] Geçersiz ürün (id: ${id}):`, result.error.flatten().fieldErrors);
    return null;
  }
  return result.data as Product;
}

/** Tüm ürünleri döndürür (Admin SDK — Firestore kurallarını atlar) */
export async function getProductsServer(): Promise<Product[]> {
  try {
    const snap = await adminDb
      .collection(COL)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs
      .map((d) => parseProduct(d.id, d.data() as Record<string, unknown>))
      .filter((p): p is Product => p !== null);
  } catch (err) {
    console.error('[products-server] getProductsServer failed:', err);
    return [];
  }
}

/** Slug'a göre tek ürün getirir (Admin SDK) */
export async function getProductBySlugServer(slug: string): Promise<Product | null> {
  try {
    const snap = await adminDb
      .collection(COL)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const d = snap.docs[0];
    return parseProduct(d.id, d.data() as Record<string, unknown>);
  } catch (err) {
    console.error('[products-server] getProductBySlugServer failed:', err);
    return null;
  }
}
