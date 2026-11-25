// Instagram otomasyonu için saf yardımcılar (testli). Veri/ağ erişimi lib/instagram*.ts'te.
import { trDayKey, trHour, trTime } from './tr-time';
import { hashStr, type SocialProductRow } from './social-content-utils';

export { trDayKey, trHour, trTime };

export type PostKind = 'carousel' | 'story' | 'blog';
export type PostStatus = 'taslak' | 'yayinlandi' | 'iptal' | 'hata';

export interface IgItem {
  productId: string; // blog paylaşımında `blog:<yazı id>`
  title: string;
  priceMin: number;
  priceMax: number;
  imageId: string; // Cloudinary public_id
  category: string;
}

export interface IgPost {
  id: string;
  kind: PostKind;
  status: PostStatus;
  publishAt: number;
  createdAt: number;
  items: IgItem[];
  caption: string;
  captionEdited?: boolean;
  igMediaId?: string;
  error?: string;
  day: string; // TSİ gün anahtarı (YYYY-MM-DD)
  theme?: string; // kampanya anahtarı (ör. anneler-2027)
  refId?: string; // blog yazısı kimliği
}

export const LEAD_MS = 60 * 60 * 1000; // itiraz süresi: taslak oluşunca yayına en az 1 saat
export const PLAN_START_HOUR = 6; // günlük plan TSİ 06:00'dan sonra üretilir
export const MAX_CAROUSEL_IMAGES = 10;

export interface Slot { kind: 'carousel' | 'story'; at: number }

/** Pencere içine eşit aralıkla `count` zaman dağıtır (15 dk'ya yuvarlı): her dilimin ortası. */
export function spreadTimes(day: string, count: number, startHour: number, endHour: number): number[] {
  if (count <= 0 || endHour <= startHour) return [];
  const startMin = startHour * 60;
  const span = (endHour - startHour) * 60;
  return Array.from({ length: count }, (_, i) => {
    const m = Math.round((startMin + ((i + 0.5) / count) * span) / 15) * 15;
    return trTime(day, Math.floor(m / 60), m % 60);
  });
}

/** Günün yayın saatleri; oluşturma anından itibaren minLeadMs'den yakın olanlar atlanır. */
export function daySlots(
  day: string,
  now: number,
  o: { feedCount: number; storyCount: number; windowStart: number; windowEnd: number; minLeadMs?: number }
): Slot[] {
  const lead = o.minLeadMs ?? LEAD_MS;
  const feed = spreadTimes(day, o.feedCount, o.windowStart, o.windowEnd).map((at) => ({ kind: 'carousel' as const, at }));
  // Hikâyeler: pencerenin içinde, gönderilerle çakışmayacak şekilde (yarım dilim kaydırılmış)
  const story = spreadTimes(day, o.storyCount, o.windowStart, o.windowEnd).map((at) => ({ kind: 'story' as const, at: at + 20 * 60 * 1000 }));
  return [...feed, ...story].filter((s) => s.at >= now + lead).sort((a, b) => a.at - b.at);
}

/**
 * `now + leadMs` anından sonraki ilk uygun yayın zamanı: o an pencerenin içindeyse kendisi,
 * değilse (gece/erken) sonraki pencere başlangıcı.
 */
export function nextWindowTime(now: number, leadMs: number, startHour: number, endHour: number): number {
  const t = now + leadMs;
  const h = trHour(t);
  if (h >= startHour && h < endHour) return t;
  const day = trDayKey(t);
  if (h < startHour) return trTime(day, startHour, 0);
  const next = trDayKey(t + 24 * 3600 * 1000);
  return trTime(next, startHour, 0);
}

// ── Seçim ────────────────────────────────────────────────────────────────────

/** Gün anahtarıyla deterministik karıştırma: aynı gün aynı sıra, ertesi gün farklı. */
export function shuffleBy<T>(list: T[], seed: string, key: (x: T) => string): T[] {
  return [...list].sort((a, b) => hashStr(seed + key(a)) - hashStr(seed + key(b)));
}

/**
 * Son günlerde paylaşılmamış ürünler öne gelir; hepsi paylaşıldıysa en eski paylaşılan başa döner.
 * `recent`: productId → son paylaşım zamanı.
 */
