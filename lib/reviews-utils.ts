// Müşteri yorumları için saf yardımcılar (testli). Veri erişimi lib/reviews.ts'te.
import { z } from 'zod';

export type ReviewStatus = 'bekliyor' | 'onayli' | 'gizli' | 'reddedildi';

export const REVIEW_STATUSES: ReviewStatus[] = ['bekliyor', 'onayli', 'gizli', 'reddedildi'];

export interface Review {
  id: string;
  productId: string;      // '' = genel yorum (ürüne bağlı değil)
  productTitle: string;   // genel yorumda ''
  productSlug: string;
  name: string;
  rating: number;
  text: string;
  images: string[];       // Cloudinary public_id (karta-baski/yorumlar/...), en fazla 3
  status: ReviewStatus;
  createdAt: number;
  adminReply?: string;    // iş sahibinin herkese açık yanıtı
  repliedAt?: number;
}

export const REVIEW_IMAGE_FOLDER = 'karta-baski/yorumlar';
export const MAX_REVIEW_IMAGES = 3;
const REVIEW_IMAGE_RE = new RegExp(`^${REVIEW_IMAGE_FOLDER}/[A-Za-z0-9_-]{5,80}$`);

export const INVITE_TTL_MS = 30 * 24 * 3600 * 1000;

export const ReviewInputSchema = z.object({
  name: z.string().trim().min(2, 'Adınızı yazın.').max(40, 'Ad çok uzun.'),
  rating: z.number().int().min(1, 'Puan seçin.').max(5, 'Puan seçin.'),
  text: z.string().trim().min(10, 'Yorum en az 10 karakter olmalı.').max(600, 'Yorum 600 karakteri geçemez.'),
  // Yalnızca yorum klasörüne yüklenmiş görseller kabul edilir (başka klasörden kimlik enjekte edilemez)
  images: z.array(z.string().regex(REVIEW_IMAGE_RE, 'Geçersiz fotoğraf.')).max(MAX_REVIEW_IMAGES, 'En fazla 3 fotoğraf eklenebilir.').default([]),
});

export const ReviewReplySchema = z.string().trim().max(600, 'Yanıt 600 karakteri geçemez.');

/** Spam/reklam bağlantılarını engeller: yorumda bağlantı olamaz. */
export function hasLink(s: string): boolean {
  return /(https?:|www\.|\b[a-z0-9-]+\.(com|net|org|tr|info|ru|xyz)\b)/i.test(s);
}

/** Gizlilik: "Ayşe Yılmaz" → "Ayşe Y." (ilk ad açık, diğerleri baş harf). */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Müşteri';
  const [first, ...rest] = parts;
  return [first, ...rest.map((p) => `${p[0].toLocaleUpperCase('tr-TR')}.`)].join(' ');
}

export function summarize(list: { rating: number }[]): { count: number; average: number } {
  if (!list.length) return { count: 0, average: 0 };
  const sum = list.reduce((a, r) => a + r.rating, 0);
  return { count: list.length, average: Math.round((sum / list.length) * 10) / 10 };
}

export type InviteState = 'ok' | 'missing' | 'used' | 'expired';

export function inviteState(
  invite: { used?: boolean; expiresAt?: number } | null | undefined,
  now = Date.now()
): InviteState {
  if (!invite) return 'missing';
  if (invite.used) return 'used';
  if (!invite.expiresAt || invite.expiresAt < now) return 'expired';
  return 'ok';
}

export const TOKEN_RE = /^[a-f0-9]{32}$/;

export const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));

// ── Tek cihaza kilitli davet ─────────────────────────────────────────────────
// Bağlantıyı ilk açan cihaz (çerez) bağlantının sahibi olur; başka cihaz/tarayıcı açamaz.
// WhatsApp önizleme botu JS çalıştırmadığı için bağlantıyı "tüketemez".

export type InviteAccess = InviteState | 'unclaimed' | 'locked';

/** deviceHash: davete kayıtlı cihaz özeti; cookieHash: bu isteğin çerez özeti (yoksa null). */
export function inviteAccess(
  invite: { used?: boolean; expiresAt?: number; deviceHash?: string } | null | undefined,
  cookieHash: string | null,
  now = Date.now()
): InviteAccess {
  const st = inviteState(invite, now);
  if (st !== 'ok') return st;
  if (!invite?.deviceHash) return 'unclaimed';
  return cookieHash && cookieHash === invite.deviceHash ? 'ok' : 'locked';
}

export const inviteCookieName = (token: string) => `rv_${token}`;

/** "0532 123 45 67" / "+90 532..." / "532..." → "90532..."; tanınmazsa null. */
export function waPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (/^905\d{9}$/.test(d)) return d;
  if (/^05\d{9}$/.test(d)) return `9${d}`;
  if (/^5\d{9}$/.test(d)) return `90${d}`;
  return null;
}

/** Davet mesajı. productTitle boşsa genel (ürünsüz) yorum metni kullanılır. */
export function inviteMessage(productTitle: string, url: string): string {
  const about = productTitle ? `"${productTitle}" için` : 'siparişiniz için';
  return `Merhaba, KAR-TA BASKI'den ${about} teşekkür ederiz. `
    + 'Deneyiminizi birkaç saniyede paylaşabilir misiniz? İsterseniz baskınızın fotoğrafını da ekleyebilirsiniz.\n\n'
    + `${url}\n\n`
    + 'Bağlantı size özeldir ve yalnızca ilk açtığınız cihazda çalışır.';
}

/** WhatsApp sohbet bağlantısı; numara yoksa kişi seçme ekranı açılır. */
export function waLink(text: string, phone?: string | null): string {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`;
}

export const SATISFACTION: Record<number, string> = {
  1: 'Hiç memnun kalmadım',
  2: 'Memnun kalmadım',
  3: 'İdare eder',
  4: 'Memnun kaldım',
  5: 'Çok memnun kaldım',
};

// ── Fotoğraf içerik kontrolü (magic bytes) ───────────────────────────────────
// Yalnızca JPEG / PNG / WebP. İstemcinin gönderdiği MIME tipine güvenilmez.

const ascii = (b: Uint8Array, start: number, s: string) =>
  b.length >= start + s.length && s.split('').every((c, i) => b[start + i] === c.charCodeAt(0));

export function isAllowedReviewImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // jpeg
  if (b[0] === 0x89 && ascii(b, 1, 'PNG\r\n') && b[6] === 0x1a && b[7] === 0x0a) return true; // png
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return true; // webp
  return false;
}
