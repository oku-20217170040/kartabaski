'use server';

import { requireAdmin } from './require-admin';
import { getTitle } from './product-utils';
import { loadTikTokAutoState, requeueTikTokPost, runTikTokCycleWith } from './tiktok-auto';
import { tiktokConfigured, getTikTokState, disconnectTikTok, fetchDisplayName, fetchPublishStatus } from './tiktok';
import { getSocialProducts, toChannelRow, getPlatformGate, setSocialEnabled } from './telegram-channel-data';
import { pickBacklog } from './telegram-channel-utils';
import { pendingInWindow, TIKTOK_PENDING_CAP } from './tiktok-utils';

export interface TikTokPostRow {
  id: string;
  title: string;
  postedAt: number;
  active: boolean;
  publishId?: string;
  error?: string;
}

export interface TikTokOverview {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  displayName?: string;
  connectedAt?: number;
  refreshExpiresAt?: number;
  pending: number; // son 24 saatte bekleyen taslak
  pendingCap: number;
  backlog: number;
  lastPostAt: number;
  posted: TikTokPostRow[];
}

export async function getTikTokOverviewAction(): Promise<TikTokOverview> {
  await requireAdmin();
  const [auto, conn, products, cfg] = await Promise.all([loadTikTokAutoState(), getTikTokState(), getSocialProducts(), getPlatformGate('tiktok')]);
  const backlog = pickBacklog(products.map(toChannelRow), auto.posted, Number.MAX_SAFE_INTEGER).length;
  const titles = new Map(products.map((p) => [p.id, getTitle(p)]));
  const activeMap = new Map(products.map((p) => [p.id, toChannelRow(p).active]));
  const posted: TikTokPostRow[] = Object.entries(auto.posted)
    .map(([id, v]) => ({
      id,
      title: titles.get(id) ?? '(silinmiş ürün)',
      postedAt: v.postedAt,
      active: activeMap.get(id) ?? false,
      publishId: v.publishId,
      error: v.publishId ? undefined : v.error,
    }))
    .sort((a, b) => b.postedAt - a.postedAt);
  return {
    configured: tiktokConfigured(),
    connected: !!conn.accessToken,
    enabled: cfg.enabled,
    displayName: conn.displayName,
    connectedAt: conn.connectedAt,
    refreshExpiresAt: conn.refreshExpiresAt,
    pending: pendingInWindow(auto.posted, Date.now()),
    pendingCap: TIKTOK_PENDING_CAP,
    backlog,
    lastPostAt: posted.find((p) => p.publishId)?.postedAt ?? 0,
    posted,
  };
}

export async function requeueTikTokPostAction(productId: string): Promise<void> {
  await requireAdmin();
  await requeueTikTokPost(String(productId));
}

export async function setTikTokEnabledAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await setSocialEnabled('tiktok', !!enabled);
}

export async function disconnectTikTokAction(): Promise<void> {
  await requireAdmin();
  await disconnectTikTok();
}

export async function checkTikTokConnectionAction(): Promise<{ ok: boolean; name?: string; error?: string }> {
  await requireAdmin();
  try {
    return { ok: true, name: await fetchDisplayName() };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : 'hata').slice(0, 200) };
  }
}

export interface TikTokPostNowResult { posted: number; errors: string[]; skipped?: string }

/** Panelden: saat penceresini yok sayıp tek bir modeli taslak olarak gönderir (ilk bağlantı testi için). */
export async function postOneTikTokNowAction(force = false): Promise<TikTokPostNowResult> {
  await requireAdmin();
  const r = await runTikTokCycleWith(Date.now(), { ignoreWindow: true, max: 1, overrideCap: force });
  return { posted: r.posted.length, errors: r.errors.map((e) => e.slice(0, 200)), skipped: r.skipped };
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING_DOWNLOAD: 'TikTok fotoğrafları indiriyor',
  PROCESSING_UPLOAD: 'TikTok işliyor',
  SEND_TO_USER_INBOX: 'Teslim edildi: TikTok uygulamasında bildirimlere / Taslaklar’a bakın',
  PUBLISH_COMPLETE: 'Yayınlandı',
  FAILED: 'Başarısız',
};

export interface RecentStatusRow { title: string; postedAt: number; ok: boolean; text: string }

/** Son gönderilen taslakların TikTok'taki gerçek durumu (teşhis: "Teslim edildi" mi, "Başarısız: neden" mi). */
export async function checkRecentTikTokStatusesAction(limit = 6): Promise<RecentStatusRow[]> {
  await requireAdmin();
  const [auto, products] = await Promise.all([loadTikTokAutoState(), getSocialProducts()]);
  const titles = new Map(products.map((p) => [p.id, getTitle(p)]));
  const recent = Object.entries(auto.posted)
    .filter(([, v]) => v.publishId)
    .sort((a, b) => b[1].postedAt - a[1].postedAt)
    .slice(0, Math.min(10, Math.max(1, limit)));
  const out: RecentStatusRow[] = [];
  for (const [id, v] of recent) {
    let ok = false;
    let text = '';
    try {
      const s = await fetchPublishStatus(String(v.publishId));
      ok = s.status !== 'FAILED';
      const base = STATUS_LABELS[s.status] ?? s.status;
      text = s.failReason ? `${base}: ${s.failReason}` : base;
    } catch (e) {
      text = (e instanceof Error ? e.message : 'hata').slice(0, 160);
    }
    out.push({ title: titles.get(id) ?? '(silinmiş ürün)', postedAt: v.postedAt, ok, text });
  }
  return out;
}
