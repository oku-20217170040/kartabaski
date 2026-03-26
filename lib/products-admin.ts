'server-only';

import { adminDb } from './firebase-admin';
import { Product } from '@/types';
import { SatisTalebi } from './products';

const COL = 'products';
const REQUESTS_COL = 'satis_talepleri';

export async function createProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await adminDb.collection(COL).add({
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ ...data, updatedAt: Date.now() });
}

export async function deleteProduct(id: string): Promise<void> {
  await adminDb.collection(COL).doc(id).delete();
}

export async function toggleFeatured(id: string, featured: boolean): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ featured, updatedAt: Date.now() });
}

export async function saveSatisTalebi(
  data: Omit<SatisTalebi, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const ref = await adminDb.collection(REQUESTS_COL).add({
    ...data,
    createdAt: Date.now(),
    status: 'yeni',
  });
  return ref.id;
}

export async function deleteSatisTalebi(id: string): Promise<void> {
  await adminDb.collection(REQUESTS_COL).doc(id).delete();
}

export async function updateSatisTalebiStatus(
  id: string,
  status: SatisTalebi['status']
): Promise<void> {
  await adminDb.collection(REQUESTS_COL).doc(id).update({ status });
}
