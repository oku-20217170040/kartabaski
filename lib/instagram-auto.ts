import 'server-only';
import type { CycleResult, PlatformStatus } from './social-types';
import { getSocialSettings } from './social-settings';
import { isConnected, refreshTokenIfNeeded, getConnection } from './instagram';
import { ensureDailyPlan, ensureBlogDraft, expireStaleDrafts, publishDue, listPostsBetween } from './instagram-posts';

/**
 * Instagram otomasyon turu (cron + panelden "Şimdi çalıştır"):
 * token yenile → günlük plan (karusel + hikâye + kampanya) → yeni blog yazısı taslağı → eski taslakları temizle
 * → zamanı gelen taslakları yayınla. Token yoksa ya da otomasyon kapalıysa zararsızca atlanır.
 * Taslaklar, açık/kapalı ve kotalar için bkz. `instagram-posts.ts` ve `social_settings/instagram`.
 */
const DAY = 24 * 3600 * 1000;

export async function runInstagramCycle(now = Date.now()): Promise<CycleResult> {
  const result: CycleResult = { posted: [], errors: [], planCreated: 0, blogDrafts: 0 };
  if (!(await isConnected())) return { ...result, skipped: 'Instagram bağlı değil (INSTAGRAM_ACCESS_TOKEN tanımlı değil)' };
  const s = await getSocialSettings('instagram');
  if (!s.enabled) return { ...result, skipped: 'otomasyon kapalı' };

  const token = await refreshTokenIfNeeded();
  if (token.error && token.error !== 'token yok') result.errors.push(`token: ${token.error.slice(0, 160)}`);

  try {
    const plan = await ensureDailyPlan(now);
    result.planCreated = plan.created;
    const blog = await ensureBlogDraft(now);
    result.blogDrafts = blog.created;
    await expireStaleDrafts(now);
  } catch (e) {
    result.errors.push(`plan: ${e instanceof Error ? e.message.slice(0, 160) : 'hata'}`);
  }

  try {
    const pub = await publishDue(now);
    result.posted = pub.published;
    result.errors.push(...pub.errors);
  } catch (e) {
    result.errors.push(`yayın: ${e instanceof Error ? e.message.slice(0, 160) : 'hata'}`);
  }
  return result;
}

export async function getInstagramStatus(): Promise<PlatformStatus> {
  const now = Date.now();
  const [configured, s, conn, recent, upcoming] = await Promise.all([
    isConnected(),
    getSocialSettings('instagram'),
    getConnection().catch(() => ({} as Awaited<ReturnType<typeof getConnection>>)),
    listPostsBetween(now - 7 * DAY, now + 1, 200).catch(() => []),
    listPostsBetween(now, now + 3 * DAY, 200).catch(() => []),
  ]);
  const lastPostAt = recent.filter((p) => p.status === 'yayinlandi').reduce((m, p) => Math.max(m, p.publishAt), 0) || undefined;
  const failed = recent.filter((p) => p.status === 'hata').length;
  const daysLeft = conn.tokenExpiresAt ? Math.floor((conn.tokenExpiresAt - now) / DAY) : undefined;
  let detail = s.lastRunNote;
  if (!configured) detail = 'INSTAGRAM_ACCESS_TOKEN tanımlı değil';
  else if (daysLeft !== undefined && daysLeft < 7) detail = `Token ${Math.max(0, daysLeft)} gün içinde bitiyor`;
  else if (failed) detail = `Son 7 günde ${failed} başarısız paylaşım`;
  return {
    platform: 'instagram',
    configured,
    enabled: s.enabled,
    lastRunAt: s.lastRunAt,
    lastPostAt,
    queued: upcoming.filter((p) => p.status === 'taslak').length,
    detail,
  };
}
