// Sosyal medya içeriği için saf yardımcılar (testli): ürün satırı, hashtag havuzu, Türkçe caption şablonları,
// özel gün kampanyaları, blog paylaşım seçimi ve paylaşım kuyruğu. Ağ/Firestore erişimi YOK.
import type { Product } from '@/types';
import { getTitle, getPriceMin, getPriceMax, getCategory, getActive, getSlug, getShortDesc, getDescription, getDeliveryDays } from './product-utils';
import { cloudinaryUrl, displayTitle, formatPriceRange } from './format';
import { PHONE_DISPLAY, SLOGAN } from './constants';
import { SITE_URL } from './site';
import { trDayKey } from './tr-time';
import type { SocialPlatform } from './social-types';

export const DAY_MS = 86400000;

// ── Ürün satırı ──────────────────────────────────────────────────────────────

export interface SocialProductRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  priceMin: number;
  priceMax: number;
  shortDesc: string;
  description: string;
  deliveryDays: number;
  imageIds: string[]; // yalnız Cloudinary public_id (http adresliler dışlanır)
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Ürünü paylaşılabilir satıra çevirir. Alan okuma `product-utils` yardımcılarıyla yapılır. */
export function toSocialRow(p: Product): SocialProductRow {
  const imageIds = (p.images ?? []).filter((i): i is string => typeof i === 'string' && i.length > 0 && !i.startsWith('http'));
  return {
    id: p.id,
    title: displayTitle(getTitle(p)),
    slug: getSlug(p),
    category: getCategory(p) || 'Özel Tasarım',
    priceMin: getPriceMin(p),
    priceMax: getPriceMax(p),
    shortDesc: getShortDesc(p),
    description: getDescription(p),
    deliveryDays: getDeliveryDays(p),
    imageIds,
    active: getActive(p),
    createdAt: p.createdAt ?? 0,
    updatedAt: p.updatedAt ?? 0,
  };
}

/** Paylaşılabilir ürün: sitede aktif ve en az bir Cloudinary görseli var (fiyat zorunlu değil: "Fiyat için yazın"). */
export const isShareable = (r: Pick<SocialProductRow, 'active' | 'imageIds'>): boolean => r.active && r.imageIds.length > 0;

/** Meta/Threads için ürün görselleri (JPG, en fazla `max`). Instagram dışı platformlar bunu kullanır. */
export function imageUrls(r: Pick<SocialProductRow, 'imageIds'>, max = 10): string[] {
  return r.imageIds.slice(0, max).map((id) => cloudinaryUrl(id, 'f_jpg,q_auto,w_1080,c_limit'));
}

export const productUrl = (slug: string, siteUrl = SITE_URL) => `${siteUrl}/urun/${slug}`;
export const blogUrl = (slug: string, siteUrl = SITE_URL) => `${siteUrl}/blog/${slug}`;
export const categoryUrl = (category: string, siteUrl = SITE_URL) => `${siteUrl}/?kategori=${encodeURIComponent(category)}#urunler`;

// ── Metin yardımcıları ───────────────────────────────────────────────────────

export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const priceText = (r: Pick<SocialProductRow, 'priceMin' | 'priceMax'>) => formatPriceRange(r.priceMin, r.priceMax);

// ── Hashtag havuzu ───────────────────────────────────────────────────────────

export const CORE_HASHTAGS = ['#kişiyeözelkupa', '#kupabaskı', '#baskılıkupa', '#hediyelikkupa', '#kartabaski'];

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  'Seramik Kahve Fincanı': ['#kahvefincanı', '#seramikfincan', '#kahvekeyfi'],
  'Lüks Kupa': ['#lükskupa', '#premiumkupa', '#özelhediye'],
  'Kahve Fincanı': ['#kahvefincanı', '#kahvekeyfi', '#fincanbaskı'],
  'Latte Fincanı': ['#lattefincanı', '#kahvekeyfi', '#fincanbaskı'],
  'Pro Kupa': ['#prokupa', '#sublimasyon', '#kupatasarım'],
  'Büyük Kupa': ['#büyükkupa', '#jumbokupa', '#kupatasarım'],
  'Sihirli Kupa': ['#sihirlikupa', '#ısıyadeğişenkupa', '#sürprizhediye'],
  'Özel Tasarım': ['#özeltasarım', '#fotoğraflıkupa', '#isimlikupa'],
  'Kurumsal': ['#kurumsalhediye', '#logobaskı', '#toplusipariş'],
};

