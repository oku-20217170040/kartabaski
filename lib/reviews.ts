import 'server-only';
import { randomBytes, createHash } from 'crypto';
import { unstable_cache, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { adminDb } from './firebase-admin';
import { deleteCloudinaryImages } from './products-admin';
import { displayTitle } from './format';
import {
  INVITE_TTL_MS, inviteAccess, inviteCookieName, TOKEN_RE, summarize,
  type InviteAccess, type Review, type ReviewStatus,
} from './reviews-utils';

/**
 * Gerçek müşteri yorumları. Yorum yazmak için tek kullanımlık bağlantı gerekir; bağlantıyı yalnızca
 * admin paneli üretir (ürüne bağlı veya genel). Bağlantı ilk açan cihaza kilitlenir.
 * Yorumlar onaylanana kadar sitede görünmez.
 * Koleksiyonlar yalnızca Admin SDK ile erişilir: review_invites, reviews, review_uploads.
 */
const INV = 'review_invites';
const REV = 'reviews';
const UPL = 'review_uploads';
const PRODUCTS = 'products';

/** Sahiplenilmemiş yüklemeler bu süre sonra Cloudinary'den silinir (yorum gönderilmezse yetim kalmasın). */
const ORPHAN_UPLOAD_MS = 6 * 3600 * 1000;

export interface Invite {
  productId: string;      // '' = genel yorum
  productTitle: string;
  productSlug: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  deviceHash?: string;
  claimedAt?: number;
  usedAt?: number;
}

export interface InviteRow { token: string; productTitle: string; createdAt: number; expiresAt: number; used: boolean; claimed: boolean }

/**
 * Bağlantı üretir. productId verilmezse (veya '') genel yorum bağlantısıdır.
 * Verilen ürün bulunamazsa null.
 */
export async function createInvite(productId?: string): Promise<{ token: string; title: string; productId: string } | null> {
  const pid = (productId ?? '').trim();
  let title = '';
  let slug = '';
  if (pid) {
    const snap = await adminDb.collection(PRODUCTS).doc(pid).get();
    const d = snap.data();
    if (!snap.exists || !d) return null;
    title = displayTitle(String(d.title ?? '')).slice(0, 200);
    slug = String(d.slug ?? pid);
  }
  const token = randomBytes(16).toString('hex');
  const now = Date.now();
  const invite: Invite = {
    productId: pid,
    productTitle: title,
    productSlug: slug,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    used: false,
  };
  await adminDb.collection(INV).doc(token).set(invite);
  return { token, title, productId: pid };
}

export async function getInvite(token: string): Promise<Invite | null> {
  if (!TOKEN_RE.test(token)) return null;
  const snap = await adminDb.collection(INV).doc(token).get();
  return snap.exists ? (snap.data() as Invite) : null;
}

export const hashDeviceSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** Bu isteğin davet çerezinin özeti (çerez yoksa null). Sunucu bileşeni, action ve route içinde çalışır. */
export function inviteCookieHash(token: string): string | null {
  const v = cookies().get(inviteCookieName(token))?.value;
  return v ? hashDeviceSecret(v) : null;
}

/**
 * Bağlantıyı açan cihazı sahip yapar (işlem içinde: iki cihaz aynı anda açarsa yalnızca biri kazanır).
 * secret yalnızca bu çağrı sahiplendiyse döner; çerez olarak yazılır.
 */
export async function claimInvite(token: string, cookieHash: string | null): Promise<{ access: InviteAccess; secret?: string }> {
  if (!TOKEN_RE.test(token)) return { access: 'missing' };
  const ref = adminDb.collection(INV).doc(token);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const inv = snap.exists ? (snap.data() as Invite) : null;
    const access = inviteAccess(inv, cookieHash);
    if (access !== 'unclaimed') return { access };
    const secret = randomBytes(24).toString('hex');
    tx.update(ref, { deviceHash: hashDeviceSecret(secret), claimedAt: Date.now() });
    return { access: 'ok' as const, secret };
  });
}

export type SubmitResult = { ok: true; id: string; review: Review } | { ok: false; error: string };

