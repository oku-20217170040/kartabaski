'use server';

import { requireAdmin } from './require-admin';
import { getTitle } from './product-utils';
import { loadPinterestState, requeuePinterestPost, runPinterestCycleWith } from './pinterest-auto';
import { pinterestConfigured, pinterestOAuthReady, getPinterestConnection, disconnectPinterest, type PinterestConnection } from './pinterest';
import { getSocialProducts, getSocialPosts, toChannelRow, getPlatformGate, setSocialEnabled } from './telegram-channel-data';
import { pickBacklog, channelTodayCount, isBlogKey, BLOG_KEY_PREFIX } from './telegram-channel-utils';

export interface PinterestPostRow {
  id: string;
  kind: 'product' | 'blog';
  title: string;
  postedAt: number;
  active: boolean;
  board?: string;
  link?: string;
  error?: string;
}

export interface PinterestOverview {
  configured: boolean;
  oauthReady: boolean;
  enabled: boolean;
  connection: PinterestConnection;
  todayCount: number;
  dailyLimit: number;
  backlog: number;
  etaDays: number;
  lastPostAt: number;
  posted: PinterestPostRow[];
}

export async function getPinterestOverviewAction(): Promise<PinterestOverview> {
  await requireAdmin();
  const [st, products, posts, cfg] = await Promise.all([loadPinterestState(), getSocialProducts(), getSocialPosts(), getPlatformGate('pinterest')]);
  const backlog = pickBacklog(products.map(toChannelRow), st.posted, Number.MAX_SAFE_INTEGER).length;
  const titles = new Map(products.map((p) => [p.id, getTitle(p)]));
  const activeMap = new Map(products.map((p) => [p.id, toChannelRow(p).active]));
  const postTitles = new Map(posts.map((p) => [p.id, p.title]));

  const posted: PinterestPostRow[] = Object.entries(st.posted)
    .map(([key, v]) => {
      const blog = isBlogKey(key);
      const id = blog ? key.slice(BLOG_KEY_PREFIX.length) : key;
      return {
        id: key,
        kind: (blog ? 'blog' : 'product') as PinterestPostRow['kind'],
        title: (blog ? postTitles.get(id) : titles.get(id)) ?? (blog ? '(yazı)' : '(silinmiş ürün)'),
        postedAt: v.postedAt,
        active: blog ? true : activeMap.get(id) ?? false,
        board: v.board,
        link: v.pinId ? `https://www.pinterest.com/pin/${v.pinId}/` : undefined,
        error: v.pinId ? undefined : v.error,
      };
    })
    .sort((a, b) => b.postedAt - a.postedAt);

  return {
    configured: await pinterestConfigured(),
    oauthReady: pinterestOAuthReady(),
    enabled: cfg.enabled,
    connection: await getPinterestConnection(),
    todayCount: channelTodayCount(st.day, st.todayCount, Date.now()),
    dailyLimit: cfg.dailyLimit,
    backlog,
    etaDays: cfg.dailyLimit > 0 ? Math.ceil(backlog / cfg.dailyLimit) : 0,
    lastPostAt: posted.find((p) => !p.error)?.postedAt ?? 0,
    posted,
  };
}

export async function requeuePinterestPostAction(key: string): Promise<void> {
  await requireAdmin();
  await requeuePinterestPost(String(key));
}

export async function setPinterestEnabledAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await setSocialEnabled('pinterest', !!enabled);
}

export interface PinterestPostNowResult { posted: number; errors: string[]; skipped?: string }

/** Panelden: saat penceresini yok sayıp tek bir öğeyi hemen pinler (ilk bağlantı testi için). */
export async function postOnePinterestNowAction(): Promise<PinterestPostNowResult> {
  await requireAdmin();
  const r = await runPinterestCycleWith(Date.now(), { ignoreWindow: true, max: 1 });
  return { posted: r.posted.length, errors: r.errors.map((e) => e.slice(0, 200)), skipped: r.skipped };
}

export async function disconnectPinterestAction(): Promise<void> {
  await requireAdmin();
  await disconnectPinterest();
}
