// Tasarım ekranının yazı tipleri. Liste `tools/yazi-tipi-katalogu.mjs` ile üretilir ve yalnız
// Türkçe harflerin tamamı bulunan aileleri içerir; dosyalar `/api/yazi-tipi` üzerinden gelir.
// 80 KB'lık listeyi içerdiği için yalnız tasarım ve sipariş yönetimi ekranları içe aktarır.
import list from './yazi-tipleri.json';
import type { FontSpec } from './ciz';

export type FontCategory = 's' | 'r' | 'h' | 'd' | 'm';

export interface FontInfo {
  id: string;
  ad: string;
  k: FontCategory;
  /** Normal ağırlık. */
  n: number;
  /** Kalın ağırlık (varsa). */
  b?: number;
  /** Eğik biçim var. */
  i?: number;
}

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  h: 'El yazısı', s: 'Düz', r: 'Klasik', d: 'Gösterişli', m: 'Daktilo',
};

/** Siteyle birlikte gelen iki tip (eski siparişler de bunları kullanır). */
const BUILTIN: Record<string, { info: FontInfo; family: string; weight: number }> = {
  duz: { info: { id: 'duz', ad: 'Düz yazı', k: 's', n: 820 }, family: "'Archivo Variable', sans-serif", weight: 820 },
  el: { info: { id: 'el', ad: 'El yazısı', k: 'h', n: 700 }, family: "'Shantell Sans Variable', cursive", weight: 700 },
};

export const FONTS: FontInfo[] = [BUILTIN.duz.info, BUILTIN.el.info, ...(list as FontInfo[])];

const byId = new Map(FONTS.map((f) => [f.id, f]));

export const fontInfo = (id: string): FontInfo => byId.get(id) ?? BUILTIN.duz.info;
export const isKnownFont = (id: string) => byId.has(id);

const FEATURED_IDS = [
  'duz', 'el', 'pacifico', 'dancing-script', 'great-vibes', 'caveat', 'lobster', 'sacramento', 'allura', 'parisienne',
  'alex-brush', 'kaushan-script', 'courgette', 'marck-script', 'kalam', 'indie-flower', 'patrick-hand', 'amatic-sc', 'yellowtail', 'damion',
  'style-script', 'corinthia', 'italianno', 'pinyon-script', 'birthstone', 'ms-madi', 'charm', 'merienda', 'caveat-brush', 'gloria-hallelujah',
  'montserrat', 'poppins', 'oswald', 'bebas-neue', 'anton', 'raleway', 'quicksand', 'comfortaa', 'rubik', 'josefin-sans',
  'playfair-display', 'cormorant-garamond', 'lora', 'cinzel', 'abril-fatface', 'dm-serif-display', 'yeseva-one', 'cinzel-decorative', 'berkshire-swash', 'alfa-slab-one',
  'baloo-2', 'grandstander', 'bangers', 'luckiest-guy', 'righteous', 'paytone-one', 'shrikhand', 'bungee', 'rubik-bubbles', 'monoton',
  'press-start-2p', 'black-ops-one', 'audiowide', 'special-elite', 'courier-prime', 'vt323',
];

export const FEATURED: FontInfo[] = FEATURED_IDS.flatMap((id) => byId.get(id) ?? []);

const PLAIN: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
export const plain = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => PLAIN[c]).trim();

/** Ada göre arama; boş aramada sınıfın tamamı. Adı aramayla başlayanlar öne gelir. */
export function searchFonts(query: string, category?: FontCategory): FontInfo[] {
  const q = plain(query);
  const pool = category ? FONTS.filter((f) => f.k === category) : FONTS;
  if (!q) return pool;
  const hits = pool.filter((f) => plain(f.ad).includes(q));
  return [...hits.filter((f) => plain(f.ad).startsWith(q)), ...hits.filter((f) => !plain(f.ad).startsWith(q))];
}

/** Tuvale yazılacak aile, ağırlık ve eğim. Ailede olmayan biçim istenirse normali kullanılır. */
export function fontSpec(id: string, bold?: boolean, italic?: boolean): FontSpec {
  const builtin = BUILTIN[id];
  if (builtin) return { family: builtin.family, weight: builtin.weight, style: 'normal' };
  const f = byId.get(id);
  if (!f) return fontSpec('duz');
  return { family: `'kt-${f.id}', sans-serif`, weight: bold && f.b ? f.b : f.n, style: italic && f.i ? 'italic' : 'normal' };
}

export const SUBSETS = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const;

export const fontFileUrl = (id: string, subset: keyof typeof SUBSETS, weight: number, style: 'normal' | 'italic') =>
  `/api/yazi-tipi/${id}/${subset}-${weight}-${style}.woff2`;

const loading = new Map<string, Promise<void>>();

/** Yazı tipini indirip tarayıcıya tanıtır; ikinci çağrı aynı sözü döner. Hata olursa yeniden denenebilir. */
export function loadFont(id: string, bold?: boolean, italic?: boolean): Promise<void> {
  const { family, weight, style } = fontSpec(id, bold, italic);
  const key = `${id}:${weight}:${style}`;
  let job = loading.get(key);
  if (job) return job;
  if (BUILTIN[id] || !byId.has(id)) {
    job = document.fonts.load(`${weight} 48px ${family}`, 'AĞİŞığş').then(() => undefined);
  } else {
    job = Promise.all((Object.keys(SUBSETS) as (keyof typeof SUBSETS)[]).map(async (subset) => {
      const face = new FontFace(`kt-${id}`, `url(${fontFileUrl(id, subset, weight, style)}) format('woff2')`, {
        weight: String(weight), style, unicodeRange: SUBSETS[subset], display: 'swap',
      });
      await face.load();
      document.fonts.add(face);
    })).then(() => undefined);
  }
  loading.set(key, job);
  job.catch(() => loading.delete(key));
  return job;
}