/** Bağlantıyı tek seferde tüketip yorumu "bekliyor" olarak kaydeder (işlem içinde, çift gönderim yok). */
export async function submitReview(
  token: string,
  input: { name: string; rating: number; text: string; images?: string[] },
  cookieHash: string | null
): Promise<SubmitResult> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: 'Bağlantı geçersiz.' };
  const invRef = adminDb.collection(INV).doc(token);
  const revRef = adminDb.collection(REV).doc();
  try {
    const review = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(invRef);
      const inv = snap.exists ? (snap.data() as Invite) : null;
      const st = inviteAccess(inv, cookieHash);
      if (st !== 'ok' || !inv) throw new Error(st);
      const r: Review = {
        id: revRef.id,
        productId: inv.productId ?? '',
        productTitle: inv.productTitle ?? '',
        productSlug: inv.productSlug ?? '',
        name: input.name,
        rating: input.rating,
        text: input.text,
        images: input.images ?? [],
        status: 'bekliyor',
        createdAt: Date.now(),
      };
      tx.set(revRef, { ...r, inviteToken: token });
      tx.update(invRef, { used: true, usedAt: Date.now() });
      return r;
    });
    await claimUploads(review.images); // fotoğraflar artık yetim sayılmaz
    return { ok: true, id: review.id, review };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'used') return { ok: false, error: 'Bu bağlantıyla zaten yorum yazılmış.' };
    if (msg === 'expired') return { ok: false, error: 'Bu bağlantının süresi dolmuş.' };
    if (msg === 'locked' || msg === 'unclaimed') return { ok: false, error: 'Bu bağlantı başka bir cihazda açılmış.' };
    if (msg === 'missing') return { ok: false, error: 'Bağlantı geçersiz.' };
    console.error('[reviews] kayıt hatası:', msg);
    return { ok: false, error: 'Yorum kaydedilemedi, biraz sonra tekrar deneyin.' };
  }
}

function toReview(id: string, d: FirebaseFirestore.DocumentData): Review {
  return {
    id,
    productId: String(d.productId ?? ''),
    productTitle: String(d.productTitle ?? ''),
    productSlug: String(d.productSlug ?? ''),
    name: String(d.name ?? ''),
    rating: Number(d.rating ?? 0),
    text: String(d.text ?? ''),
    images: Array.isArray(d.images) ? d.images.filter((x: unknown): x is string => typeof x === 'string') : [],
    status: (d.status as ReviewStatus) ?? 'bekliyor',
    createdAt: Number(d.createdAt ?? 0),
    adminReply: typeof d.adminReply === 'string' && d.adminReply ? d.adminReply : undefined,
    repliedAt: d.repliedAt ? Number(d.repliedAt) : undefined,
  };
}

export async function getReview(id: string): Promise<Review | null> {
  const snap = await adminDb.collection(REV).doc(id).get();
  return snap.exists ? toReview(id, snap.data()!) : null;
}

