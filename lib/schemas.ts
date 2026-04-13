import { z } from 'zod';

// ── Kategori ─────────────────────────────────────────────────────────────────

export const CategorySchema = z.enum([
  'Sihirli Mat Kupa',
  'Sihirli Konik Kupa',
  'Seramik Nescafe Fincanı',
  'Sihirli Renkli Kupa',
  'Özel Tasarım',
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
  deliveryDays: z.number().default(3),
  seoTags:      z.array(z.string()).optional(),
  productCode:  z.string().optional(), // Sadece admin panelinde görünür
  createdAt:    z.number().default(0),
  updatedAt:    z.number().default(0),
}).passthrough();

export type ParsedProduct = z.infer<typeof ProductSchema>;