/** Çekirdek etiketler + kategoriye özel etiketler; tekrarsız, en çok `max` adet. */
export function hashtagsFor(category: string, max = 8): string[] {
  const out: string[] = [];
  for (const t of [...CORE_HASHTAGS, ...(CATEGORY_HASHTAGS[category] ?? [])]) if (!out.includes(t)) out.push(t);
  return out.slice(0, Math.max(0, max));
}

export function hashtagCount(text: string): number {
  return (text.match(/#[\wçğıöşüÇĞİÖŞÜ]+/g) ?? []).length;
}

// ── Ürün caption'ı ───────────────────────────────────────────────────────────

const HOOKS = [
  'Sevdiklerinize anlamlı bir hediye: kişiye özel baskılı kupa.',
  'Her yudumda size ait bir tasarım.',
  'İsim, fotoğraf ya da logo: hayalinizdeki tasarım kupanıza basılsın.',
  'Günün en güzel molası, kendi tasarımınızla.',
];

export type CaptionPlatform = 'instagram' | 'facebook' | 'threads';

const contactLine = () => `📲 Sipariş için WhatsApp: ${PHONE_DISPLAY}`;

/** Tek ürün için platforma uygun Türkçe açıklama. Aynı ürün hep aynı açılış cümlesini alır (deterministik). */
export function buildProductCaption(r: SocialProductRow, platform: CaptionPlatform, siteUrl = SITE_URL): string {
  const hook = HOOKS[hashStr(r.id) % HOOKS.length];
  const link = productUrl(r.slug, siteUrl);
  const body = clip(r.shortDesc || r.description, platform === 'threads' ? 140 : 320);

  if (platform === 'threads') {
    const lines = [`☕ ${clip(r.title, 90)}`, `💰 ${priceText(r)}`];
    if (body) lines.push(body);
    lines.push(`📲 WhatsApp: ${PHONE_DISPLAY}`, `👉 ${link}`, '#kişiyeözelkupa');
    return clip500(lines.join('\n'));
  }

  const lines = [`☕ ${clip(r.title, 90)}`, '', hook];
  if (body) lines.push('', body);
  lines.push('', `💰 Fiyat: ${priceText(r)}`);
  lines.push(`📦 Teslimat: yaklaşık ${r.deliveryDays} iş günü`);
  lines.push('🎨 İsim, fotoğraf, logo ya da özel tasarımınızla baskı.');
  lines.push('', contactLine());
  // Instagram'da bağlantı tıklanmaz ama adres okunur; Facebook'ta tıklanır
  lines.push(platform === 'instagram' ? `🔗 ${siteUrl.replace(/^https?:\/\//, '')}/urun/${r.slug}` : `🔗 ${link}`);
  lines.push('', hashtagsFor(r.category, platform === 'instagram' ? 8 : 4).join(' '));
  return lines.join('\n');
}

/** Threads gönderisi 500 karakteri geçemez. */
function clip500(s: string): string {
  return s.length > 500 ? `${s.slice(0, 499).trimEnd()}…` : s;
}

// ── Pasife alınan ürün notu (Facebook) ───────────────────────────────────────

export const PASSIVE_NOTE = '⏸ Bu model şu an sipariş almıyor.';

/**
 * Pasife alınan ürünün gönderi açıklamasının başına not ekler; ürün yeniden aktifse notu kaldırır (idempotent).
 */
export function withPassiveNote(baseCaption: string, active: boolean): string {
  let body = baseCaption;
  if (body.startsWith(PASSIVE_NOTE)) body = body.slice(PASSIVE_NOTE.length).replace(/^\n+/, '');
  return active ? body : body ? `${PASSIVE_NOTE}\n\n${body}` : PASSIVE_NOTE;
}

// ── Özel gün kampanyaları ────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string; // "Sevgililer Günü"
  hook: string;
  line: string; // gün/sipariş cümlesi
  month: number; // 1-12
  day?: number; // sabit gün
  nth?: { weekday: number; n: number }; // ayın n. haftanın günü (0 = pazar)
  leadDays: number; // kaç gün önceden başlasın
  tags: string[];
  categories: string[]; // önerilen kategoriler (sırayla)
}

export const CAMPAIGNS: Campaign[] = [
  { id: 'sevgililer', name: 'Sevgililer Günü', month: 2, day: 14, leadDays: 8,
    hook: 'Sevgililer Günü’nde sevdiğinize fotoğraflı, isimli bir kupa hediye edin.',
    line: 'Birlikte geçirdiğiniz en güzel anı kupaya basalım.',
    tags: ['#sevgililergünü', '#sevgilihediyesi', '#çiftkupası'], categories: ['Lüks Kupa', 'Seramik Kahve Fincanı', 'Özel Tasarım'] },
  { id: 'kadinlar', name: 'Kadınlar Günü', month: 3, day: 8, leadDays: 5,
    hook: '8 Mart Dünya Kadınlar Günü’nde en özel hediye: kişiye özel kupa.',
    line: 'İsmi, notu ya da fotoğrafıyla anlam dolu bir sürpriz hazırlayın.',
    tags: ['#kadınlargünü', '#8mart', '#hediyefikri'], categories: ['Lüks Kupa', 'Latte Fincanı', 'Özel Tasarım'] },
  { id: 'anneler', name: 'Anneler Günü', month: 5, nth: { weekday: 0, n: 2 }, leadDays: 8,
    hook: 'Anneler Günü’nde anneniz için kendi tasarımınızla özel bir kupa.',
    line: 'Çocukluk fotoğrafı, aile kareleri ya da duygusal bir not: hepsi kupaya basılır.',
    tags: ['#annelergünü', '#annehediyesi', '#anneyeözel'], categories: ['Seramik Kahve Fincanı', 'Lüks Kupa', 'Özel Tasarım'] },
  { id: 'babalar', name: 'Babalar Günü', month: 6, nth: { weekday: 0, n: 3 }, leadDays: 8,
    hook: 'Babalar Günü’nde babanıza kişiye özel baskılı kupa hediye edin.',
    line: 'İsim, fotoğraf ya da esprili bir yazıyla unutulmaz bir hediye.',
    tags: ['#babalargünü', '#babahediyesi', '#babayaözel'], categories: ['Büyük Kupa', 'Pro Kupa', 'Özel Tasarım'] },
  { id: 'kahve-gunu', name: 'Dünya Kahve Günü', month: 10, day: 1, leadDays: 3,
    hook: 'Dünya Kahve Günü’nde kahvenizi kendi tasarımınız olan fincanda için.',
    line: 'Kahve fincanı ve latte fincanı modellerimizi inceleyin.',
    tags: ['#dünyakahvegünü', '#kahveaşkı', '#kahvemolası'], categories: ['Kahve Fincanı', 'Latte Fincanı', 'Seramik Kahve Fincanı'] },
  { id: 'ogretmenler', name: 'Öğretmenler Günü', month: 11, day: 24, leadDays: 8,
    hook: 'Öğretmenler Günü’nde öğretmeninize kalıcı bir teşekkür: kişiye özel kupa.',
    line: 'Sınıfça ortak tasarım ya da toplu sipariş için bize yazabilirsiniz.',
    tags: ['#öğretmenlergünü', '#öğretmenehediye', '#24kasım'], categories: ['Lüks Kupa', 'Özel Tasarım', 'Kurumsal'] },
  { id: 'kara-cuma', name: 'Kara Cuma', month: 11, nth: { weekday: 5, n: 4 }, leadDays: 4,
    hook: 'Kara Cuma haftasında yılbaşı hediyeniz için erken davranın.',
    line: 'Hediye kupalar için güncel fırsatları öğrenmek üzere bize yazın.',
    tags: ['#karacuma', '#blackfriday', '#hediyefırsatı'], categories: ['Lüks Kupa', 'Sihirli Kupa', 'Özel Tasarım'] },
  { id: 'yilbasi', name: 'Yılbaşı', month: 12, day: 31, leadDays: 14,
    hook: 'Yılbaşı hediyesi arıyorsanız: kişiye özel baskılı kupa.',
    line: 'Yeni yıla sevdikleriniz için anlamlı bir sürprizle girin. Kurumsal toplu siparişler de alınır.',
    tags: ['#yılbaşı', '#yılbaşıhediyesi', '#yeniyıl'], categories: ['Sihirli Kupa', 'Lüks Kupa', 'Kurumsal'] },
];

/** Ayın n. haftanın günü (UTC takvimi; yalnızca gün sayısı için). */
export function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

export function campaignDay(c: Campaign, year: number): number {
  return c.nth ? nthWeekday(year, c.month, c.nth.weekday, c.nth.n) : (c.day ?? 1);
}

export interface ActiveCampaign { campaign: Campaign; key: string; daysLeft: number }

/** Bugün (TSİ) kampanya penceresindeyse en yakın özel günü döndürür. `key` her yıl için benzersizdir. */
export function activeCampaign(now: number): ActiveCampaign | null {
  const [y, m, d] = trDayKey(now).split('-').map(Number);
  const today = Date.UTC(y, m - 1, d);
  let best: ActiveCampaign | null = null;
  for (const c of CAMPAIGNS) {
    const event = Date.UTC(y, c.month - 1, campaignDay(c, y));
    const daysLeft = Math.round((event - today) / DAY_MS);
    if (daysLeft < 0 || daysLeft > c.leadDays) continue;
    if (!best || daysLeft < best.daysLeft) best = { campaign: c, key: `${c.id}-${y}`, daysLeft };
  }
  return best;
}

export const CAMPAIGN_GAP_DAYS = 3;

/** Aynı kampanya bir platformda en fazla her `CAMPAIGN_GAP_DAYS` günde bir paylaşılır. `lastAt`: son paylaşım. */
export function campaignDue(lastAt: number | undefined, now: number): boolean {
  return !lastAt || now - lastAt >= CAMPAIGN_GAP_DAYS * DAY_MS;
}

/** Kampanyaya uygun ürünleri seçer: önerilen kategori sırasına göre, en fazla `max` ürün. */
export function pickCampaignProducts(rows: SocialProductRow[], c: Campaign, max = 5): SocialProductRow[] {
  const ok = rows.filter(isShareable);
  const rank = (r: SocialProductRow) => { const i = c.categories.indexOf(r.category); return i === -1 ? 99 : i; };
  return [...ok].sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt).slice(0, max);
}

