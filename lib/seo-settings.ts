// SEO ayarları: tipler, varsayılanlar ve saf normalleştirme (istemci + sunucu ortak; server-only içermez).
import { SITE_NAME } from './constants';

export interface CategorySeo {
  title?: string; // kategori sayfası başlığı
  description?: string; // meta açıklaması
  intro?: string; // sayfada gösterilebilecek kısa tanıtım metni
}

export interface SeoSettings {
  siteTitle: string; // ana sayfa / varsayılan başlık
  description: string; // varsayılan meta açıklaması
  keywords: string[]; // meta anahtar kelimeleri
  ogImage: string; // Cloudinary public_id (boşsa logo)
  googleVerification: string; // Google Search Console doğrulama kodu
  bingVerification: string; // Bing Webmaster doğrulama kodu
  targetCities: string[]; // kargo yapılan iller / hedef şehirler
  keywordTargets: string[]; // blogda yazı konusu olacak hedef anahtar kelimeler
  categorySeo: Record<string, CategorySeo>; // kategori adı → SEO metinleri
  extraDescription: string; // işletme hakkında ek açıklama
}

export const DEFAULT_KEYWORDS = [
  'kupa baskı', 'kişiye özel kupa', 'sihirli kupa', 'hediye kupa',
  'kurumsal kupa baskı', 'özel tasarım kupa', 'kupa baskı sipariş',
  'sihirli mat kupa', 'sihirli konik kupa', 'seramik kupa baskı',
  'Türkiye kupa baskı', 'online kupa baskı', 'kupa baskı kargo',
];

export const DEFAULT_SEO: SeoSettings = {
  siteTitle: `${SITE_NAME} – Kişiye Özel Kupa Baskı`,
  description: 'Kişiye özel kupa baskı. Türkiye geneli hızlı kargo. Bireysel ve kurumsal siparişler. Ücretsiz tasarım desteği.',
  keywords: DEFAULT_KEYWORDS,
  ogImage: '',
  googleVerification: '',
  bingVerification: '',
  targetCities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Kocaeli', 'Mersin'],
  keywordTargets: [],
  categorySeo: {},
  extraDescription: '',
};

export const SEO_LIMITS = { title: 70, description: 200, listItems: 40, itemLen: 60, intro: 600, extra: 800 } as const;

export const OG_ID_RE = /^karta-baski\/[A-Za-z0-9_\-/]{3,120}$/;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function list(v: unknown, maxItems: number = SEO_LIMITS.listItems, maxLen: number = SEO_LIMITS.itemLen): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const s = typeof x === 'string' ? x.trim().slice(0, maxLen) : '';
    const key = s.toLocaleLowerCase('tr-TR');
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Doğrulama kodu: kullanıcı tüm <meta ...> etiketini yapıştırsa bile yalnızca content değeri alınır. */
export function cleanVerification(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m = v.match(/content\s*=\s*["']([^"']+)["']/i);
  const code = (m ? m[1] : v).trim();
  return /^[A-Za-z0-9_\-:.=]{8,200}$/.test(code) ? code : '';
}

/** Ham (Firestore ya da form) veriyi güvenli, tam bir SeoSettings'e çevirir. Eksik alanlar varsayılana düşer. */
export function normalizeSeoSettings(raw: unknown): SeoSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const keywords = list(r.keywords);
  const cats: Record<string, CategorySeo> = {};
  if (r.categorySeo && typeof r.categorySeo === 'object') {
    for (const [k, v] of Object.entries(r.categorySeo as Record<string, unknown>).slice(0, 30)) {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      const entry: CategorySeo = {
        ...(str(o.title, SEO_LIMITS.title) ? { title: str(o.title, SEO_LIMITS.title) } : {}),
        ...(str(o.description, SEO_LIMITS.description) ? { description: str(o.description, SEO_LIMITS.description) } : {}),
        ...(str(o.intro, SEO_LIMITS.intro) ? { intro: str(o.intro, SEO_LIMITS.intro) } : {}),
      };
      if (Object.keys(entry).length) cats[k.slice(0, 60)] = entry;
    }
  }
  const og = str(r.ogImage, 160);
  return {
    siteTitle: str(r.siteTitle, SEO_LIMITS.title) || DEFAULT_SEO.siteTitle,
    description: str(r.description, SEO_LIMITS.description) || DEFAULT_SEO.description,
    keywords: keywords.length ? keywords : DEFAULT_SEO.keywords,
    ogImage: OG_ID_RE.test(og) ? og : '',
    googleVerification: cleanVerification(r.googleVerification),
    bingVerification: cleanVerification(r.bingVerification),
    targetCities: r.targetCities === undefined ? DEFAULT_SEO.targetCities : list(r.targetCities, 81, 40),
    keywordTargets: list(r.keywordTargets, 60, 80),
    categorySeo: cats,
    extraDescription: str(r.extraDescription, SEO_LIMITS.extra),
  };
}
