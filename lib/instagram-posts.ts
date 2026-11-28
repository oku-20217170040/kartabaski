import 'server-only';
import { adminDb } from './firebase-admin';
import { getSocialRows } from './social-products';
import { getSocialSettings, ensureSocialMeta, patchSocialMeta } from './social-settings';
import { notifyAdmin, telegramReady } from './notify';
import { PHONE_DISPLAY, SITE_NAME } from './constants';
import { SITE_URL } from './site';
import { formatPriceRange } from './format';
import { trDayKey, trHour } from './tr-time';
import { publishCarousel, publishSinglePost, publishStory } from './instagram';
import {
  PLAN_START_HOUR, LEAD_MS, MAX_CAROUSEL_IMAGES, isDue, survivors, slideUrl, feedImageUrl,
  type IgPost, type IgItem, type PostKind,
} from './instagram-utils';
import { buildPlan, buildBlogDraft } from './instagram-auto-utils';
import {
  buildProductCaption, activeCampaign, campaignDue, pickBlogToShare, isShareable, type SocialProductRow,
} from './social-content-utils';
import { listPublishedPosts } from '@/lib/posts';
import { yeniSistemAktif } from './paylasim/depo';

/**
 * Günlük Instagram planı + yayın. Koleksiyon `instagram_posts` (yalnız Admin SDK), plan kilidi `instagram_plans/{gün}`.
 * Akış: sabah ~06:00 TSİ plan üretilir (taslaklar, yayın en az 1 saat sonra) → Telegram'a özet →
 * sahibi iptal/düzenleme yapmazsa zamanı gelince yayınlanır. Yayın anında model hâlâ aktif mi yeniden doğrulanır.
 */
const COL = 'instagram_posts';
const PLANS = 'instagram_plans';
const HOUR = 3600 * 1000;
const MANUAL_DELAY_MIN = 15;
const CLAIM_MS = 5 * 60 * 1000;
const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';
const brand = () => `${SITE_NAME} · ${PHONE_DISPLAY}`;
const errText = (e: unknown, n = 300) => (e instanceof Error ? e.message : 'bilinmeyen hata').slice(0, n);

export const priceLabel = (i: Pick<IgItem, 'priceMin' | 'priceMax'>) => formatPriceRange(i.priceMin, i.priceMax);

/** Taslak kartı / yayın için görsel adresi. */
export const previewUrl = (item: IgItem, kind: PostKind) =>
  slideUrl(item, { cloud: cloud(), brand: brand(), kind: kind === 'story' ? 'story' : 'feed', priceLabel });

function toPost(id: string, d: FirebaseFirestore.DocumentData): IgPost {
  return {
    id,
    kind: d.kind,
    status: d.status,
    publishAt: Number(d.publishAt) || 0,
    createdAt: Number(d.createdAt) || 0,
    items: Array.isArray(d.items) ? d.items : [],
    caption: String(d.caption ?? ''),
    captionEdited: !!d.captionEdited,
    igMediaId: d.igMediaId ? String(d.igMediaId) : undefined,
    error: d.error ? String(d.error) : undefined,
    day: String(d.day ?? ''),
    theme: d.theme ? String(d.theme) : undefined,
    refId: d.refId ? String(d.refId) : undefined,
  };
}

export async function listPostsBetween(from: number, to: number, limit = 120): Promise<IgPost[]> {
  const snap = await adminDb.collection(COL).where('publishAt', '>=', from).where('publishAt', '<', to).orderBy('publishAt').limit(limit).get();
  return snap.docs.map((d) => toPost(d.id, d.data())).filter((p) => p.status !== 'iptal');
}

export async function getPost(id: string): Promise<IgPost | null> {
  const s = await adminDb.collection(COL).doc(id).get();
  return s.exists ? toPost(id, s.data()!) : null;
}

async function patch(id: string, data: Record<string, unknown>) {
  await adminDb.collection(COL).doc(id).set({ ...data, updatedAt: Date.now() }, { merge: true });
}

const liveRows = async () => (await getSocialRows(true)).filter(isShareable);

/** Son 7 günde (taslak dahil, iptal/hata hariç) kullanılan ürünler: productId → son zaman. */
async function recentProducts(now: number): Promise<Map<string, number>> {
  const posts = await listPostsBetween(now - 7 * 24 * HOUR, now + 2 * 24 * HOUR, 300);
  const m = new Map<string, number>();
  for (const p of posts) {
    if (p.status === 'hata') continue;
    for (const it of p.items) m.set(it.productId, Math.max(m.get(it.productId) ?? 0, p.publishAt));
  }
  return m;
}

