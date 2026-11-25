// TikTok için saf yardımcılar (testli). Ağ ve veri erişimi lib/tiktok.ts ve lib/tiktok-auto.ts'te.
import type { ChannelRow } from './telegram-channel-utils';
import { socialHashtags } from './telegram-channel-utils';

export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_SCOPES = 'user.info.basic,video.upload';
export const TIKTOK_TITLE_MAX = 90; // karusel başlığı
export const TIKTOK_DESC_MAX = 4000; // karusel açıklaması
export const TIKTOK_MAX_PHOTOS = 35;
/** TikTok'un doğrulanmış URL öneki altında sunulan fotoğraf ara adresi (Content Posting PULL_FROM_URL). */
export const TIKTOK_MEDIA_PATH = '/api/tiktok/media';

/** Yetkilendirme adresi: state, geri dönüşte CSRF kontrolü için çerezle karşılaştırılır. */
export function buildAuthUrl(opts: { clientKey: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_key: opts.clientKey,
    scope: TIKTOK_SCOPES,
    response_type: 'code',
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `${TIKTOK_AUTH_URL}?${q.toString()}`;
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s);

/** Karusel başlığı: model adı ve fiyat, 90 karakteri geçmez. */
export function tiktokTitle(title: string, priceText: string): string {
  const price = ` · ${priceText}`;
  return `${cut(title.trim(), Math.max(10, TIKTOK_TITLE_MAX - price.length))}${price}`;
}

/** Karusel açıklaması: fiyat, açıklama, teslimat, WhatsApp/site çağrısı ve hashtag; 4000 karakteri geçmez, alt bilgi her zaman kalır. */
export function tiktokDescription(opts: {
  priceText: string;
  category: string;
  description: string;
  deliveryDays?: number;
  url: string;
  phoneDisplay: string;
}): string {
  const header = `${opts.priceText} · ${opts.category}`;
  const tags = socialHashtags(opts.category, ['hediye', 'kupa'], 8).join(' ');
  const footer = `\n\nKişiye özel baskı${opts.deliveryDays ? ` · ${opts.deliveryDays} iş günü teslimat` : ''}\nWhatsApp ile sipariş: ${opts.phoneDisplay}\n${opts.url}\n${tags}`;
  const desc = opts.description.replace(/\r/g, '').trim();
  const room = TIKTOK_DESC_MAX - header.length - footer.length - 2;
  const body = cut(desc, Math.max(0, room));
  return `${header}${body ? `\n\n${body}` : ''}${footer}`;
}

/** TikTok fotoğraf taslağı (inbox) istek gövdesi: URL'ler doğrulanmış alan ön ekinden olmalıdır. */
export function buildPhotoDraftBody(opts: { title: string; description: string; photoUrls: string[] }) {
  const photos = opts.photoUrls.slice(0, TIKTOK_MAX_PHOTOS);
  if (photos.length === 0) throw new Error('TikTok için fotoğraf yok');
  return {
    media_type: 'PHOTO',
    post_mode: 'MEDIA_UPLOAD',
    post_info: { title: opts.title, description: opts.description },
    source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: photos },
  };
}

/** Fotoğraf ara adresi: yalnızca kendi Cloudinary klasörlerimizdeki (urunler/studio/sosyal) görsel kimlikleri kabul edilir. */
const MEDIA_ID_RE = /^karta-baski\/(?:urunler|studio|sosyal)\/[A-Za-z0-9_-]{3,120}$/;
export function isAllowedMediaId(id: string): boolean {
  return MEDIA_ID_RE.test(id);
}

/** Cloudinary kimliği ↔ güvenli yol parçası (eğik çizgi → "~"): /api/tiktok/media/<yol>.jpg */
export const mediaIdToPath = (id: string) => id.replace(/\//g, '~');
export const pathToMediaId = (path: string) => path.replace(/\.jpe?g$/i, '').replace(/~/g, '/');

export function proxyPhotoUrl(siteUrl: string, publicId: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${TIKTOK_MEDIA_PATH}/${mediaIdToPath(publicId)}.jpg`;
}

/** /api/tiktok/media/ yolunu çözer; geçersizse null. */
export function parseMediaPath(segments: string[]): string | null {
  const segs = segments.map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const id = pathToMediaId(segs.join('~'));
  return isAllowedMediaId(id) ? id : null;
}

/** TikTok belgesi: bir hesapta 24 saat içinde en fazla 5 bekleyen (yayınlanmamış) API taslağı olabilir. */
export const TIKTOK_PENDING_CAP = 5;

/** Son 24 saatte gönderilen ve bekleyen sayılan taslaklar (yayınlanıp yayınlanmadığını bilemeyiz, hepsi bekleyen sayılır). */
export function pendingInWindow(posted: Record<string, { postedAt: number; publishId?: string }>, now: number, windowMs = 24 * 3600 * 1000): number {
  return Object.values(posted).filter((v) => v.publishId && now - v.postedAt < windowMs).length;
}

export const pendingRoom = (posted: Record<string, { postedAt: number; publishId?: string }>, now: number, cap = TIKTOK_PENDING_CAP) =>
  Math.max(0, cap - pendingInWindow(posted, now));

/** Karusel görselleri (en fazla `max`): yalnızca izinli Cloudinary kimlikleri, doğrulanmış alan adı üzerinden. */
export function tiktokPhotoUrls(siteUrl: string, imageIds: unknown[], max = 10): string[] {
  return imageIds
    .filter((x): x is string => typeof x === 'string' && isAllowedMediaId(x))
    .slice(0, Math.max(1, max))
    .map((id) => proxyPhotoUrl(siteUrl, id));
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Tohumla deterministik karıştırma (aynı tohum aynı sıra). */
export function shuffleBy<T>(list: T[], seed: string, key: (x: T) => string): T[] {
  return [...list].sort((a, b) => hashStr(seed + key(a)) - hashStr(seed + key(b)));
}

/** Henüz gönderilmemiş katalogdan rastgele havuz: gün anahtarıyla deterministik karıştırma (aynı gün aynı sıra). */
export function pickRandomBacklog(rows: ChannelRow[], posted: Record<string, unknown>, limit: number, seed: string): ChannelRow[] {
  const pool = rows.filter((r) => r.active && r.hasImage && !posted[r.id]);
  return shuffleBy(pool, seed, (r) => r.id).slice(0, Math.max(0, limit));
}
