import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().max(max);
const PHONE_RE = /^\+?[0-9\s()-]{10,18}$/;

export const MAX_CART_ITEMS = 30;
export const MAX_QTY = 500;

// Herkese açık: istemci yalnızca ürün id'si, adet, renk ve not gönderir; ad/fiyat sunucuda Firestore'dan okunur.
export const CartRequestInputSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/, 'Geçersiz ürün'),
        qty: z.number().int().min(1).max(MAX_QTY),
        color: trimmed(60).optional(),
        note: trimmed(200).optional(),
      })
    )
    .min(1, 'Sepet boş')
    .max(MAX_CART_ITEMS, `En fazla ${MAX_CART_ITEMS} satır`),
  name: trimmed(80).min(2, 'Ad soyad gerekli'),
  phone: trimmed(20).regex(PHONE_RE, 'Geçerli bir telefon numarası girin'),
  city: trimmed(60).min(2, 'İl gerekli'),
  district: trimmed(60).min(2, 'İlçe gerekli'),
  address: trimmed(300).optional(),
  note: trimmed(500).optional(),
  website: z.string().max(0).optional(), // honeypot
});

export type CartRequestInput = z.infer<typeof CartRequestInputSchema>;

export const SepetTalebiSchema = z.object({
  id: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().catch(''),
        slug: z.string().catch(''),
        title: z.string().catch(''),
        unitPrice: z.number().catch(0),
        qty: z.number().catch(1),
        color: z.string().optional(),
        note: z.string().optional(),
        image: z.string().nullable().optional(),
      })
    )
    .catch([]),
  total: z.number().catch(0),
  name: z.string().catch(''),
  phone: z.string().catch(''),
  city: z.string().catch(''),
  district: z.string().catch(''),
  address: z.string().optional(),
  note: z.string().optional(),
  adminNote: z.string().optional(),
  orderId: z.string().optional(),
  createdAt: z.number().catch(0),
  status: z.enum(['yeni', 'incelendi', 'siparis', 'tamamlandi', 'iptal']).catch('yeni'),
});
