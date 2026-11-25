'use server';

import { requireAdmin } from './require-admin';
import { readDailyStats } from './analytics-server';
import { getSearchPerformance, searchConsoleConfigured, type SearchPerformance } from './search-console';
import { getProductsServer } from './products-server';
import { getSlug, getTitle } from './product-utils';
import type { DailyStats } from './analytics-types';
import { sumDays, topEntries } from './analytics-stats';
import { mergeByLabel } from './analytics-view';
import { sourceLabel } from './analytics-utils';

// Firestore Spark kotası için kısa süreli bellek önbelleği (aynı sunucu örneğinde 60 sn).
const CACHE_MS = 60_000;
const cache = new Map<number, { at: number; data: DailyStats[] }>();

async function cachedDaily(days: number): Promise<DailyStats[]> {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await readDailyStats(days);
  cache.set(days, { at: Date.now(), data });
  return data;
}

/** İstatistikler sayfası: bugün dahil son `days` günün günlük özetleri (eskiden yeniye). */
export async function getAnalyticsAction(days: number): Promise<DailyStats[]> {
  await requireAdmin();
  return cachedDaily(days);
}

/** Ürün id/slug → başlık haritası (istatistik tablolarında ürün adı göstermek için). */
export async function getProductTitlesAction(): Promise<Record<string, string>> {
  await requireAdmin();
  const out: Record<string, string> = {};
  for (const p of await getProductsServer()) {
    const title = getTitle(p);
    out[p.id] = title;
    const slug = getSlug(p);
    if (slug) out[slug] = title;
  }
  return out;
}

export interface OverviewStats {
  /** Sayfa görüntüleme sayıları */
  today: number;
  last7: number;
  last30: number;
  /** Son 14 gün (eskiden yeniye): sayfa görüntüleme ve ziyaretçi */
  series: { day: string; views: number; visitors: number }[];
  topProducts: { id: string; title: string; views: number }[];
  sources: { source: string; count: number }[];
  whatsappClicks30: number;
  cartAdds30: number;
}

/** Genel Bakış sayfası için kısa site trafiği özeti (son 30 gün). */
export async function getOverviewStatsAction(): Promise<OverviewStats> {
  await requireAdmin();
  const days = await cachedDaily(30);
  const sum30 = sumDays(days);
  const last7 = days.slice(-7).reduce((s, d) => s + d.pv, 0);

  const top = topEntries(sum30.prod, 5);
  let titles: Record<string, string> = {};
  if (top.length > 0) {
    try {
      for (const p of await getProductsServer()) {
        const t = getTitle(p);
        titles[p.id] = t;
        const slug = getSlug(p);
        if (slug) titles[slug] = t;
      }
    } catch { titles = {}; }
  }

  return {
    today: days[days.length - 1]?.pv ?? 0,
    last7,
    last30: sum30.pv,
    series: days.slice(-14).map((d) => ({ day: d.day, views: d.pv, visitors: d.uv })),
    topProducts: top.map(([id, views]) => ({ id, title: titles[id] ?? id, views })),
    sources: topEntries(mergeByLabel(sum30.ref, sourceLabel), 6).map(([source, count]) => ({ source, count })),
    whatsappClicks30: sum30.ev.whatsapp || 0,
    cartAdds30: sum30.ev.cart_add || 0,
  };
}

export type SearchResult =
  | { ok: true; data: SearchPerformance }
  | { ok: false; error: string; notConnected?: boolean };

/** Search Console arama performansı (7/28/90 gün). Env yoksa "bağlı değil" döner. */
export async function getSearchPerformanceAction(days = 28): Promise<SearchResult> {
  await requireAdmin();
  if (!searchConsoleConfigured()) {
    return { ok: false, notConnected: true, error: 'Search Console bağlı değil: FIREBASE_ADMIN_CLIENT_EMAIL ve FIREBASE_ADMIN_PRIVATE_KEY tanımlı olmalı.' };
  }
  try {
    return { ok: true, data: await getSearchPerformance(days) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Search Console okunamadı' };
  }
}
