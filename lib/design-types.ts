// Tasarım siparişi: müşteri ve yönetici tarafının ortak kuralları (server-only değil, testli).
import { z } from 'zod';
import { SITE_URL } from './site';
import { TALEP_STATUSES, type TalepStatus } from './talep-status';

export const DESIGN_FOLDER = 'karta-baski/tasarimlar';
export const MAX_DESIGN_FILES = 8;
export const MAX_DESIGN_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_DESIGN_TEXT = 40;
export const MAX_DESIGN_NOTE = 600;
/** WhatsApp'a gönderilmeyen taslaklar bu süre sonunda fotoğraflarıyla silinir. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DESIGN_TOKEN_RE = /^[a-f0-9]{32}$/;

export type DesignStatus = 'taslak' | TalepStatus;

export const PlacementSchema = z.object({
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
  scale: z.number().min(0.1).max(5),
  rotate: z.number().min(-180).max(180),
});

export const DesignInputSchema = z.object({
  productSlug: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  color: z.string().max(60).optional(),
  text: z.string().trim().max(MAX_DESIGN_TEXT).optional(),
  font: z.enum(['duz', 'el']).optional(),
  placement: PlacementSchema.optional(),
  removeBg: z.boolean().optional(),
});
export type DesignInput = z.infer<typeof DesignInputSchema>;

export const DesignSchema = z.object({
  token: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(['taslak', ...TALEP_STATUSES]),
  productSlug: z.string(),
  productTitle: z.string(),
  color: z.string().optional(),
  text: z.string().optional(),
  font: z.enum(['duz', 'el']).optional(),
  placement: PlacementSchema.optional(),
  removeBg: z.boolean().optional(),
  preview: z.string().optional(),
  files: z.array(z.string()).default([]),
  note: z.string().optional(),
  adminNote: z.string().optional(),
});
export type Design = z.infer<typeof DesignSchema>;

/** Sipariş işleme alınana kadar müşteri ekleme/çıkarma yapabilir. */
export function canCustomerEdit(status: DesignStatus): boolean {
  return status === 'taslak' || status === 'yeni' || status === 'incelendi';
}

export const designUrl = (token: string, base: string = SITE_URL) => `${base}/tasarim/${token}`;

/** WhatsApp'a yalnızca sipariş bağlantısı gider; ayrıntılar bağlantının içindedir. */
export const designMessage = (token: string, base?: string) => `Sipariş tasarımım: ${designUrl(token, base)}`;

/** Listelerde kısa sipariş numarası. */
export const designNo = (token: string) => token.slice(0, 6).toUpperCase();
