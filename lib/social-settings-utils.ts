// Sosyal medya platform ayarları için saf yardımcılar (testli). Firestore erişimi lib/social-settings.ts'te.
import type { SocialPlatform } from './social-types';
import { trHour } from './tr-time';

/** Firestore `social_settings/{platform}` belgesinin biçimi. */
export interface SocialSettings {
  enabled: boolean; // panelden otomasyon açık mı
  dailyLimit: number; // günlük gönderi kotası
  storyLimit: number; // günlük hikâye kotası (yalnız Instagram)
  windowStart: number; // TSİ saat, dahil
  windowEnd: number; // TSİ saat, hariç
  lastRunAt?: number;
  lastRunNote?: string;
}

export const PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'threads', 'telegram', 'pinterest', 'tiktok'];

export const SETTINGS_DEFAULTS: Record<'instagram' | 'facebook' | 'threads', SocialSettings> = {
  instagram: { enabled: false, dailyLimit: 2, storyLimit: 3, windowStart: 10, windowEnd: 21 },
  facebook: { enabled: false, dailyLimit: 3, storyLimit: 0, windowStart: 10, windowEnd: 21 },
  threads: { enabled: false, dailyLimit: 3, storyLimit: 0, windowStart: 10, windowEnd: 21 },
};

/** Her platform için izin verilen en yüksek günlük gönderi / hikâye sayısı. */
export const LIMIT_MAX = { dailyLimit: 10, storyLimit: 10 } as const;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

export function defaultSettings(platform: SocialPlatform): SocialSettings {
  return { ...(SETTINGS_DEFAULTS[platform as keyof typeof SETTINGS_DEFAULTS] ?? SETTINGS_DEFAULTS.facebook) };
}

/** Ham Firestore verisini geçerli ayara çevirir: eksik/bozuk alanlar varsayılana düşer, sayılar sınırlanır. */
export function normalizeSettings(platform: SocialPlatform, raw: Record<string, unknown> | undefined | null): SocialSettings {
  const def = defaultSettings(platform);
  const d = raw ?? {};
  const start = clampInt(num(d.windowStart) ?? def.windowStart, 0, 23);
  let end = clampInt(num(d.windowEnd) ?? def.windowEnd, 1, 24);
  if (end <= start) end = Math.min(24, start + 1);
  return {
    enabled: d.enabled === true,
    dailyLimit: clampInt(num(d.dailyLimit) ?? def.dailyLimit, 0, LIMIT_MAX.dailyLimit),
    storyLimit: clampInt(num(d.storyLimit) ?? def.storyLimit, 0, LIMIT_MAX.storyLimit),
    windowStart: start,
    windowEnd: end,
    lastRunAt: num(d.lastRunAt),
    lastRunNote: typeof d.lastRunNote === 'string' ? d.lastRunNote : undefined,
  };
}

/** Panelden gelen kısmi değişikliği doğrulayıp yalnızca izin verilen alanlarla döndürür. */
export function sanitizePatch(platform: SocialPlatform, patch: Partial<SocialSettings>): Partial<SocialSettings> {
  const cur = normalizeSettings(platform, { ...patch });
  const out: Partial<SocialSettings> = {};
  if (typeof patch.enabled === 'boolean') out.enabled = patch.enabled;
  if (patch.dailyLimit !== undefined) out.dailyLimit = cur.dailyLimit;
  if (patch.storyLimit !== undefined) out.storyLimit = cur.storyLimit;
  if (patch.windowStart !== undefined || patch.windowEnd !== undefined) {
    out.windowStart = cur.windowStart;
    out.windowEnd = cur.windowEnd;
  }
  return out;
}

/** `now` ayarlı saat penceresinin (TSİ) içinde mi? */
export function inWindow(s: Pick<SocialSettings, 'windowStart' | 'windowEnd'>, now: number): boolean {
  const h = trHour(now);
  return h >= s.windowStart && h < s.windowEnd;
}

export const windowLabel = (s: Pick<SocialSettings, 'windowStart' | 'windowEnd'>) =>
  `${String(s.windowStart).padStart(2, '0')}:00–${String(s.windowEnd).padStart(2, '0')}:00 TSİ`;