export interface PlanResult { created: number; skipped?: string }

const hhmm = (ts: number) => new Date(ts + 3 * HOUR).toISOString().slice(11, 16);

/** Günde bir kez (TSİ 06:00'dan sonra) taslakları üretir. Tekrar çağrılırsa yeni üretmez. */
export async function ensureDailyPlan(now = Date.now()): Promise<PlanResult> {
  if (await yeniSistemAktif()) return { created: 0, skipped: 'ürün paylaşımları yeni paylaşım sisteminde' };
  if (trHour(now) < PLAN_START_HOUR) return { created: 0, skipped: 'plan saati değil' };
  const day = trDayKey(now);
  if ((await adminDb.collection(PLANS).doc(day).get()).exists) return { created: 0, skipped: 'bugünün planı zaten var' };

  const s = await getSocialSettings('instagram');
  if (s.dailyLimit + s.storyLimit === 0) return { created: 0, skipped: 'günlük kota 0' };
  const meta = await ensureSocialMeta('instagram', now);
  const rows = await getSocialRows();
  const ac = activeCampaign(now);
  const campaign = ac && campaignDue(meta.campaigns[ac.key], now) ? ac : null;

  const posts = buildPlan({
    day, now, rows, recent: await recentProducts(now),
    feedCount: s.dailyLimit, storyCount: s.storyLimit, windowStart: s.windowStart, windowEnd: s.windowEnd, campaign, minLeadMs: LEAD_MS,
  });
  if (!posts.length) return { created: 0, skipped: 'yeterli aktif ürün ya da uygun saat yok' };

  try {
    await adminDb.collection(PLANS).doc(day).create({ createdAt: now });
  } catch {
    return { created: 0, skipped: 'bugünün planı zaten var' }; // yarışta başka çalışma planı üretti
  }
  const batch = adminDb.batch();
  for (const p of posts) batch.set(adminDb.collection(COL).doc(), p);
  await batch.commit();
  if (campaign && posts.some((p) => p.theme === campaign.key)) {
    await patchSocialMeta('instagram', { campaigns: { ...meta.campaigns, [campaign.key]: now } });
  }
  await notifyPlan(day, posts, s.enabled);
  return { created: posts.length };
}

async function notifyPlan(day: string, posts: Omit<IgPost, 'id'>[], enabled: boolean) {
  if (!posts.length || !(await telegramReady())) return;
  const feeds = posts.filter((p) => p.kind !== 'story');
  const stories = posts.filter((p) => p.kind === 'story');
  const lines = [
    `Instagram planı hazır (${day})`,
    enabled ? 'İtiraz etmezsen zamanı gelince otomatik yayınlanır.' : 'Otomatik paylaşım KAPALI: taslaklar yayınlanmaz.',
    '',
    ...feeds.map((p) => `${hhmm(p.publishAt)} gönderi: ${Array.from(new Set(p.items.map((i) => i.title.slice(0, 24)))).join(' · ')}`),
    ...(stories.length ? [`${stories.length} hikâye: ${hhmm(stories[0].publishAt)} - ${hhmm(stories[stories.length - 1].publishAt)}`] : []),
    '',
    `Önizleme/düzenleme: ${SITE_URL}/admin/instagram`,
  ];
  await notifyAdmin('Instagram', lines.join('\n')).catch(() => {});
}

/** Yeni yayınlanan bir blog yazısı için tek görselli taslak üretir (yazı başına bir kez). */
export async function ensureBlogDraft(now = Date.now()): Promise<{ created: number; skipped?: string }> {
  const meta = await ensureSocialMeta('instagram', now);
  const post = pickBlogToShare(await listPublishedPosts(10), meta.blogShared, meta.startedAt);
  if (!post) return { created: 0, skipped: 'paylaşılacak yeni yazı yok' };
  const s = await getSocialSettings('instagram');
  const fallback = (await getSocialRows()).find(isShareable)?.imageIds[0];
  const draft = buildBlogDraft(post, { now, day: trDayKey(now), windowStart: s.windowStart, windowEnd: s.windowEnd, leadMs: LEAD_MS, fallbackImage: fallback });
  // Görseli olmayan yazı bir daha denenmesin
  await patchSocialMeta('instagram', { blogShared: { ...meta.blogShared, [post.id]: now } });
  if (!draft) return { created: 0, skipped: 'yazının kapak görseli yok' };
  await adminDb.collection(COL).add(draft);
  return { created: 1 };
}

