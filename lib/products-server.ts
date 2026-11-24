import 'server-only';

import { adminDb } from './firebase-admin';
import { Product } from '@/types';
import { parseProduct } from './product-utils';

const COL = 'products';

/** Tüm ürünleri döndürür (Admin SDK — Firestore kurallarını atlar) */
export async function getProductsServer(): Promise<Product[]> {
  try {
    const snap = await adminDb
      .collection(COL)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs
      .map((d) => parseProduct(d.id, d.data() as Record<string, unknown>, 'products-server'))
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
    return parseProduct(d.id, d.data() as Record<string, unknown>, 'products-server');
  } catch (err) {
    console.error('[products-server] getProductBySlugServer failed:', err);
    return null;
  }
}

/** Aynı kategorideki benzer ürünleri getirir (Admin SDK) */
export async function getSimilarProductsServer(
  category: string,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  try {
    const snap = await adminDb
      .collection(COL)
      .where('category', '==', category)
      .where('active', '==', true)
      .limit(limit + 1)
      .get();

    return snap.docs
      .map((d) => parseProduct(d.id, d.data() as Record<string, unknown>, 'products-server'))
      .filter((p): p is Product => p !== null && p.id !== excludeId)
      .slice(0, limit);
  } catch (err) {
    console.error('[products-server] getSimilarProductsServer failed:', err);
    return [];
  }
}
