import { trDayKey, trHour } from './tr-time';
// Sosyal kanallar (Telegram, Pinterest, TikTok) için ortak saf yardımcılar (testli).
// Ağ ve veri erişimi lib/telegram-channel.ts ve lib/*-auto.ts dosyalarındadır.

export const CHANNEL_PER_RUN = 3; // tek cron turunda en fazla gönderi
export const CHANNEL_DAILY_LIMIT = 10; // platform başına günde en fazla gönderi (ürün + yazı)
export const CHANNEL_WINDOW_START_HOUR = 11; // TSİ, dahil
export const CHANNEL_WINDOW_END_HOUR = 21; // TSİ, hariç
export const UPDATES_PER_RUN = 10; // tek turda en fazla düzenlenen gönderi
export const CAPTION_MAX = 1000; // Telegram fotoğraf altyazısı sınırı 1024; güvenli pay bırakılır
export const BLOG_KEY_PREFIX = 'blog:'; // durum belgesinde blog yazıları bu önekle tutulur

export interface ChannelRow {
  id: string;
  createdAt: number;
  active: boolean;
  priceMin: number;
  priceMax: number;
  hasImage: boolean;
}

export interface ChannelPosted {
  postedAt: number;
  messageId?: number;
  priceMin?: number; // gönderildiği andaki fiyat aralığı: değişince gönderi güncellenir
  priceMax?: number;
  closed?: boolean; // ürün pasife alındığı için gönderi "artık satışta değil" olarak güncellendi
  error?: string;
}

export const blogKey = (postId: string) => `${BLOG_KEY_PREFIX}${postId}`;
export const isBlogKey = (key: string) => key.startsWith(BLOG_KEY_PREFIX);

/**
 * Henüz gönderilmemiş yeni ürünler (otomasyon başladıktan sonra eklenenler), eskiden yeniye.
 * Geçmiş katalog toplu basılmaz: yalnızca startedAt'ten sonra eklenenler.
 */
export function pickNewPosts(rows: ChannelRow[], posted: Record<string, unknown>, startedAt: number, limit = CHANNEL_PER_RUN): ChannelRow[] {
  return rows
    .filter((r) => r.active && r.hasImage && r.createdAt > startedAt && !posted[r.id])
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, limit));
}

/** Mevcut katalogdan henüz gönderilmemiş ürünler: en yeni önce (geriye dönük kuyruk). */
export function pickBacklog(rows: ChannelRow[], posted: Record<string, unknown>, limit: number): ChannelRow[] {
  return rows
    .filter((r) => r.active && r.hasImage && !posted[r.id])
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(0, limit));
}

/** Kuyruk: önce yeni eklenenler, sonra geriye dönük katalog; tekrar yok, sınır uygulanır. */
export function buildQueue(rows: ChannelRow[], posted: Record<string, unknown>, startedAt: number, limit: number): ChannelRow[] {
  const queue: ChannelRow[] = [];
  const seen = new Set<string>();
  for (const r of [...pickNewPosts(rows, posted, startedAt, limit), ...pickBacklog(rows, posted, limit)]) {
    if (seen.has(r.id) || queue.length >= limit) continue;
    seen.add(r.id);
    queue.push(r);
  }
  return queue;
}

export interface BlogRow { id: string; publishedAt: number; hasCover: boolean; published: boolean }

/** Yayında olup otomasyon başladıktan sonra çıkan, henüz gönderilmemiş blog yazıları (eskiden yeniye). */
export function pickNewBlog(posts: BlogRow[], posted: Record<string, unknown>, startedAt: number, limit = CHANNEL_PER_RUN): BlogRow[] {
  return posts
    .filter((p) => p.published && p.hasCover && p.publishedAt > startedAt && !posted[blogKey(p.id)])
    .sort((a, b) => a.publishedAt - b.publishedAt)
    .slice(0, Math.max(0, limit));
}

export interface ChannelUpdate { id: string; reason: 'closed' | 'price' }

/**
 * Kanaldaki mevcut gönderilerden güncellenmesi gerekenler: ürün pasife alındıysa (bir kez) veya fiyat aralığı değiştiyse.
 * Silinmiş ürünler, blog yazıları ve mesajı olmayan kayıtlar atlanır.
 */
