'use server';

import { requireAdmin } from './require-admin';
import type { CycleResult, PlatformStatus, SocialPlatform } from './social-types';
import { runAllSocialCycles, getAllSocialStatus } from './social-run';
import { getSocialSettings, setSocialSettings, listActivity, type SocialActivity } from './social-settings';
import { PLATFORMS, type SocialSettings } from './social-settings-utils';
import { getSocialRows } from './social-products';

// Merkez sayfası (/admin/sosyal-medya) eylemleri. Tümü admin yetkisi ister.

/** Altı platformun otomasyon turunu şimdi bir kez çalıştırır (cron ile aynı mantık). */
export async function runSocialCycleNowAction(): Promise<Record<SocialPlatform, CycleResult>> {
  await requireAdmin();
  return runAllSocialCycles();
}

/** Altı platformun durum özeti. */
export async function getSocialStatusAction(): Promise<PlatformStatus[]> {
  await requireAdmin();
  return getAllSocialStatus();
}

export interface SocialActivityRow extends SocialActivity {
  labels: string[]; // paylaşılan öğelerin okunur adları
}

export interface SocialHub {
  statuses: PlatformStatus[];
  settings: Record<SocialPlatform, SocialSettings>;
  activity: SocialActivityRow[];
}

/** Merkez sayfası için tek çağrıda: durumlar + ayarlar + canlı akış. */
export async function getSocialHubAction(): Promise<SocialHub> {
  await requireAdmin();
  const [statuses, activity, rows] = await Promise.all([
    getAllSocialStatus(),
    listActivity(30).catch((): SocialActivity[] => []),
    getSocialRows().catch(() => []),
  ]);
  const settings = {} as Record<SocialPlatform, SocialSettings>;
  await Promise.all(PLATFORMS.map(async (p) => { settings[p] = await getSocialSettings(p); }));
  const titles = new Map(rows.map((r) => [r.id, r.title]));
  const label = (id: string) =>
    titles.get(id) ?? (id.startsWith('blog:') ? 'Blog yazısı' : id.startsWith('campaign:') ? 'Özel gün kampanyası' : id.slice(0, 24));
  return { statuses, settings, activity: activity.map((a) => ({ ...a, labels: a.posted.map(label) })) };
}

/** Platform otomasyonunu aç/kapat. */
export async function setSocialEnabledAction(platform: SocialPlatform, enabled: boolean): Promise<SocialSettings> {
  await requireAdmin();
  if (!PLATFORMS.includes(platform)) throw new Error('Geçersiz platform');
  return setSocialSettings(platform, { enabled });
}

/** Günlük kota ve saat aralığı gibi ayarları kaydet (doğrulanıp sınırlanır). */
export async function updateSocialSettingsAction(platform: SocialPlatform, patch: Partial<SocialSettings>): Promise<SocialSettings> {
  await requireAdmin();
  if (!PLATFORMS.includes(platform)) throw new Error('Geçersiz platform');
  return setSocialSettings(platform, patch);
}
