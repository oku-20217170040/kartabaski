'use server';

import { revalidateTag } from 'next/cache';
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  toggleFeatured as _toggleFeatured,
} from './products-admin';
import {
  createCup as _createCup,
  updateCup as _updateCup,
  deleteCup as _deleteCup,
  createDesign as _createDesign,
  updateDesign as _updateDesign,
  deleteDesign as _deleteDesign,
} from './configurator-admin';
import type { ConfiguratorCup, ConfiguratorDesign } from '@/types';

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

// ── Konfiguratör Aksiyonları ──────────────────────────────────────────────────

export async function createCupAction(data: Omit<ConfiguratorCup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return _createCup(data);
}

export async function updateCupAction(id: string, data: Partial<ConfiguratorCup>): Promise<void> {
  await _updateCup(id, data);
}

export async function deleteCupAction(id: string): Promise<void> {
  await _deleteCup(id);
}

export async function createDesignAction(data: Omit<ConfiguratorDesign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return _createDesign(data);
}

export async function updateDesignAction(id: string, data: Partial<ConfiguratorDesign>): Promise<void> {
  await _updateDesign(id, data);
}

export async function deleteDesignAction(id: string): Promise<void> {
  await _deleteDesign(id);
}
