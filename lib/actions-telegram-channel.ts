'use server';

import { requireAdmin } from './require-admin';
import { getTitle } from './product-utils';
import {
  loadChannelState, requeueChannelPost, channelConfigured, channelRef, runTelegramCycleWith,
} from './telegram-channel';
import { getSocialProducts, getSocialPosts, toChannelRow, getPlatformGate, setSocialEnabled } from './telegram-channel-data';
import { pickBacklog, channelTodayCount, channelPostLink, isBlogKey, BLOG_KEY_PREFIX } from './telegram-channel-utils';

export interface TgPostRow {
  id: string;
  kind: 'product' | 'blog';
  title: string;
  postedAt: number;
  active: boolean;
  closed: boolean;
  link?: string;
  error?: string;
}

export interface TgOverview {
  configured: boolean;
  enabled: boolean;
  todayCount: number;
  dailyLimit: number;
  backlog: number;
  etaDays: number;
  lastPostAt: number;
  channel: string;
  posted: TgPostRow[];
}

export async function getTelegramChannelOverviewAction(): Promise<TgOverview> {
  await requireAdmin();
  const [st, products, posts, cfg] = await Promise.all([loadChannelState(), getSocialProducts(), getSocialPosts(), getPlatformGate('telegram')]);
  const backlog = pickBacklog(products.map(toChannelRow), st.posted, Number.MAX_SAFE_INTEGER).length;
  const titles = new Map(products.map((p) => [p.id, getTitle(p)]));
  const activeMap = new Map(products.map((p) => [p.id, toChannelRow(p).active]));
  const postTitles = new Map(posts.map((p) => [p.id, p.title]));
  const chat = channelRef();

  const posted: TgPostRow[] = Object.entries(st.posted)
    .map(([key, v]) => {
      const blog = isBlogKey(key);
      const id = blog ? key.slice(BLOG_KEY_PREFIX.length) : key;
      return {
        id: key,
        kind: (blog ? 'blog' : 'product') as TgPostRow['kind'],
        title: (blog ? postTitles.get(id) : titles.get(id)) ?? (blog ? '(yazı)' : '(silinmiş ürün)'),
        postedAt: v.postedAt,
        active: blog ? true : activeMap.get(id) ?? false,
        closed: !!v.closed,
        link: channelPostLink(chat, v.messageId),
        error: v.messageId ? undefined : v.error,
      };
    })
    .sort((a, b) => b.postedAt - a.postedAt);

  return {
    configured: channelConfigured(),
    enabled: cfg.enabled,
    todayCount: channelTodayCount(st.day, st.todayCount, Date.now()),
    dailyLimit: cfg.dailyLimit,
    backlog,
    etaDays: cfg.dailyLimit > 0 ? Math.ceil(backlog / cfg.dailyLimit) : 0,
    lastPostAt: Object.values(st.posted).reduce((m, v) => (v.messageId && v.postedAt > m ? v.postedAt : m), 0),
    channel: chat ?? '',
    posted,
  };
}

/** Hatalı gönderiyi kuyruğa geri alır (sıradaki turda yeniden gönderilir). */
export async function requeueTelegramPostAction(key: string): Promise<void> {
  await requireAdmin();
  await requeueChannelPost(String(key));
}

export async function setTelegramEnabledAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await setSocialEnabled('telegram', !!enabled);
}

export interface PostNowResult { posted: number; errors: string[]; skipped?: string }

/** Panelden: saat penceresini yok sayıp tek bir gönderiyi hemen kanala yollar (ilk bağlantı testi için). */
export async function postOneTelegramNowAction(): Promise<PostNowResult> {
  await requireAdmin();
  const r = await runTelegramCycleWith(Date.now(), { ignoreWindow: true, max: 1 });
  return { posted: r.posted.length, errors: r.errors.map((e) => e.slice(0, 200)), skipped: r.skipped };
}
