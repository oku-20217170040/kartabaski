import 'server-only';

import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { adminDb } from './firebase-admin';
import { matchPostsForProduct } from './blog-match';
import type { Post } from './posts-types';

const COL = 'posts';

/** Yazı kapakları yalnızca bu klasörden silinir/kabul edilir. */
export const COVER_ID_RE = /^karta-baski\/[A-Za-z0-9_\-/]{3,120}$/;

export function toPost(id: string, d: FirebaseFirestore.DocumentData): Post {
  const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    id,
    slug: String(d.slug ?? id),
    title: String(d.title ?? ''),
    excerpt: String(d.excerpt ?? ''),
    content: String(d.content ?? ''),
    coverImage: d.coverImage ? String(d.coverImage) : undefined,
    tags: strList(d.tags),
    faq: Array.isArray(d.faq) ? d.faq.map((f: { q?: unknown; a?: unknown }) => ({ q: String(f.q ?? ''), a: String(f.a ?? '') })) : [],
    ...(strList(d.productIds).length ? { productIds: strList(d.productIds) } : {}),
    ...(strList(d.categories).length ? { categories: strList(d.categories) } : {}),
    published: d.published === true,
    publishedAt: Number(d.publishedAt ?? 0),
    updatedAt: Number(d.updatedAt ?? 0),
    ...(Number(d.scheduledAt) > 0 ? { scheduledAt: Number(d.scheduledAt) } : {}),
    ...(d.auto === true ? { auto: true } : {}),
  };
}

/** Tüm yazılar (admin) ya da yalnızca yayındakiler (vitrin). Birleşik index gerekmesin diye bellekte süzülür. */
export async function listPosts(publishedOnly: boolean): Promise<Post[]> {
  const snap = await adminDb.collection(COL).get();
  const posts = snap.docs.map((d) => toPost(d.id, d.data()));
  const filtered = publishedOnly ? posts.filter((p) => p.published) : posts;
  return filtered.sort((a, b) => (b.publishedAt || b.updatedAt) - (a.publishedAt || a.updatedAt));
}

// Yayındaki yazılar: server action'lar revalidateTag('posts') ile anında temizler (yedek: 10 dk).
export const getCachedPublishedPosts = unstable_cache(() => listPosts(true), ['posts'], {
  tags: ['posts'],
  revalidate: 600,
});

/** Yayındaki yazılar, yeni önce (sosyal medya agentları ve vitrin kullanır; önbellekten okunur). */
export async function listPublishedPosts(limit?: number): Promise<Post[]> {
  const all = await getCachedPublishedPosts();
  return limit && limit > 0 ? all.slice(0, limit) : all;
}

/** Önbellekteki listede bulunamayan (yeni yayınlanmış) yazı için tek sorgu; yayında değilse null. */
export async function getPublishedPostBySlug(slug: string): Promise<Post | null> {
  const snap = await adminDb.collection(COL).where('slug', '==', slug).limit(1).get();
  const d = snap.docs[0];
  if (!d) return null;
  const post = toPost(d.id, d.data());
  return post.published ? post : null;
}

/** Slug ile yayındaki yazı: önce önbellekli liste, yoksa tek sorgu. */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const all = await getCachedPublishedPosts().catch(() => [] as Post[]);
  return all.find((p) => p.slug === slug) ?? (await getPublishedPostBySlug(slug).catch(() => null));
}

/** Ürün sayfası için ilgili yazılar: ürünün geçtiği ya da kategorisiyle eşleşen yayındaki yazılar. */
export async function getPostsForProduct(productId: string, category?: string, limit = 3): Promise<Post[]> {
  const all = await getCachedPublishedPosts().catch(() => [] as Post[]);
  return matchPostsForProduct(all, productId, category, limit);
}

export async function getPostById(id: string): Promise<Post | null> {
  const d = await adminDb.collection(COL).doc(id).get();
  return d.exists ? toPost(d.id, d.data()!) : null;
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const snap = await adminDb.collection(COL).where('slug', '==', slug).limit(2).get();
  return snap.docs.some((d) => d.id !== exceptId);
}

export type PostInput = Omit<Post, 'id' | 'publishedAt' | 'updatedAt'>;

/** Firestore undefined kabul etmez: seçmeli alanlar ya yazılır ya da (güncellemede) silinir. */
function buildFields(input: PostInput) {
  const opt = <T,>(v: T | undefined, has: boolean) => (has ? v : FieldValue.delete());
  return {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    content: input.content,
    tags: input.tags,
    faq: input.faq,
    published: input.published,
    coverImage: opt(input.coverImage, !!input.coverImage),
    productIds: opt(input.productIds, !!input.productIds?.length),
    categories: opt(input.categories, !!input.categories?.length),
    scheduledAt: opt(input.scheduledAt, !input.published && (input.scheduledAt ?? 0) > 0),
    auto: opt(true as const, input.auto === true),
  };
}