/** Yayın zamanı 12 saatten fazla geçmiş taslakları iptal eder (eski hikâyeler bir daha çıkmasın). */
export async function expireStaleDrafts(now = Date.now()): Promise<number> {
  const old = await listPostsBetween(now - 72 * HOUR, now - 12 * HOUR, 200);
  let n = 0;
  for (const p of old) {
    if (p.status !== 'taslak') continue;
    await patch(p.id, { status: 'iptal', error: 'Yayın zamanı geçti' });
    n++;
  }
  return n;
}

export async function cancelPost(id: string): Promise<boolean> {
  const p = await getPost(id);
  if (!p) return false;
  await adminDb.collection(COL).doc(id).delete(); // iptal edilen taslak tamamen silinir
  return true;
}

export async function cancelDay(day: string): Promise<number> {
  const snap = await adminDb.collection(COL).where('day', '==', day).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.data().status === 'taslak') {
      await d.ref.delete();
      n++;
    }
  }
  return n;
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  await patch(id, { caption: caption.slice(0, 2000), captionEdited: true });
}

/** Yayın anında modellerin hâlâ aktif olduğunu doğrular; pasife alınanlar çıkar, güncel ad/fiyat alınır. */
async function revalidateItems(p: IgPost): Promise<IgItem[] | null> {
  const live = new Map((await liveRows()).map((r) => [r.id, r]));
  const kept = survivors(p.items, new Set(live.keys()), p.kind);
  if (!kept) return null;
  return kept.map((i) => {
    const r = live.get(i.productId);
    if (!r) return i; // blog öğesi
    // Slaytın kendi görseli ürünün mevcut görsellerinden biriyse korunur (kapak tüm slaytlara kopyalanmaz)
    const imageId = r.imageIds.includes(i.imageId) ? i.imageId : r.imageIds[0];
    return { productId: i.productId, title: r.title, priceMin: r.priceMin, priceMax: r.priceMax, imageId, category: r.category };
  });
}

/** Aynı taslağı iki çalışmanın (cron + panel) birden yayınlamasını önler. */
async function claim(id: string, now: number): Promise<boolean> {
  const ref = adminDb.collection(COL).doc(id);
  return adminDb.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d || d.status !== 'taslak' || Number(d.claimUntil) > now) return false;
    tx.set(ref, { claimUntil: now + CLAIM_MS }, { merge: true });
    return true;
  });
}

export async function publishPost(p: IgPost, now = Date.now()): Promise<{ ok: boolean; error?: string }> {
  if (!(await claim(p.id, now))) return { ok: false, error: 'Bu taslak şu an yayınlanıyor ya da zaten yayınlandı' };
  const items = await revalidateItems(p);
  if (!items) {
    await patch(p.id, { status: 'iptal', error: 'Model(ler) pasife alındı', claimUntil: 0 });
    return { ok: false, error: 'ürün pasife alınmış' };
  }
  try {
    let mediaId: string;
    if (p.kind === 'story') {
      mediaId = await publishStory(previewUrl(items[0], 'story'));
    } else {
      const urls = items.map((i) => feedImageUrl(cloud(), i.imageId)).slice(0, MAX_CAROUSEL_IMAGES);
      let caption = p.caption;
      // Düzenlenmemiş tek modelli gönderide açıklama güncel ad/fiyatla yeniden kurulur
      if (!p.captionEdited && p.kind === 'carousel' && !p.theme) {
        const row = (await liveRows()).find((r) => r.id === items[0].productId);
        if (row) caption = buildProductCaption(row, 'instagram');
      }
      mediaId = urls.length === 1 ? await publishSinglePost(urls[0], caption) : await publishCarousel(urls, caption);
    }
    await patch(p.id, { status: 'yayinlandi', igMediaId: mediaId, items, publishedAt: Date.now(), error: null, claimUntil: 0 });
    return { ok: true };
  } catch (e) {
    const error = errText(e);
    await patch(p.id, { status: 'hata', error, claimUntil: 0 });
    if (await telegramReady()) {
      await notifyAdmin('Instagram paylaşımı başarısız', `${p.kind === 'story' ? 'Hikâye' : 'Gönderi'}: ${p.items[0]?.title ?? ''}\n${error}`).catch(() => {});
    }
    return { ok: false, error };
  }
}

