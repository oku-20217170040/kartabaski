'use server';

import { requireAdmin } from './require-admin';
import { getSocialRows } from './social-products';
import { getSocialSettings } from './social-settings';
import { pickQueue } from './social-content-utils';
import { formatPriceRange } from './format';
import { getFacebookConfig, facebookWhoAmI } from './facebook-page';
import { loadState, retryFacebookPostNow, shareFacebookProductNow, runFacebookCycle } from './facebook-auto';
import { todayCountFor } from './facebook-auto-utils';
import type { SocialSettings } from './social-settings-utils';

export interface FbAutoPostRow {
  id: string;
  title: string;
  postId?: string;
  postedAt: number;
  active: boolean;
  priceLabel: string;
  error?: string;
}

export interface FbAutoOverview {
  configured: boolean;
  account?: string;
  accountError?: string;
  settings: SocialSettings;
  startedAt: number;
  todayCount: number;
  lastPostAt: number;
  backlog: number;
  etaDays: number;
  posted: FbAutoPostRow[];
  /** "Şimdi paylaş" için: aktif, fotoğraflı, henüz paylaşılmamış modeller */
  candidates: { id: string; title: string }[];
}

/** Hatalı Facebook paylaşımını hemen yeniden dener (ör. fotoğraf eklendikten sonra). */
export async function retryFacebookPostAction(productId: string): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  return retryFacebookPostNow(productId);
}

/** Seçilen modeli kuyruğu beklemeden Facebook sayfasında paylaşır. */
export async function shareFacebookProductNowAction(productId: string): Promise<{ ok: boolean; reason?: string }> {
  await requireAdmin();
  return shareFacebookProductNow(productId);
}

/** Facebook turunu (blog, kampanya, kuyruk) şimdi bir kez çalıştırır. */
export async function runFacebookNowAction(): Promise<{ posted: number; errors: string[]; skipped?: string }> {
  await requireAdmin();
  const r = await runFacebookCycle();
  return { posted: r.posted.length, errors: r.errors.slice(0, 5), skipped: r.skipped };
}

/** Facebook otomasyonunun durumu: bugünkü sayı, kalan ürün, son paylaşımlar. */
export async function getFacebookAutoOverviewAction(checkAccount = false): Promise<FbAutoOverview> {
  await requireAdmin();
  const [st, rows, settings] = await Promise.all([loadState(), getSocialRows(), getSocialSettings('facebook', true)]);
  const now = Date.now();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const queue = pickQueue(rows, st.posted, now);
  const configured = !!getFacebookConfig();
  const who = checkAccount && configured ? await facebookWhoAmI() : null;
  const posted: FbAutoPostRow[] = Object.entries(st.posted)
    .map(([id, v]) => {
      const cur = byId.get(id);
      return {
        id,
        title: cur?.title ?? '(silinmiş ürün)',
        postId: v.postId,
        postedAt: v.postedAt,
        active: cur?.active ?? false,
        priceLabel: cur ? formatPriceRange(cur.priceMin, cur.priceMax) : '—',
        error: v.postId ? undefined : v.error,
      };
    })
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, 60);
  return {
    configured,
    account: who?.ok ? who.name : undefined,
    accountError: who && !who.ok ? who.error : undefined,
    settings,
    startedAt: st.startedAt,
    todayCount: todayCountFor(st, now),
    lastPostAt: Math.max(0, ...Object.values(st.posted).filter((v) => v.postId).map((v) => v.postedAt)),
    backlog: queue.length,
    etaDays: settings.dailyLimit ? Math.ceil(queue.length / settings.dailyLimit) : 0,
    posted,
    candidates: queue.filter((r) => !st.posted[r.id]).slice(0, 100).map((r) => ({ id: r.id, title: r.title })),
  };
}