export async function savePost(input: PostInput, id?: string): Promise<string> {
  const now = Date.now();
  const fields = buildFields(input);
  if (id) {
    const ref = adminDb.collection(COL).doc(id);
    const prev = await ref.get();
    const prevData = prev.data() ?? {};
    // Eski kapak değiştiyse Cloudinary'den sil. Otomatik yazıların kapağı ürün görselinden gelir: asla silinmez.
    if (prevData.coverImage && prevData.coverImage !== input.coverImage && prevData.auto !== true) {
      await deleteImages([String(prevData.coverImage)]);
    }
    const publishedAt = input.published ? Number(prevData.publishedAt) || now : 0;
    await ref.set({ ...fields, publishedAt, updatedAt: now }, { merge: true });
    return id;
  }
  // Yeni belgede FieldValue.delete() geçersiz: yalnızca dolu alanları yaz
  const doc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (!(v instanceof FieldValue)) doc[k] = v;
  const ref = await adminDb.collection(COL).add({ ...doc, publishedAt: input.published ? now : 0, updatedAt: now });
  return ref.id;
}

export async function deletePost(id: string): Promise<void> {
  const ref = adminDb.collection(COL).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  // Otomatik yazıların kapağı ürün görselinden gelir (ürüne aittir): silinmez.
  if (data?.coverImage && data.auto !== true) await deleteImages([String(data.coverImage)]);
  await ref.delete();
}

async function deleteImages(ids: string[]): Promise<void> {
  const publicIds = ids.filter((i) => COVER_ID_RE.test(i));
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!publicIds.length || !CLOUD_NAME || !API_KEY || !API_SECRET) return;
  await Promise.allSettled(
    publicIds.map(async (publicId) => {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto.createHash('sha256').update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`).digest('hex');
      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', API_KEY);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, { method: 'POST', body: form });
    }),
  );
}

// ── Yayın takvimi ────────────────────────────────────────────────────────────

/** Planlı (taslak + gelecekteki tarih) yazılar, en yakın tarih önce. */
export async function listScheduled(): Promise<Post[]> {
  const snap = await adminDb.collection(COL).get();
  return snap.docs
    .map((d) => toPost(d.id, d.data()))
    .filter((p) => !p.published && (p.scheduledAt ?? 0) > 0)
    .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0));
}

async function publishDoc(id: string, now: number): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ published: true, publishedAt: now, updatedAt: now, scheduledAt: FieldValue.delete() });
}

/** Yazıyı hemen yayınlar (takvimden çıkar). */
export async function publishPostNow(id: string, now = Date.now()): Promise<Post | null> {
  const post = await getPostById(id);
  if (!post || post.published) return null;
  await publishDoc(id, now);
  return { ...post, published: true, publishedAt: now };
}

/** Vakti gelmiş en eski planlı yazıyı yayınlar (çağrı başına en fazla bir; günlük sıklık `lib/blog-cadence.ts`). */
export async function publishDue(now = Date.now(), graceMs = 2 * 3600 * 1000): Promise<Post | null> {
  const due = (await listScheduled()).find((p) => (p.scheduledAt ?? 0) <= now + graceMs);
  return due ? publishPostNow(due.id, now) : null;
}

/** Planlı yazıyı sırada bir yukarı (öne) ya da aşağı (ertele) taşır: iki yazının tarihleri yer değiştirir. */
export async function moveScheduled(id: string, dir: 'up' | 'down'): Promise<boolean> {
  const queue = await listScheduled();
  const i = queue.findIndex((p) => p.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= queue.length) return false;
  const batch = adminDb.batch();
  const now = Date.now();
  batch.update(adminDb.collection(COL).doc(queue[i].id), { scheduledAt: queue[j].scheduledAt, updatedAt: now });
  batch.update(adminDb.collection(COL).doc(queue[j].id), { scheduledAt: queue[i].scheduledAt, updatedAt: now });
  await batch.commit();
  return true;
}

/** Yazıyı belirli bir tarihe planlar (null = takvimden çıkar, taslak kalır). */
export async function setSchedule(id: string, at: number | null): Promise<void> {
  await adminDb.collection(COL).doc(id).update({ scheduledAt: at && at > 0 ? at : FieldValue.delete(), updatedAt: Date.now() });
}
