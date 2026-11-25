'use server';

import { headers, cookies } from 'next/headers';
import { rateLimit } from './rate-limit';
import { requireAdmin } from './require-admin';
import { notifyAdmin } from './notify';
import { SITE_URL } from './site';
import { getProductsServer } from './products-server';
import {
  ReviewInputSchema, ReviewReplySchema, REVIEW_STATUSES, hasLink, stars, inviteCookieName, inviteMessage, INVITE_TTL_MS,
  type InviteAccess, type Review, type ReviewStatus,
} from './reviews-utils';
import {
  submitReview, claimInvite, inviteCookieHash, createInvite, listReviewsByStatus, listRecentInvites,
  setReviewStatus, setReviewReply, deleteReview, getReviewStats, type InviteRow,
} from './reviews';

export interface ReviewActionInput { token: string; name: string; rating: number; text: string; images?: string[]; website?: string }

const clientIp = () => (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

/** Herkese açık (yalnızca geçerli tek kullanımlık bağlantıyla): IP limiti + Zod + bağlantı engeli + honeypot. */
export async function submitReviewAction(input: ReviewActionInput): Promise<{ ok: boolean; error?: string }> {
  if (input.website) return { ok: true }; // honeypot: bot sessizce "başarılı" sanır

  if (!rateLimit(`review:${clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: 'Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.' };
  }

  const parsed = ReviewInputSchema.safeParse({ name: input.name, rating: input.rating, text: input.text, images: input.images ?? [] });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Bilgileri kontrol edin.' };
  if (hasLink(parsed.data.text) || hasLink(parsed.data.name)) {
    return { ok: false, error: 'Yorumda bağlantı veya web adresi olamaz.' };
  }

  const token = String(input.token);
  const res = await submitReview(token, parsed.data, inviteCookieHash(token));
  if (!res.ok) return { ok: false, error: res.error };

  // Yönetici bildirimi; başarısız olsa da yorum kayıtlı kalır
  const r = res.review;
  const photos = r.images.length ? `\nFotoğraf: ${r.images.length} adet (yayınlamadan önce panelden bakın)` : '';
  await notifyAdmin(
    'Yeni yorum onay bekliyor',
    `${stars(r.rating)} (${r.rating}/5)\nÜrün: ${r.productTitle || 'Genel yorum'}\nAd: ${r.name}\n\n${r.text}${photos}\n\nPanel: ${SITE_URL}/admin/yorumlar`
  );

  return { ok: true };
}

/** Müşteri bağlantıyı açınca tarayıcıdan çağrılır: ilk açan cihaz sahip olur (çerez). */
export async function claimInviteAction(token: string): Promise<InviteAccess> {
  if (!rateLimit(`review-claim:${clientIp()}`, 30, 60 * 60 * 1000)) return 'locked';
  const t = String(token);
  const { access, secret } = await claimInvite(t, inviteCookieHash(t));
  if (secret) {
    cookies().set(inviteCookieName(t), secret, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      maxAge: Math.round(INVITE_TTL_MS / 1000),
    });
  }
  return access;
}

// ── Yönetim paneli ───────────────────────────────────────────────────────────

export interface CreatedInvite { url: string; message: string; title: string }

export interface ProductOption { id: string; title: string }

/** Davet formunda seçilecek ürünler (etkin ve etkisiz hepsi; boş = genel yorum ayrıca seçenek). */
export async function listProductOptionsAction(): Promise<ProductOption[]> {
  await requireAdmin();
  const products = await getProductsServer();
  return products.map((p) => ({ id: p.id, title: p.title }));
}

/**
 * Yorum bağlantısı + hazır WhatsApp mesajı. productId boş/yok = genel yorum.
 * Ürün bulunamazsa hata döner.
 */
export async function createReviewInviteAction(productId?: string): Promise<CreatedInvite | { error: string }> {
  await requireAdmin();
  const inv = await createInvite(String(productId ?? ''));
  if (!inv) return { error: 'Ürün bulunamadı.' };
  const url = `${SITE_URL}/yorum/${inv.token}`;
  return { url, title: inv.title, message: inviteMessage(inv.title, url) };
}

export async function getReviewStatsAction(): Promise<{ pending: number; approved: number; average: number }> {
  await requireAdmin();
  return getReviewStats();
}

export async function listReviewsAdminAction(status: ReviewStatus): Promise<Review[]> {
  await requireAdmin();
  if (!REVIEW_STATUSES.includes(status)) throw new Error('Geçersiz durum.');
  return listReviewsByStatus(status);
}

export async function listInvitesAdminAction(): Promise<InviteRow[]> {
  await requireAdmin();
  return listRecentInvites();
}

export async function setReviewStatusAction(id: string, status: ReviewStatus): Promise<void> {
  await requireAdmin();
  if (!REVIEW_STATUSES.includes(status)) throw new Error('Geçersiz durum.');
  await setReviewStatus(String(id), status);
}

export async function setReviewReplyAction(id: string, reply: string): Promise<void> {
  await requireAdmin();
  const parsed = ReviewReplySchema.safeParse(reply);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Yanıt geçersiz.');
  await setReviewReply(String(id), parsed.data);
}

export async function deleteReviewAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteReview(String(id));
}
