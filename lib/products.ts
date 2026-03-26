import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '@/types';
import { PHONE } from './constants';

const COL = 'products';

// ── Bellek içi cache — sayfa yenilenmeden tekrar Firestore'a gitmez ──
let _cache: Product[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 60 saniye

export async function getProducts(forceRefresh = false): Promise<Product[]> {
  const now = Date.now();
  if (!forceRefresh && _cache && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }
  try {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    _cache = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    _cacheTime = now;
    return _cache;
  } catch (err) {
    console.error('[products] getProducts failed:', err);
    return _cache ?? [];
  }
}

export function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (_cache) {
    const found = _cache.find((p) => p.slug === slug);
    if (found) return found;
  }
  try {
    const q = query(collection(db, COL), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Product;
  } catch (err) {
    console.error('[products] getProductBySlug failed:', err);
    return null;
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  if (_cache) {
    const found = _cache.find((p) => p.id === id);
    if (found) return found;
  }
  try {
    const ref = doc(db, COL, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Product;
  } catch (err) {
    console.error('[products] getProductById failed:', err);
    return null;
  }
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  invalidateCache();
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { ...data, updatedAt: Date.now() });
  invalidateCache();
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidateCache();
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, { featured, updatedAt: Date.now() });
  invalidateCache();
}

export function cloudinaryUrl(publicId: string, opts = 'f_auto,q_auto,w_900,h_700,c_fill'): string {
  return `https://res.cloudinary.com/dshbqbtpb/image/upload/${opts}/${publicId}`;
}

export function cloudinaryThumb(publicId: string): string {
  return cloudinaryUrl(publicId, 'f_auto,q_auto,w_600,h_500,c_fill');
}

export function whatsappLink(productTitle: string, slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://umit-spot.vercel.app';
  const productUrl = `${base}/urun/${slug}`;
  const text = encodeURIComponent(
    `Merhaba, "${productTitle}" ürünü ile ilgileniyorum.\n\nÜrün linki: ${productUrl}`
  );
  return `https://wa.me/${PHONE}?text=${text}`;
}

// ── SATIŞ TALEPLERİ ──
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SatisTalebi));
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
