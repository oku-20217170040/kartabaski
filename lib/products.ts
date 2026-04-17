import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '@/types';
import { PHONE, DEFAULT_WA_TEXT } from './constants';
import { ProductSchema } from './schemas';

const COL = 'products';

// ── Yardımcı: Firestore dokümanını Zod ile doğrula ───────────────────────────

function parseProduct(id: string, data: Record<string, unknown>): Product | null {
  const result = ProductSchema.safeParse({ id, ...data });
  if (!result.success) {
    console.warn(`[products] Geçersiz ürün verisi (id: ${id}):`, result.error.flatten().fieldErrors);
    return null;
  }
  return result.data as Product;
}

// ── Ürün Okuma ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => parseProduct(d.id, d.data()))
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
    return parseProduct(d.id, d.data());
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
    return parseProduct(snap.id, snap.data());
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

// ── Cloudinary ───────────────────────────────────────────────────────────────

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

export function cloudinaryUrl(publicId: string, opts = 'f_auto,q_auto,w_1200,c_limit'): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${opts}/${publicId}`;
}

export function cloudinaryThumb(publicId: string): string {
  return cloudinaryUrl(publicId, 'f_auto,q_auto,w_600,c_limit');
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function whatsappLink(productTitle?: string, slug?: string): string {
  if (!productTitle) {
    return `https://wa.me/${PHONE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;
  }
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kartabaski.com';
  const productUrl = slug ? `\n🔗 ${SITE_URL}/urun/${slug}` : '';
  const text = `Merhaba, aşağıdaki ürün için sipariş vermek istiyorum. Fiyat bilgisi alabilir miyim?\n\n☕ ${productTitle}${productUrl}`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}

// ── Fiyat Yardımcıları ────────────────────────────────────────────────────────

export function formatPriceRange(priceMin: number, priceMax: number): string {
  if (!priceMin && !priceMax) return 'Fiyat için yazın';
  if (priceMin && !priceMax) return `${new Intl.NumberFormat('tr-TR').format(priceMin)}₺`;
  if (!priceMin && priceMax) return `${new Intl.NumberFormat('tr-TR').format(priceMax)}₺`;
  if (priceMin === priceMax) return `${new Intl.NumberFormat('tr-TR').format(priceMin)}₺`;
  return `${new Intl.NumberFormat('tr-TR').format(priceMin)}₺ – ${new Intl.NumberFormat('tr-TR').format(priceMax)}₺`;
}