export function campaignCaption(ac: ActiveCampaign, items: Pick<SocialProductRow, 'title' | 'slug' | 'category'>[], platform: CaptionPlatform, siteUrl = SITE_URL): string {
  const c = ac.campaign;
  const when = ac.daysLeft === 0 ? 'Bugün' : ac.daysLeft === 1 ? 'Yarın' : `${ac.daysLeft} gün sonra`;
  const head = `🎁 ${c.name}: ${when}!`;
  if (platform === 'threads') {
    return clip500([head, c.hook, `📲 WhatsApp: ${PHONE_DISPLAY}`, `👉 ${siteUrl}`, c.tags[0] ?? ''].filter(Boolean).join('\n'));
  }
  const lines = [head, '', c.hook, c.line];
  if (items.length) {
    lines.push('', 'Öne çıkan modeller:');
    for (const it of items.slice(0, 5)) lines.push(`• ${clip(it.title, 60)}`);
  }
  lines.push('', `✨ ${SLOGAN}`, contactLine(), `🔗 ${platform === 'instagram' ? siteUrl.replace(/^https?:\/\//, '') : siteUrl}`);
  lines.push('', [...c.tags, ...CORE_HASHTAGS].slice(0, platform === 'instagram' ? 10 : 5).join(' '));
  return lines.join('\n');
}

