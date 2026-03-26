'use server';

import { revalidateTag } from 'next/cache';
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  toggleFeatured as _toggleFeatured,
  saveSatisTalebi as _saveSatisTalebi,
  deleteSatisTalebi as _deleteSatisTalebi,
  updateSatisTalebiStatus as _updateSatisTalebiStatus,
} from './products-admin';

// ── Ürün Aksiyonları ─────────────────────────────────────────────────────────

export async function createProductAction(data: Omit<import('@/types').Product, 'id'>): Promise<string> {
  const id = await _createProduct(data);
  revalidateTag('products');
  return id;
}

export async function updateProductAction(id: string, data: Partial<import('@/types').Product>): Promise<void> {
  await _updateProduct(id, data);
  revalidateTag('products');
}

export async function deleteProductAction(id: string): Promise<void> {
  await _deleteProduct(id);
  revalidateTag('products');
}

export async function toggleFeaturedAction(id: string, featured: boolean): Promise<void> {
  await _toggleFeatured(id, featured);
  revalidateTag('products');
}

// ── Satış Talebi Aksiyonları ─────────────────────────────────────────────────

export async function saveSatisTalebiAction(
  data: Omit<import('./products').SatisTalebi, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const id = await _saveSatisTalebi(data);
  revalidateTag('satis-talepleri');
  return id;
}

export async function deleteSatisTalebiAction(id: string): Promise<void> {
  await _deleteSatisTalebi(id);
  revalidateTag('satis-talepleri');
}

export async function updateSatisTalebiStatusAction(
  id: string,
  status: 'yeni' | 'incelendi' | 'reddedildi'
): Promise<void> {
  await _updateSatisTalebiStatus(id, status);
  revalidateTag('satis-talepleri');
}
