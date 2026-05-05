import { z } from 'zod';

// ── Kategori ─────────────────────────────────────────────────────────────────

export const CategorySchema = z.enum([
  'Seramik Nescafe Fincanı',
  'Lüks Kupa',
  'Kahve Fincanı',
  'Latte Fincanı',
  'Pro Kupa',
  'Büyük Kupa',
  'Sihirli Kupa',
  'Özel Tasarım',
  'Kurumsal',
]);

// ── Ürün ─────────────────────────────────────────────────────────────────────
//
// .passthrough() — Firestore belgelerinde alias alanlar olabilir; onları silmeden geçiriyoruz.
// .partial() — Firestore'dan eksik gelebilecek alanlar için toleranslı oluyoruz.

export const ProductSchema = z.object({
  id:           z.string(),
  title:        z.string().default(''),
  slug:         z.string().optional().default(''),
  priceMin:     z.number().default(0),
  priceMax:     z.number().default(0),
  category:     CategorySchema.catch('Özel Tasarım'),
  active:       z.boolean().default(true),
  featured:     z.boolean().optional(),
  shortDesc:    z.string().default(''),
  description:  z.string().default(''),
  images:       z.array(z.string()).default([]),
  colors:       z.array(z.object({
    name:   z.string(),
    images: z.array(z.string()).default([]),
  })).optional(),
  deliveryDays: z.number().default(3),
  seoTags:      z.array(z.string()).optional(),
  productCode:  z.string().optional(), // Sadece admin panelinde görünür
  createdAt:    z.number().default(0),
  updatedAt:    z.number().default(0),
}).passthrough();

export type ParsedProduct = z.infer<typeof ProductSchema>;