const loadApprovedReviews = async (): Promise<Review[]> => {
  // Tek alan eşitliği: birleşik indeks gerektirmez; sıralama ve ürün filtresi bellekte
  const snap = await adminDb.collection(REV).where('status', '==', 'onayli').limit(300).get();
  return snap.docs.map((d) => toReview(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
};

/** Tüm onaylı yorumlar, önbellekli. Onay/gizleme/silme revalidateTag('reviews') ile anında yansır. */
const getApprovedReviewsCached = unstable_cache(loadApprovedReviews, ['reviews-approved'], {
  tags: ['reviews'],
  revalidate: 3600,
});

/**
 * Vitrin okuması (yalnızca onaylılar, en yeni önce).
 * productId verilmezse tüm onaylı yorumlar; verilirse yalnızca o ürünün yorumları ('' = genel yorumlar).
 */
export async function getApprovedReviewsServer(productId?: string, limit = 12): Promise<Review[]> {
  const all = await getApprovedReviewsCached().catch(() => [] as Review[]);
  const list = productId === undefined ? all : all.filter((r) => r.productId === productId);
  return list.slice(0, limit);
}

/** JSON-LD (AggregateRating) için yorum sayısı ve ortalama puan. productId ile aynı kapsam. */
export async function getReviewAggregate(productId?: string): Promise<{ count: number; average: number }> {
  const list = await getApprovedReviewsServer(productId, 300);
  return summarize(list);
}

/** Yönetim paneli: bekleyen/yayında sayıları ve yayındakilerin ortalaması. */
export async function getReviewStats(): Promise<{ pending: number; approved: number; average: number }> {
  const [pendingSnap, approved] = await Promise.all([
    adminDb.collection(REV).where('status', '==', 'bekliyor').count().get(),
    getApprovedReviewsServer(undefined, 300),
  ]);
  const { count, average } = summarize(approved);
  return { pending: pendingSnap.data().count, approved: count, average };
}

/** Yönetim paneli: duruma göre yorumlar (en yeni önce). */
export async function listReviewsByStatus(status: ReviewStatus, limit = 100): Promise<Review[]> {
  const snap = await adminDb.collection(REV).where('status', '==', status).limit(limit).get();
  return snap.docs.map((d) => toReview(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

/** Yönetim paneli: son davet bağlantıları ve durumları. */
export async function listRecentInvites(limit = 20): Promise<InviteRow[]> {
  const snap = await adminDb.collection(INV).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const v = d.data() as Invite;
    return { token: d.id, productTitle: v.productTitle || 'Genel yorum', createdAt: v.createdAt, expiresAt: v.expiresAt, used: !!v.used, claimed: !!v.deviceHash };
  });
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<Review | null> {
  const ref = adminDb.collection(REV).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ status, moderatedAt: Date.now() });
  revalidateTag('reviews');
  const r = toReview(id, { ...snap.data()!, status });
  // Reddedilen yorumun fotoğrafları depoda tutulmaz (gizlenen yorumunki korunur, geri açılabilsin)
  if (status === 'reddedildi' && r.images.length) await deleteCloudinaryImages(r.images).catch(() => {});
  return r;
}

/** Yanıtı kaydeder; boş metin yanıtı kaldırır. */
export async function setReviewReply(id: string, reply: string): Promise<void> {
  const ref = adminDb.collection(REV).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Yorum bulunamadı.');
  const text = reply.trim();
  await ref.update(text ? { adminReply: text, repliedAt: Date.now() } : { adminReply: null, repliedAt: null });
  revalidateTag('reviews');
}

export async function deleteReview(id: string): Promise<void> {
  const ref = adminDb.collection(REV).doc(id);
  const snap = await ref.get();
  const images: string[] = Array.isArray(snap.data()?.images) ? snap.data()!.images : [];
  await ref.delete();
  if (images.length) await deleteCloudinaryImages(images).catch(() => {});
  revalidateTag('reviews');
}

// ── Yorum fotoğrafı yetim takibi ─────────────────────────────────────────────
// Yüklenen her fotoğraf review_uploads'a yazılır; yorum kaydedilince sahiplenilir (kayıt silinir).
// Sahiplenilmeyen ve ORPHAN_UPLOAD_MS'den eski olanlar Cloudinary'den temizlenir.

const uploadDocId = (publicId: string) => publicId.replace(/\//g, '__');

export async function trackReviewUpload(publicId: string): Promise<void> {
  await adminDb.collection(UPL).doc(uploadDocId(publicId)).set({ publicId, createdAt: Date.now() });
}

async function claimUploads(publicIds: string[]): Promise<void> {
  if (!publicIds.length) return;
  const batch = adminDb.batch();
  publicIds.forEach((id) => batch.delete(adminDb.collection(UPL).doc(uploadDocId(id))));
  await batch.commit();
}

export async function cleanupExpiredReviewUploads(): Promise<void> {
  const snap = await adminDb.collection(UPL).where('createdAt', '<', Date.now() - ORPHAN_UPLOAD_MS).limit(50).get();
  if (snap.empty) return;
  await deleteCloudinaryImages(snap.docs.map((d) => String(d.data().publicId ?? '')).filter(Boolean));
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