export function rankCandidates(cands: SocialProductRow[], recent: Map<string, number>, day: string): SocialProductRow[] {
  const fresh = cands.filter((c) => !recent.has(c.id));
  const used = cands.filter((c) => recent.has(c.id)).sort((a, b) => recent.get(a.id)! - recent.get(b.id)!);
  const byNew = [...fresh].sort((a, b) => b.createdAt - a.createdAt);
  const head = byNew.slice(0, Math.ceil(byNew.length / 3)); // yeni eklenenler biraz öne
  const tail = shuffleBy(byNew.slice(head.length), day, (c) => c.id);
  return [...head, ...tail, ...used];
}

// ── Cloudinary görsel adresleri ──────────────────────────────────────────────

/** Cloudinary metin katmanı: önce URI kaçışı, sonra , ve / çift kaçış. */
export function overlayText(s: string): string {
  return encodeURIComponent(s.replace(/\s+/g, ' ').trim()).replace(/%2C/g, '%252C').replace(/%2F/g, '%252F');
}

const PAD_BG = 'b_rgb:f5f2ec'; // site zemini (--paper)
const BRAND_BG = 'b_rgb:1f4a36'; // marka yeşili (--brand)

/** Gönderi görseli: 1080×1350, kırpılmadan dolguyla; üzerine hiçbir yazı eklenmez. */
export function feedImageUrl(cloud: string, imageId: string): string {
  if (!cloud) throw new Error('Cloudinary cloud adı tanımlı değil');
  return `https://res.cloudinary.com/${cloud}/image/upload/f_jpg,q_85,c_pad,${PAD_BG},w_1080,h_1350/${imageId}`;
}

/** Ürün adını en fazla iki satıra böler (her satır ≤ 22 karakter). */
export function titleLines(title: string): string[] {
  const t = title.replace(/\s+/g, ' ').trim();
  const words = (t.length > 52 ? `${t.slice(0, 51).trimEnd()}…` : t).split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= 22 || !cur) cur = next;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out.slice(0, 2);
}

/** Hikâye görseli: 1080×1920, üstte ürün adı, altta fiyat ve marka bandı. */
export function storyImageUrl(cloud: string, imageId: string, title: string, priceLabel: string, brand: string): string {
  if (!cloud) throw new Error('Cloudinary cloud adı tanımlı değil');
  const top = titleLines(title).map((line, i) =>
    `l_text:Roboto_60_bold:${overlayText(line)},co_rgb:1b1a17,${PAD_BG}d9/fl_layer_apply,g_north,y_${260 + i * 84}`
  );
  const price = `l_text:Roboto_72_bold:${overlayText(priceLabel)},co_white,${BRAND_BG}e6/fl_layer_apply,g_south_west,x_60,y_340`;
  const brandTag = `l_text:Roboto_34_bold:${overlayText(brand)},co_white,${BRAND_BG}e6/fl_layer_apply,g_south_west,x_60,y_270`;
  const tr = [`f_jpg,q_85,c_pad,${PAD_BG},w_1080,h_1920`, ...top, price, brandTag].join('/');
  return `https://res.cloudinary.com/${cloud}/image/upload/${tr}/${imageId}`;
}

export interface SlideOpts { cloud: string; brand: string; kind: 'feed' | 'story'; priceLabel: (i: IgItem) => string }

/** Taslak kartındaki ve yayındaki görsel adresi: gönderilerde yazı yok, hikâyelerde ad + fiyat bandı. */
export function slideUrl(item: IgItem, o: SlideOpts): string {
  return o.kind === 'feed' ? feedImageUrl(o.cloud, item.imageId) : storyImageUrl(o.cloud, item.imageId, item.title, o.priceLabel(item), o.brand);
}

// ── Durum ────────────────────────────────────────────────────────────────────

export function isDue(p: Pick<IgPost, 'status' | 'publishAt'>, now: number): boolean {
  return p.status === 'taslak' && p.publishAt <= now;
}

/**
 * Yayın anında hâlâ aktif olan ürünleri bırakır. Kupa ürünleri modeldir; farklı ürünlü karuselde
 * en az 2, diğer tüm durumlarda en az 1 ürün kalmalıdır. Blog öğeleri (`blog:` kimlikli) her zaman geçerlidir.
 */
export function survivors(items: IgItem[], stillActive: Set<string>, kind: PostKind): IgItem[] | null {
  const kept = items.filter((i) => i.productId.startsWith('blog:') || stillActive.has(i.productId));
  const distinct = new Set(items.map((i) => i.productId)).size;
  const min = kind === 'carousel' && distinct > 1 ? 2 : 1;
  return kept.length >= min ? kept : null;
}
