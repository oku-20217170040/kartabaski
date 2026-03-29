import { z } from 'zod';

// ── Kategori ─────────────────────────────────────────────────────────────────

export const CategorySchema = z.enum([
  'Mobilya', 'Beyaz Eşya', 'Elektronik', 'Ofis',
  'Yatak', 'Baza', 'Dekorasyon', 'Aydınlatma', 'Bahçe', 'Ev Eşyaları', 'Diğer',
]);

// ── Ürün ─────────────────────────────────────────────────────────────────────
//
// .passthrough() — Firestore belgelerinde baslik/fiyat gibi alias alanlar
// olabilir; onları silmeden geçiriyoruz.
// .partial() — Firestore'dan eksik gelebilecek alanlar için toleranslı oluyoruz.

export const ProductSchema = z.object({
  id:          z.string(),
  title:       z.string().default(''),
  slug:        z.string().optional().default(''),
  priceTRY:    z.number().default(0),
  category:    CategorySchema.catch('Diğer'),
  condition:   z.enum(['Sıfır', 'Sıfır Gibi', 'Az Kullanılmış', '2. El', 'İyi Durumda', 'Normal Durumda', 'Parasına Göre', 'Hasarlı/Onarım Gerekli']).catch('2. El'),
  inStock:     z.boolean().default(true),
  featured:    z.boolean().optional(),
  tags:        z.array(z.string()).default([]),
  shortDesc:   z.string().default(''),
  description: z.string().default(''),
  images:      z.array(z.string()).default([]),
  specs:       z.record(z.string(), z.string()).default({}),
  createdAt:   z.number().default(0),
  updatedAt:   z.number().default(0),
}).passthrough();

export type ParsedProduct = z.infer<typeof ProductSchema>;

// ── Satış Talebi ─────────────────────────────────────────────────────────────

export const SatisTalebiSchema = z.object({
  id:          z.string().optional(),
  name:        z.string(),
  phone:       z.string(),
  category:    z.string(),
  itemName:    z.string(),
  condition:   z.string(),
  price:       z.string().optional(),
  description: z.string().optional(),
  createdAt:   z.number(),
  status:      z.enum(['yeni', 'incelendi', 'reddedildi']).catch('yeni'),
});

export type ParsedSatisTalebi = z.infer<typeof SatisTalebiSchema>;
