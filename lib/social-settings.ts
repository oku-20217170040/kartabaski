import 'server-only';
import { adminDb } from './firebase-admin';
import type { SocialPlatform } from './social-types';
import { normalizeSettings, sanitizePatch, type SocialSettings } from './social-settings-utils';

// Platform ayarları: Firestore `social_settings/{platform}` (açık/kapalı, günlük kota, saat aralığı, son çalışma).
// Platforma özel durum (başlangıç zamanı, paylaşılan blog/kampanya kayıtları): `social_meta/{platform}`.
// Okuma kotasını korumak için ayarlar sunucu belleğinde kısa süre önbelleğe alınır.

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: SocialSettings }>();
const ref = (platform: SocialPlatform) => adminDb.collection('social_settings').doc(platform);

export async function getSocialSettings(platform: SocialPlatform, fresh = false): Promise<SocialSettings> {
  const hit = cache.get(platform);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = normalizeSettings(platform, (await ref(platform).get()).data());
  cache.set(platform, { at: Date.now(), value });
  return value;
}

/** Doğrulanmış kısmi güncelleme; yeni ayarı döndürür. */
export async function setSocialSettings(platform: SocialPlatform, patch: Partial<SocialSettings>): Promise<SocialSettings> {
  const clean = sanitizePatch(platform, patch);
  if (Object.keys(clean).length) await ref(platform).set(clean, { merge: true });
  cache.delete(platform);
  return getSocialSettings(platform, true);
}

/** Son çalışma zamanı ve kısa not (ör. "2 gönderi", "atlandı: kapalı"). Hata fırlatmaz. */
export async function recordRun(platform: SocialPlatform, note: string, now = Date.now()): Promise<void> {
  try {
    await ref(platform).set({ lastRunAt: now, lastRunNote: note.slice(0, 200) }, { merge: true });
    cache.delete(platform);
  } catch (e) {
    console.warn('[social-settings] recordRun', e);
  }
}

// ── Platform üst verisi ──────────────────────────────────────────────────────

export interface SocialMeta {
  startedAt: number; // otomasyonun ilk çalıştığı an (öncesindeki blog yazıları toplu basılmaz)
  blogShared: Record<string, number>; // blog yazısı id → paylaşım zamanı
  campaigns: Record<string, number>; // kampanya anahtarı → son paylaşım zamanı
}

const metaRef = (platform: SocialPlatform) => adminDb.collection('social_meta').doc(platform);

export async function getSocialMeta(platform: SocialPlatform): Promise<SocialMeta> {
  const d = (await metaRef(platform).get()).data() ?? {};
  return {
    startedAt: Number(d.startedAt) || 0,
    blogShared: (d.blogShared ?? {}) as Record<string, number>,
    campaigns: (d.campaigns ?? {}) as Record<string, number>,
  };
}

export async function patchSocialMeta(platform: SocialPlatform, patch: Partial<SocialMeta>): Promise<void> {
  await metaRef(platform).set(patch, { merge: true });
}

/** İlk çalışmada başlangıç zamanını yazar ve meta'yı döndürür. */
export async function ensureSocialMeta(platform: SocialPlatform, now: number): Promise<SocialMeta> {
  const m = await getSocialMeta(platform);
  if (!m.startedAt) {
    await patchSocialMeta(platform, { startedAt: now });
    m.startedAt = now;
  }
  return m;
}

// ── Etkinlik günlüğü (Merkez sayfasındaki canlı akış) ─────────────────────────

export interface SocialActivity {
  id: string;
  platform: SocialPlatform;
  at: number;
  posted: string[]; // ürün / `blog:<id>` / `campaign:<anahtar>` kimlikleri
  errors: string[];
  skipped?: string;
}

const logCol = () => adminDb.collection('social_log');

/** Bir tur etkinlik (paylaşım ya da hata) içeriyorsa günlüğe yazar. Hata fırlatmaz. */
export async function logActivity(platform: SocialPlatform, r: { posted: string[]; errors: string[]; skipped?: string }, now = Date.now()): Promise<void> {
  if (!r.posted.length && !r.errors.length) return;
  try {
    await logCol().add({
      platform, at: now,
      posted: r.posted.slice(0, 10).map(String),
      errors: r.errors.slice(0, 5).map((e) => String(e).slice(0, 200)),
    });
  } catch (e) {
    console.warn('[social-settings] logActivity', e);
  }
}

export async function listActivity(limit = 30): Promise<SocialActivity[]> {
  const snap = await logCol().orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      platform: v.platform as SocialPlatform,
      at: Number(v.at) || 0,
      posted: Array.isArray(v.posted) ? v.posted.map(String) : [],
      errors: Array.isArray(v.errors) ? v.errors.map(String) : [],
    };
  });
}
