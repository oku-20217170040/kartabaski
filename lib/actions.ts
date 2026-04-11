'use server';

import { revalidateTag } from 'next/cache';
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  toggleFeatured as _toggleFeatured,
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

export async function toggleActiveAction(id: string, active: boolean): Promise<void> {
  await _updateProduct(id, { active });
  revalidateTag('products');
}