export function pickChannelUpdates(rows: ChannelRow[], posted: Record<string, ChannelPosted>, limit: number): ChannelUpdate[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ChannelUpdate[] = [];
  for (const [id, v] of Object.entries(posted)) {
    if (isBlogKey(id) || !v.messageId || v.closed) continue;
    const r = byId.get(id);
    if (!r) continue;
    if (!r.active) out.push({ id, reason: 'closed' });
    else if (typeof v.priceMin === 'number' && (v.priceMin !== r.priceMin || (typeof v.priceMax === 'number' && v.priceMax !== r.priceMax))) {
      out.push({ id, reason: 'price' });
    }
  }
  return out.slice(0, Math.max(0, limit));
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => escHtml(s).replace(/"/g, '&quot;');

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s);

/** Boşluk ve noktalama içermeyen hashtag: "Büyük Kupa" → "#büyükkupa". */
export function toHashtag(s: string): string {
  const w = s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');
  return w ? `#${w}` : '';
}

const CATEGORY_TAGS: Record<string, string[]> = {
  'seramik kahve fincanı': ['#kahvefincanı', '#seramikfincan'],
  'lüks kupa': ['#lüksküpa', '#hediyekupa'],
  'kahve fincanı': ['#kahvefincanı', '#fincan'],
  'latte fincanı': ['#lattefincanı', '#latte'],
  'pro kupa': ['#prokupa', '#sublimasyon'],
  'büyük kupa': ['#büyükkupa', '#xlkupa'],
  'sihirli kupa': ['#sihirlikupa', '#ısıdeğiştirenkupa'],
  'özel tasarım': ['#özeltasarım', '#tasarımkupa'],
  'kurumsal': ['#kurumsalhediye', '#logobaskı'],
};
const BASE_TAGS = ['#kupabaskı', '#kişiyeözelkupa', '#kartabaski'];

/** Türkçe hashtag listesi: markaya özgü + kategoriye özgü, tekrarsız, en fazla `max` adet. */
export function socialHashtags(category: string, extra: string[] = [], max = 8): string[] {
  const own = category ? (CATEGORY_TAGS[category.toLocaleLowerCase('tr-TR')] ?? [toHashtag(category)]) : [];
  const all = [...BASE_TAGS, ...own, ...extra.map((t) => (t.startsWith('#') ? t : toHashtag(t)))].filter(Boolean);
  return Array.from(new Set(all)).slice(0, Math.max(0, max));
}

export interface ProductCaptionOpts {
  title: string;
  priceText: string;
  category: string;
  deliveryDays?: number;
  url: string; // ürün sayfası
  whatsappUrl: string; // WhatsApp sipariş bağlantısı
  closed?: boolean;
}

/** Telegram (HTML) ürün gönderisi. Pasife alınmışsa "artık satışta değil" notu ve katalog bağlantısı. */
export function channelCaption(o: ProductCaptionOpts): string {
  const tags = socialHashtags(o.category).join(' ');
  const text = o.closed
    ? [
        `<b>${escHtml(o.title)}</b>`,
        '',
        'Bu model şu an satışta değil.',
        '',
        `Güncel modeller: <a href="${escAttr(o.url)}">${escHtml(o.url)}</a>`,
      ].join('\n')
    : [
        '<b>Yeni model</b>',
        '',
        `<b>${escHtml(o.title)}</b>`,
        `Fiyat: ${escHtml(o.priceText)}`,
        `Kategori: ${escHtml(o.category)}${o.deliveryDays ? ` · Teslimat: ${o.deliveryDays} iş günü` : ''}`,
        '',
        'Kişiye özel baskı: adınızı, fotoğrafınızı veya logonuzu yazın.',
        `<a href="${escAttr(o.whatsappUrl)}">WhatsApp ile sipariş ver</a> · <a href="${escAttr(o.url)}">Ürün sayfası</a>`,
        '',
        escHtml(tags),
      ].join('\n');
  return clip(text, CAPTION_MAX);
}

/** Telegram (HTML) blog yazısı gönderisi. */
export function blogCaption(o: { title: string; excerpt: string; url: string; tags?: string[] }): string {
  const tags = socialHashtags('', o.tags ?? [], 6).join(' ');
  const text = [
    '<b>Yeni yazı</b>',
    '',
    `<b>${escHtml(o.title)}</b>`,
    ...(o.excerpt ? ['', escHtml(clip(o.excerpt, 400))] : []),
    '',
    `<a href="${escAttr(o.url)}">Yazının tamamını oku</a>`,
    '',
    escHtml(tags),
  ].join('\n');
  return clip(text, CAPTION_MAX);
}

/** Kanal gönderisinin t.me bağlantısı: @kanal → t.me/kanal/12, -100123… → t.me/c/123…/12. Çözülemezse undefined. */
export function channelPostLink(channelId: string | null | undefined, messageId: number | undefined): string | undefined {
  const id = (channelId ?? '').trim();
  if (!id || !messageId) return undefined;
  if (id.startsWith('@')) return `https://t.me/${id.slice(1)}/${messageId}`;
  const m = id.match(/^-100(\d+)$/);
  return m ? `https://t.me/c/${m[1]}/${messageId}` : undefined;
}

/** Bugünkü gönderi sayısı; gün değiştiyse 0. */
export function channelTodayCount(day: string, todayCount: number, now: number): number {
  return day === trDayKey(now) ? todayCount : 0;
}

/** Panel ayarlarından (social_settings/{platform}) gelen kota ve saat penceresi; verilmezse varsayılanlar. */
export interface GateConfig { dailyLimit: number; windowStart: number; windowEnd: number }
export const DEFAULT_GATE: GateConfig = { dailyLimit: CHANNEL_DAILY_LIMIT, windowStart: CHANNEL_WINDOW_START_HOUR, windowEnd: CHANNEL_WINDOW_END_HOUR };

/** Saat penceresi ve günlük kota uygun mu? */
export function channelGate(day: string, todayCount: number, now: number, cfg: GateConfig = DEFAULT_GATE): { ok: boolean; reason?: string } {
  const h = trHour(now);
  if (h < cfg.windowStart || h >= cfg.windowEnd) {
    return { ok: false, reason: `paylaşım saatleri dışında (${cfg.windowStart}:00–${cfg.windowEnd}:00 TSİ)` };
  }
  if (channelTodayCount(day, todayCount, now) >= cfg.dailyLimit) return { ok: false, reason: 'günlük kota doldu' };
  return { ok: true };
}

/** Elle tetiklemede saat penceresi yok sayılır, günlük kota geçerli kalır. */
export function manualGate(day: string, todayCount: number, now: number, cfg: GateConfig = DEFAULT_GATE): { ok: boolean; reason?: string } {
  return channelTodayCount(day, todayCount, now) >= cfg.dailyLimit ? { ok: false, reason: 'günlük kota doldu' } : { ok: true };
}