// ── Blog paylaşımı ───────────────────────────────────────────────────────────

export interface BlogLite {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  published: boolean;
  publishedAt: number;
  coverImage?: string;
  tags?: string[];
}

/**
 * Henüz paylaşılmamış, otomasyon başladıktan SONRA yayınlanmış en eski yazıyı seçer (geçmiş yazılar toplu basılmaz).
 * `shared`: postId → paylaşım zamanı.
 */
export function pickBlogToShare(posts: BlogLite[], shared: Record<string, number>, since: number): BlogLite | undefined {
  return posts
    .filter((p) => p.published && p.publishedAt > since && !shared[p.id])
    .sort((a, b) => a.publishedAt - b.publishedAt)[0];
}

export function blogCaption(p: BlogLite, platform: CaptionPlatform, siteUrl = SITE_URL): string {
  const link = blogUrl(p.slug, siteUrl);
  if (platform === 'threads') {
    return clip500([`📝 Yeni yazı: ${clip(p.title, 120)}`, clip(p.excerpt, 200), `👉 ${link}`].filter(Boolean).join('\n'));
  }
  const lines = [`📝 Blogda yeni yazı: ${p.title}`, '', clip(p.excerpt, 320), '', `Tamamını oku: ${platform === 'instagram' ? `${siteUrl.replace(/^https?:\/\//, '')}/blog/${p.slug}` : link}`];
  lines.push('', contactLine(), '', platform === 'instagram' ? [...CORE_HASHTAGS, '#kupafikirleri'].join(' ') : CORE_HASHTAGS.slice(0, 3).join(' '));
  return lines.join('\n');
}

// ── Paylaşım kuyruğu ─────────────────────────────────────────────────────────

export interface PostedEntry { postedAt: number; postId?: string; error?: string }

export const REPOST_AFTER_DAYS = 30;

/** Otomasyon başladıktan sonra eklenmiş, henüz paylaşılmamış ürünler (kota dışı, hemen paylaşılır). */
export function newArrivals(rows: SocialProductRow[], posted: Record<string, unknown>, startedAt: number): SocialProductRow[] {
  return rows.filter((r) => isShareable(r) && !posted[r.id] && r.createdAt > startedAt).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Kota kuyruğu: önce hiç paylaşılmamış ürünler (en yeni önce), sonra `repostAfterDays` gündür paylaşılmayanlar
 * (en eski paylaşılan önce). Hatalı kayıtlar kuyruğa girmez (ayrıca yeniden denenir).
 */
export function pickQueue(
  rows: SocialProductRow[],
  posted: Record<string, PostedEntry>,
  now: number,
  repostAfterDays = REPOST_AFTER_DAYS
): SocialProductRow[] {
  const ok = rows.filter(isShareable);
  const fresh = ok.filter((r) => !posted[r.id]).sort((a, b) => b.createdAt - a.createdAt);
  const stale = ok
    .filter((r) => { const v = posted[r.id]; return !!v && !!v.postId && now - v.postedAt >= repostAfterDays * DAY_MS; })
    .sort((a, b) => posted[a.id].postedAt - posted[b.id].postedAt);
  return [...fresh, ...stale];
}

/** Hata alıp sonradan düzenlenen (ör. görseli düzeltilen) ürünler yeniden denenir. */
export function retryableFailures(rows: SocialProductRow[], posted: Record<string, PostedEntry>): SocialProductRow[] {
  return rows.filter((r) => {
    const v = posted[r.id];
    return !!v && !v.postId && !!v.error && r.updatedAt > v.postedAt && isShareable(r);
  });
}

export const platformLabel: Record<SocialPlatform, string> = {
  instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', telegram: 'Telegram', pinterest: 'Pinterest', tiktok: 'TikTok',
};
