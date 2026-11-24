import { z } from 'zod';

// ── Kategori ─────────────────────────────────────────────────────────────────

const CategoryEnum = z.enum([
  'Seramik Kahve Fincanı',
  'Lüks Kupa',
  'Kahve Fincanı',
  'Latte Fincanı',
  'Pro Kupa',
  'Büyük Kupa',
  'Sihirli Kupa',
  'Özel Tasarım',
  'Kurumsal',
]);

// Eski (yeniden adlandırılmış) kategori adları → güncel karşılıkları
const LEGACY_CATEGORIES: Record<string, z.infer<typeof CategoryEnum>> = {
  'Seramik Nescafe Fincanı': 'Seramik Kahve Fincanı',
  'Nescafe Fincanı': 'Kahve Fincanı',
};

export const CategorySchema = z.preprocess((v) => {
  if (typeof v !== 'string') return 'Özel Tasarım';
  if (CategoryEnum.safeParse(v).success) return v;
  if (LEGACY_CATEGORIES[v]) return LEGACY_CATEGORIES[v];
  console.warn(`[schemas] Bilinmeyen kategori: "${v}" — 'Özel Tasarım' olarak ele alındı`);
  return 'Özel Tasarım';
}, CategoryEnum);

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
  category:     CategorySchema,
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
