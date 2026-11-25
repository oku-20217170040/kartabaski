import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { CycleResult, PlatformStatus } from './social-types';
import { trDayKey } from './tr-time';
import { getSocialSettings, ensureSocialMeta, patchSocialMeta } from './social-settings';
import { getSocialRows } from './social-products';
import {
  isShareable, imageUrls, buildProductCaption, blogCaption, blogUrl, campaignCaption, campaignDue, activeCampaign,
  pickBlogToShare, pickQueue, newArrivals, retryableFailures, type SocialProductRow, type PostedEntry,
} from './social-content-utils';
import { inWindow } from './social-settings-utils';
import { threadsDetailChunks, threadsGate, threadsTodayCount } from './threads-utils';
import {
  publishThreadsMedia, publishThreadsText, replyToThreadsPost, refreshThreadsTokenIfNeeded, threadsConfigured,
} from './threads';
import { SITE_URL } from './site';
import { listPublishedPosts } from '@/lib/posts';

/**
 * Threads için otomatik paylaşım: günlük kota ve saat aralığı `social_settings/threads` ayarından gelir.
 * Önce yeni eklenen ürünler (kota dışı), sonra yeni blog yazısı, özel gün kampanyası ve kota kuyruğu.
 * Threads gönderi düzenlemeyi desteklemez; ürün ayrıntıları gönderinin altına zincirleme yanıt olarak yazılır.
 * Durum: threads_auto/state (Admin SDK).
 */
const stateRef = () => adminDb.collection('threads_auto').doc('state');
const LOCK_MS = 5 * 60 * 1000;
const NEW_PER_RUN = 2;
const msg = (e: unknown, n = 200) => (e instanceof Error ? e.message : 'hata').slice(0, n);

export interface ThreadsPosted extends PostedEntry {
  permalink?: string;
}

export interface ThreadsState {
  startedAt: number;
  day: string;
  todayCount: number;
  lastPostAt: number;
  lockUntil: number;
  posted: Record<string, ThreadsPosted>;
}

function parse(d: FirebaseFirestore.DocumentData | undefined): ThreadsState {
  return {
    startedAt: Number(d?.startedAt) || 0,
    day: String(d?.day ?? ''),
    todayCount: Number(d?.todayCount) || 0,
    lastPostAt: Number(d?.lastPostAt) || 0,
    lockUntil: Number(d?.lockUntil) || 0,
    posted: (d?.posted ?? {}) as Record<string, ThreadsPosted>,
  };
}

export async function loadThreadsState(): Promise<ThreadsState> {
  return parse((await stateRef().get()).data());
}

/** Aynı anda iki çalıştırma (cron + panel) çift paylaşım yapmasın diye kilit alır. */
async function acquire(now: number): Promise<ThreadsState | null> {
  return adminDb.runTransaction(async (tx) => {
    const st = parse((await tx.get(stateRef())).data());
    if (st.lockUntil > now) return null;
    tx.set(stateRef(), { lockUntil: now + LOCK_MS }, { merge: true });
    return st;
  });
}

const release = () => stateRef().set({ lockUntil: 0 }, { merge: true });

/** Hatalı kaydı siler: ürün sıradaki turda yeniden gönderilir. */
export async function requeueThreadsPost(productId: string): Promise<void> {
  await stateRef().update({ [`posted.${productId}`]: FieldValue.delete() });
}

/** Ürünü paylaşır (görselli) ve ayrıntıları zincirleme yanıtlarla ekler. Hata fırlatmaz. */
async function shareProduct(row: SocialProductRow, now: number, errors: string[]): Promise<boolean> {
  const images = imageUrls(row, 10);
  if (images.length === 0) {
    await stateRef().set({ posted: { [row.id]: { postedAt: now, error: 'görsel yok' } } }, { merge: true });
    return false;
  }
  try {
    const out = await publishThreadsMedia(images, buildProductCaption(row, 'threads'));
    await stateRef().set({ posted: { [row.id]: { postedAt: now, postId: out.id, permalink: out.permalink ?? null, error: FieldValue.delete() } } }, { merge: true });
    // 500 karakterlik gönderiye sığmayan açıklama altına yanıt olarak yazılır; yanıt başarısız olsa da gönderi yayında kalır
    const extras = [`📦 Teslimat: yaklaşık ${row.deliveryDays} iş günü`, '🎨 İsim, fotoğraf, logo ya da özel tasarımla baskı.', `🔗 ${SITE_URL}/urun/${row.slug}`];
    let parentId = out.id;
    for (const chunk of threadsDetailChunks(row.description || row.shortDesc, extras)) {
      try {
        parentId = (await replyToThreadsPost(parentId, chunk)) || parentId;
      } catch (e) {
        errors.push(`${row.title.slice(0, 24)} ayrıntı: ${msg(e, 140)}`);
        break;
      }
    }
    return true;
  } catch (e) {
    const error = msg(e);
    await stateRef().set({ posted: { [row.id]: { postedAt: now, error } } }, { merge: true });
    errors.push(`${row.title.slice(0, 30)}: ${error}`);
    return false;
  }
}

export interface ThreadsRunOpts {
  /** Yalnızca panelden: saat penceresini ve bekleme süresini yok sayar (günlük kota geçerli kalır). */
  ignoreWindow?: boolean;
  /** Bu turda en fazla kaç ürün. */
  max?: number;
}

