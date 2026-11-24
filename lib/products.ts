import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '@/types';
import { parseProduct } from './product-utils';

const COL = 'products';

// ── Ürün Okuma ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => parseProduct(d.id, d.data(), 'products'))
      .filter((p): p is Product => p !== null);
  } catch (err) {
    console.error('[products] getProducts failed:', err);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const q = query(collection(db, COL), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return parseProduct(d.id, d.data(), 'products');
  } catch (err) {
    console.error('[products] getProductBySlug failed:', err);
    return null;
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const ref = doc(db, COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return parseProduct(snap.id, snap.data(), 'products');
  } catch (err) {
    console.error('[products] getProductById failed:', err);
    return null;
  }
}

// ── Ürün Yazma ───────────────────────────────────────────────────────────────

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { ...data, updatedAt: Date.now() });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { featured, updatedAt: Date.now() });
}

// Saf yardımcılar lib/format.ts'e taşındı; eski import yolları için yeniden export edilir.
export { cloudinaryUrl, cloudinaryThumb, whatsappLink, formatPriceRange } from './format';
