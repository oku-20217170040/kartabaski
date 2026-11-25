'use server';

import { requireAdmin } from './require-admin';
import { getSocialRows } from './social-products';
import { getSocialSettings } from './social-settings';
import { pickQueue } from './social-content-utils';
import { formatPriceRange } from './format';
import { loadThreadsState, requeueThreadsPost, runThreadsCycle, shareThreadsProductNow } from './threads-auto';
import { threadsConfigured, threadsTokenInfo } from './threads';
import { threadsTodayCount } from './threads-utils';
import type { SocialSettings } from './social-settings-utils';

export interface ThreadsPostRow {
  id: string;
  title: string;
  postedAt: number;
  active: boolean;
  priceLabel: string;
  link?: string;
  error?: string;
}

export interface ThreadsOverview {
  configured: boolean;
  username?: string;
  tokenExpiresAt?: number;
  tokenError?: string;
  settings: SocialSettings;
  todayCount: number;
  backlog: number;
  etaDays: number;
  lastPostAt: number;
  posted: ThreadsPostRow[];
  candidates: { id: string; title: string }[];
}

export async function getThreadsOverviewAction(checkAccount = false): Promise<ThreadsOverview> {
  await requireAdmin();
  const [st, rows, settings, token] = await Promise.all([
    loadThreadsState(), getSocialRows(), getSocialSettings('threads', true), threadsTokenInfo(checkAccount),
  ]);
  const now = Date.now();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const queue = pickQueue(rows, st.posted, now);
  const posted: ThreadsPostRow[] = Object.entries(st.posted)
    .map(([id, v]) => {
      const cur = byId.get(id);
      return {
        id,
        title: cur?.title ?? '(silinmiş ürün)',
        postedAt: v.postedAt,
        active: cur?.active ?? false,
        priceLabel: cur ? formatPriceRange(cur.priceMin, cur.priceMax) : '—',
        link: v.postId ? v.permalink || undefined : undefined,
        error: v.postId ? undefined : v.error,
      };
    })
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, 60);
  return {
    configured: threadsConfigured(),
    username: token.username,
    tokenExpiresAt: token.expiresAt,
    tokenError: token.error,
    settings,
    todayCount: threadsTodayCount(st.day, st.todayCount, now),
    backlog: queue.length,
    etaDays: settings.dailyLimit ? Math.ceil(queue.length / settings.dailyLimit) : 0,
    lastPostAt: Math.max(0, ...Object.values(st.posted).filter((v) => v.postId).map((v) => v.postedAt)),
    posted,
    candidates: queue.filter((r) => !st.posted[r.id]).slice(0, 100).map((r) => ({ id: r.id, title: r.title })),
  };
}

export async function requeueThreadsPostAction(productId: string): Promise<void> {
  await requireAdmin();
  await requeueThreadsPost(String(productId));
}

export interface ThreadsPostNowResult { posted: number; errors: string[]; skipped?: string }

/** Panelden: saat penceresini yok sayıp sıradaki tek ürünü hemen paylaşır (ilk bağlantı testi için). */
export async function postOneThreadsNowAction(): Promise<ThreadsPostNowResult> {
  await requireAdmin();
  const r = await runThreadsCycle(Date.now(), { ignoreWindow: true, max: 1 });
  return { posted: r.posted.length, errors: r.errors.map((e) => e.slice(0, 200)), skipped: r.skipped };
}

/** Seçilen modeli kuyruğu beklemeden Threads'te paylaşır. */
export async function shareThreadsProductNowAction(productId: string): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  return shareThreadsProductNow(productId);
}