export async function runThreadsCycle(now = Date.now(), opts: ThreadsRunOpts = {}): Promise<CycleResult> {
  const result: CycleResult = { posted: [], errors: [] };
  if (!threadsConfigured()) return { ...result, skipped: 'Threads bağlı değil (THREADS_ACCESS_TOKEN tanımlı değil)' };
  const s = await getSocialSettings('threads');
  if (!s.enabled && !opts.ignoreWindow) return { ...result, skipped: 'otomasyon kapalı' };

  const st = await acquire(now);
  if (!st) return { ...result, skipped: 'başka bir çalışma sürüyor' };
  try {
    await refreshThreadsTokenIfNeeded(now);
    if (!st.startedAt) await stateRef().set({ startedAt: now }, { merge: true });
    const startedAt = st.startedAt || now;
    const meta = await ensureSocialMeta('threads', now);
    const rows = await getSocialRows();
    const open = opts.ignoreWindow || inWindow(s, now);
    let used = threadsTodayCount(st.day, st.todayCount, now);
    let lastPostAt = st.lastPostAt;
    const bump = async (n = 1) => {
      used += n;
      lastPostAt = now;
      await stateRef().set({ day: trDayKey(now), todayCount: used, lastPostAt }, { merge: true });
    };
    const posted = { ...st.posted };

    // 1) Yeni eklenen ürünler (kota dışı) + hatalı kayıtların yeniden denemesi
    if (open && !opts.ignoreWindow) {
      const fresh = [...newArrivals(rows, posted, startedAt), ...retryableFailures(rows, posted)].slice(0, NEW_PER_RUN);
      for (const r of fresh) {
        if (await shareProduct(r, now, result.errors)) { result.posted.push(r.id); posted[r.id] = { postedAt: now, postId: 'x' }; await bump(0); }
      }
    }

    // 2) Yeni blog yazısı ve özel gün kampanyası (kota dışı, yalnız paylaşım saatlerinde)
    if (open && !opts.ignoreWindow) {
      try {
        const post = pickBlogToShare(await listPublishedPosts(10), meta.blogShared, meta.startedAt);
        if (post) {
          await publishThreadsText(blogCaption(post, 'threads'), blogUrl(post.slug));
          await patchSocialMeta('threads', { blogShared: { ...meta.blogShared, [post.id]: now } });
          result.posted.push(`blog:${post.id}`);
        }
      } catch (e) {
        result.errors.push(`blog: ${msg(e, 160)}`);
      }
      const ac = activeCampaign(now);
      if (ac && campaignDue(meta.campaigns[ac.key], now)) {
        try {
          await publishThreadsText(campaignCaption(ac, [], 'threads'), SITE_URL);
          await patchSocialMeta('threads', { campaigns: { ...meta.campaigns, [ac.key]: now } });
          result.posted.push(`campaign:${ac.key}`);
        } catch (e) {
          result.errors.push(`kampanya: ${msg(e, 160)}`);
        }
      }
    }

    // 3) Kota kuyruğu
    const gate = opts.ignoreWindow
      ? used >= s.dailyLimit ? { ok: false, reason: 'günlük kota doldu' } : { ok: true as const, reason: undefined }
      : threadsGate({ day: trDayKey(now), todayCount: used, lastPostAt }, s, now);
    if (!gate.ok) {
      if (!result.posted.length) result.skipped = gate.reason;
      return result;
    }
    const limit = Math.min(s.dailyLimit - used, opts.max ?? 1);
    for (const r of pickQueue(rows, posted, now).slice(0, Math.max(0, limit))) {
      if (await shareProduct(r, now, result.errors)) { result.posted.push(r.id); await bump(); }
    }
    return result;
  } finally {
    await release();
  }
}

/** Panelden: saat penceresini yok sayıp tek bir ürünü hemen paylaşır (ilk bağlantı testi için). */
export async function shareThreadsProductNow(productId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!threadsConfigured()) return { ok: false, reason: 'Threads bağlı değil (THREADS_ACCESS_TOKEN tanımlı değil)' };
  const now = Date.now();
  const st = await acquire(now);
  if (!st) return { ok: false, reason: 'Şu an başka bir yayın sürüyor, birkaç dakika sonra tekrar dene.' };
  try {
    const row = (await getSocialRows(true)).find((r) => r.id === productId);
    if (!row || !isShareable(row)) return { ok: false, reason: 'Ürün bulunamadı, pasif ya da fotoğrafı yok.' };
    if (st.posted[productId]?.postId) return { ok: false, reason: 'Bu ürün zaten paylaşılmış.' };
    const errors: string[] = [];
    if (!(await shareProduct(row, now, errors))) return { ok: false, reason: errors[0] ?? 'Paylaşılamadı' };
    await stateRef().set({ day: trDayKey(now), todayCount: threadsTodayCount(st.day, st.todayCount, now) + 1, lastPostAt: now }, { merge: true });
    return { ok: true };
  } finally {
    await release();
  }
}

export async function getThreadsStatus(): Promise<PlatformStatus> {
  const [s, st, rows] = await Promise.all([getSocialSettings('threads'), loadThreadsState(), getSocialRows().catch(() => [] as SocialProductRow[])]);
  const configured = threadsConfigured();
  const lastPostAt = Object.values(st.posted).reduce((m, v) => (v.postId && v.postedAt > m ? v.postedAt : m), 0) || undefined;
  const lastErr = Object.values(st.posted).find((v) => v.error)?.error;
  return {
    platform: 'threads',
    configured,
    enabled: s.enabled,
    lastRunAt: s.lastRunAt,
    lastPostAt,
    queued: pickQueue(rows, st.posted, Date.now()).length,
    detail: !configured ? 'THREADS_ACCESS_TOKEN tanımlı değil' : lastErr ? `Son hata: ${lastErr}` : s.lastRunNote,
  };
}
