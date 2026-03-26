import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '@/types';
import { PHONE } from './constants';
import { ProductSchema, SatisTalebiSchema } from './schemas';

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

export function cloudinaryUrl(publicId: string, opts = 'f_auto,q_auto,w_900,h_700,c_fill'): string {
  return `https://res.cloudinary.com/dshbqbtpb/image/upload/${opts}/${publicId}`;
}

export function cloudinaryThumb(publicId: string): string {
  return cloudinaryUrl(publicId, 'f_auto,q_auto,w_600,h_500,c_fill');
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function whatsappLink(productTitle: string, slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://umit-spot.vercel.app';
  const productUrl = `${base}/urun/${slug}`;
  const text = encodeURIComponent(
    `Merhaba, "${productTitle}" ürünü ile ilgileniyorum.\n\nÜrün linki: ${productUrl}`
  );
  return `https://wa.me/${PHONE}?text=${text}`;
}

// ── Satış Talepleri ──────────────────────────────────────────────────────────

const REQUESTS_COL = 'satis_talepleri';

export interface SatisTalebi {
  id?: string;
  name: string;
  phone: string;
  category: string;
  itemName: string;
  condition: string;
  price?: string;
  description?: string;
  createdAt: number;
  status: 'yeni' | 'incelendi' | 'reddedildi';
}

function parseSatisTalebi(id: string, data: Record<string, unknown>): SatisTalebi | null {
  const result = SatisTalebiSchema.safeParse({ id, ...data });
  if (!result.success) {
    console.warn(`[products] Geçersiz satış talebi (id: ${id}):`, result.error.flatten().fieldErrors);
    return null;
  }
  return result.data as SatisTalebi;
}

export async function saveSatisTalebi(data: Omit<SatisTalebi, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const ref = await addDoc(collection(db, REQUESTS_COL), {
    ...data,
    createdAt: Date.now(),
    status: 'yeni',
  });
  return ref.id;
}

export async function getSatisTalepleri(): Promise<SatisTalebi[]> {
  try {
    const q = query(collection(db, REQUESTS_COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => parseSatisTalebi(d.id, d.data()))
      .filter((t): t is SatisTalebi => t !== null);
  } catch (err) {
    console.error('[products] getSatisTalepleri failed:', err);
    return [];
  }
}

export async function updateSatisTalebiStatus(id: string, status: SatisTalebi['status']): Promise<void> {
  await updateDoc(doc(db, REQUESTS_COL, id), { status });
}

export async function deleteSatisTalebi(id: string): Promise<void> {
  await deleteDoc(doc(db, REQUESTS_COL, id));
}
