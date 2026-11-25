import 'server-only';
import { getProductsServer } from './products-server';
import { getActive, getPriceMin, getPriceMax, getFirstImageId } from './product-utils';
import type { Product } from '@/types';
import type { Post } from './posts-types';
import type { ChannelRow, BlogRow } from './telegram-channel-utils';
import type { SocialPlatform } from './social-types';
import { getSocialSettings, setSocialSettings } from './social-settings';
import type { GateConfig } from './telegram-channel-utils';

// Üç sosyal modülün (Telegram/Pinterest/TikTok) ortak veri katmanı: kısa süreli bellek önbelleği (Firestore Spark kotası)
// ve social_settings/{platform} ayarları (lib/social-settings.ts: açık/kapalı, günlük kota, saat penceresi).

const TTL_MS = 5 * 60 * 1000;
let productsCache: { at: number; list: Product[] } | null = null;
let postsCache: { at: number; list: Post[] } | null = null;

export async function getSocialProducts(): Promise<Product[]> {
  const now = Date.now();
  if (productsCache && now - productsCache.at < TTL_MS) return productsCache.list;
  const list = await getProductsServer();
  productsCache = { at: now, list };
  return list;
}

/** Yayındaki blog yazıları (lib/posts.ts başka modülce yazılır; yoksa/okunamazsa boş döner). */
export async function getSocialPosts(limit = 30): Promise<Post[]> {
  const now = Date.now();
  if (postsCache && now - postsCache.at < TTL_MS) return postsCache.list;
  let list: Post[] = [];
  try {
    const mod = await import('@/lib/posts');
    list = (await mod.listPublishedPosts(limit)) as Post[];
  } catch (e) {
    console.warn('[social] blog yazıları okunamadı', e instanceof Error ? e.message : e);
  }
  postsCache = { at: now, list };
  return list;
}

export const toChannelRow = (p: Product): ChannelRow => ({
  id: p.id,
  createdAt: p.createdAt ?? 0,
  active: getActive(p),
  priceMin: getPriceMin(p),
  priceMax: getPriceMax(p),
  hasImage: !!getFirstImageId(p),
});

export const toBlogRow = (p: Post): BlogRow => ({
  id: p.id,
  publishedAt: p.publishedAt ?? 0,
  hasCover: !!p.coverImage,
  published: p.published !== false,
});

// ── social_settings/{platform} ───────────────────────────────────────────────

/** Otomasyon ayarı: açık/kapalı + günlük kota + saat penceresi (varsayılan: kapalı; panelden açılır). */
export async function getPlatformGate(platform: SocialPlatform): Promise<GateConfig & { enabled: boolean }> {
  const s = await getSocialSettings(platform);
  return { enabled: s.enabled, dailyLimit: s.dailyLimit, windowStart: s.windowStart, windowEnd: s.windowEnd };
}

export async function setSocialEnabled(platform: SocialPlatform, enabled: boolean): Promise<void> {
  await setSocialSettings(platform, { enabled });
}
