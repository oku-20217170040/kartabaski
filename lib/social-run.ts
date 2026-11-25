import 'server-only';
import type { CycleResult, PlatformStatus, SocialPlatform } from './social-types';
import { recordRun, logActivity } from './social-settings';
import { runInstagramCycle, getInstagramStatus } from './instagram-auto';
import { runFacebookCycle, getFacebookStatus } from './facebook-auto';
import { runThreadsCycle, getThreadsStatus } from './threads-auto';
import { runTelegramChannelCycle, getTelegramStatus } from './telegram-channel';
import { runPinterestCycle, getPinterestStatus } from './pinterest-auto';
import { runTikTokCycle, getTikTokStatus } from './tiktok-auto';

// Altı platformun otomasyon turları ve durum özeti. Cron rotası ve panel "Şimdi çalıştır" bunu kullanır.

const RUNNERS: [SocialPlatform, () => Promise<CycleResult>][] = [
  ['instagram', () => runInstagramCycle()],
  ['facebook', () => runFacebookCycle()],
  ['threads', () => runThreadsCycle()],
  ['telegram', () => runTelegramChannelCycle()],
  ['pinterest', () => runPinterestCycle()],
  ['tiktok', () => runTikTokCycle()],
];

const STATUSES: [SocialPlatform, () => Promise<PlatformStatus>][] = [
  ['instagram', getInstagramStatus],
  ['facebook', getFacebookStatus],
  ['threads', getThreadsStatus],
  ['telegram', getTelegramStatus],
  ['pinterest', getPinterestStatus],
  ['tiktok', getTikTokStatus],
];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'bilinmeyen hata').slice(0, 200);

/** Kısa tur notu: "2 paylaşım", "atlandı: kapalı", "1 hata". */
export function runNote(r: CycleResult): string {
  if (r.skipped && !r.posted.length) return `atlandı: ${r.skipped}`;
  const parts = [`${r.posted.length} paylaşım`];
  if (r.errors.length) parts.push(`${r.errors.length} hata`);
  return parts.join(', ');
}

/** Altı platformu sırayla çalıştırır; biri patlasa da diğerleri çalışır. Her tur ayar belgesine ve etkinlik günlüğüne işlenir. */
export async function runAllSocialCycles(): Promise<Record<SocialPlatform, CycleResult>> {
  const out = {} as Record<SocialPlatform, CycleResult>;
  for (const [platform, run] of RUNNERS) {
    const now = Date.now();
    let res: CycleResult;
    try {
      res = await run();
    } catch (e) {
      console.error(`[social-run ${platform}]`, e);
      res = { skipped: errMsg(e), posted: [], errors: [errMsg(e)] };
    }
    out[platform] = res;
    await recordRun(platform, runNote(res), now);
    await logActivity(platform, res, now);
  }
  return out;
}

/** Altı platformun durumu; biri okunamazsa o platform "bağlı değil" olarak döner, diğerleri etkilenmez. */
export async function getAllSocialStatus(): Promise<PlatformStatus[]> {
  return Promise.all(
    STATUSES.map(async ([platform, get]) => {
      try {
        return await get();
      } catch (e) {
        console.warn(`[social-run status ${platform}]`, e);
        return { platform, configured: false, enabled: false, detail: `Durum okunamadı: ${errMsg(e)}` } satisfies PlatformStatus;
      }
    })
  );
}