/** Zamanı gelen taslakları yayınlar (her çalışmada en fazla `max`; geç kalmışlar 12 saat içindeyse). */
export async function publishDue(now = Date.now(), max = 2): Promise<{ published: string[]; errors: string[] }> {
  const devir = await yeniSistemAktif();
  const due = (await listPostsBetween(now - 12 * HOUR, now + 1)).filter((p) => isDue(p, now) && (!devir || p.kind === 'blog')).slice(0, max);
  const out = { published: [] as string[], errors: [] as string[] };
  for (const p of due) {
    const r = await publishPost(p, now);
    if (r.ok) out.published.push(p.items[0]?.productId ?? p.id);
    else out.errors.push(`${p.items[0]?.title.slice(0, 30) ?? p.id}: ${r.error}`);
  }
  return out;
}

/** Taslağın yayın zamanını değiştirir. */
export async function reschedulePost(id: string, newPublishAt: number): Promise<void> {
  await patch(id, { publishAt: newPublishAt, day: trDayKey(newPublishAt) });
}

const itemsFor = (r: SocialProductRow, kind: PostKind): IgItem[] =>
  (kind === 'carousel' ? r.imageIds.slice(0, MAX_CAROUSEL_IMAGES) : [r.imageIds[0]]).map((imageId) => ({
    productId: r.id, title: r.title, priceMin: r.priceMin, priceMax: r.priceMax, imageId, category: r.category,
  }));

/** Tek bir ürünü panelden doğrudan Instagram taslak kuyruğuna ekler (gönderi ya da hikâye). */
export async function scheduleProductPost(
  productId: string,
  kind: Exclude<PostKind, 'blog'> = 'carousel',
  delayMinutes = MANUAL_DELAY_MIN
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const row = (await liveRows()).find((r) => r.id === productId);
  if (!row) return { ok: false, error: 'Ürün bulunamadı ya da yayına uygun değil (pasif ya da Cloudinary görseli eksik)' };
  const now = Date.now();
  const publishAt = now + Math.max(0, delayMinutes) * 60 * 1000;
  const items = itemsFor(row, kind);
  const ref = adminDb.collection(COL).doc();
  const post: Omit<IgPost, 'id'> = {
    kind, status: 'taslak', publishAt, createdAt: now, day: trDayKey(publishAt), items,
    caption: kind === 'story' ? '' : buildProductCaption(row, 'instagram'),
  };
  await ref.set(post);
  return { ok: true, postId: ref.id };
}

/** Taslaktaki slayt sıralamasını veya silinen slaytları günceller. */
export async function updatePostItems(id: string, newItems: IgItem[]): Promise<void> {
  if (!newItems || newItems.length === 0) throw new Error('En az bir görsel bulunmalıdır.');
  const post = await getPost(id);
  if (!post) throw new Error('Paylaşım bulunamadı.');
  await patch(id, { items: newItems });
}

/** Ürünün Cloudinary'deki mevcut tüm fotoğrafları (taslağa yeniden fotoğraf ekleyebilmek için). */
export async function getProductAvailableImages(productId: string): Promise<string[]> {
  const row = (await getSocialRows()).find((r) => r.id === productId);
  return row?.imageIds ?? [];
}

/** Karusel taslağını ürünün tüm orijinal fotoğraflarıyla baştan eşitler. */
export async function resetPostToProductPhotos(id: string): Promise<IgItem[]> {
  const post = await getPost(id);
  if (!post || !post.items.length) throw new Error('Paylaşım bulunamadı.');
  const row = (await liveRows()).find((r) => r.id === post.items[0].productId);
  if (!row) throw new Error('Ürün bulunamadı ya da pasif.');
  const newItems = itemsFor(row, post.kind === 'story' ? 'story' : 'carousel');
  await patch(id, { items: newItems, ...(post.captionEdited ? {} : { caption: buildProductCaption(row, 'instagram') }) });
  return newItems;
}

/** Taslağın açıklamasını en güncel ürün bilgileri ve şablonla sıfırdan yeniden oluşturur. */
export async function regeneratePostCaption(id: string): Promise<string> {
  const post = await getPost(id);
  if (!post || !post.items.length) throw new Error('Paylaşım bulunamadı.');
  const row = (await liveRows()).find((r) => r.id === post.items[0].productId);
  if (!row) throw new Error('Ürün bulunamadı ya da pasif.');
  const caption = buildProductCaption(row, 'instagram');
  await patch(id, { caption, captionEdited: false });
  return caption;
}
