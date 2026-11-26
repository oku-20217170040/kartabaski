'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { requireAdmin } from './require-admin';
import { maybeEnqueueOnCreate } from './photo-auto';
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  toggleFeatured as _toggleFeatured,
  ProductError,
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

/* Canlıda sunucu hatalarının metni gizlendiği için yöneticiye gösterilecek mesaj sonuçla döner. */
const explain = (e: unknown) => {
  if (e instanceof ProductError) return { error: e.message };
  throw e;
};

export async function createProductAction(data: Omit<import('@/types').Product, 'id'>): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  let id: string;
  try {
    id = await _createProduct(data);
  } catch (e) {
    return explain(e);
  }
  revalidateTag('products');
  // Ürün Fotoğrafları otomasyonu açıksa stüdyo çekimi işi kuyruğa girer (üretim cron'da); hata ürün kaydını engellemez
  await maybeEnqueueOnCreate(id).catch(() => {});
  return { id };
}

export async function updateProductAction(id: string, data: Partial<import('@/types').Product>): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await _updateProduct(id, data);
  } catch (e) {
    return explain(e);
  }
  revalidateTag('products');
  return {};
}

export async function deleteProductAction(id: string): Promise<void> {
  await requireAdmin();
  await _deleteProduct(id);
  revalidateTag('products');
}

export async function toggleFeaturedAction(id: string, featured: boolean): Promise<void> {
  await requireAdmin();
  await _toggleFeatured(id, featured);
  revalidateTag('products');
}

export async function toggleActiveAction(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await _updateProduct(id, { active });
  revalidateTag('products');
}

// ── Konfiguratör Aksiyonları ──────────────────────────────────────────────────

export async function createCupAction(data: Omit<ConfiguratorCup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  await requireAdmin();
  const id = await _createCup(data);
  revalidatePath('/konfigurator');
  return id;
}

export async function updateCupAction(id: string, data: Partial<ConfiguratorCup>): Promise<void> {
  await requireAdmin();
  await _updateCup(id, data);
  revalidatePath('/konfigurator');
}

export async function deleteCupAction(id: string): Promise<void> {
  await requireAdmin();
  await _deleteCup(id);
  revalidatePath('/konfigurator');
}

export async function createDesignAction(data: Omit<ConfiguratorDesign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  await requireAdmin();
  const id = await _createDesign(data);
  revalidatePath('/konfigurator');
  return id;
}

export async function updateDesignAction(id: string, data: Partial<ConfiguratorDesign>): Promise<void> {
  await requireAdmin();
  await _updateDesign(id, data);
  revalidatePath('/konfigurator');
}

export async function deleteDesignAction(id: string): Promise<void> {
  await requireAdmin();
  await _deleteDesign(id);
  revalidatePath('/konfigurator');
}
