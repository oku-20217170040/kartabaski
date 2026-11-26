import type { Counts, TrackPayload } from './analytics-types';

// Saf yardımcılar (Firebase/Next bağımlılığı yok): UA ayrıştırma, kaynak sınıflama, sayaç yaması üretimi.

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|monitor|uptime|vercel|pingdom/i;

export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOT_RE.test(ua);
}

export interface ParsedUA { device: 'Mobil' | 'Tablet' | 'Masaüstü'; os: string; browser: string }

export function parseUA(ua: string): ParsedUA {
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = /Mobi|iPhone|iPod|Android/i.test(ua);
  const device: ParsedUA['device'] = tablet ? 'Tablet' : mobile ? 'Mobil' : 'Masaüstü';

  const os =
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /CrOS/i.test(ua) ? 'ChromeOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Diğer';

  const browser =
    /Instagram/i.test(ua) ? 'Instagram (uygulama içi)'
    : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook (uygulama içi)'
    : /TikTok|musical_ly|Bytedance/i.test(ua) ? 'TikTok (uygulama içi)'
    : /EdgA?\/|Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /CriOS|Chrome/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : 'Diğer';

  return { device, os, browser };
}

// Yapay zeka asistanları önce: gemini.google.com "Google" sanılmasın.
const AI_REFERRERS: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'ChatGPT'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/^(gemini|bard)\.google\.com$/, 'Gemini'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/^copilot\.microsoft\.com$/, 'Copilot'],
  [/(^|\.)deepseek\.com$/, 'DeepSeek'],
  [/(^|\.)(grok\.com|x\.ai)$/, 'Grok'],
  [/(^|\.)meta\.ai$/, 'Meta AI'],
  [/(^|\.)mistral\.ai$/, 'Mistral'],
  [/(^|\.)you\.com$/, 'You.com'],
  [/(^|\.)poe\.com$/, 'Poe'],
  [/(^|\.)phind\.com$/, 'Phind'],
];

const REFERRERS: [RegExp, string][] = [
  ...AI_REFERRERS,
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)yandex\./, 'Yandex'],
  [/duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yahoo\./, 'Yahoo'],
  [/instagram\.com$/, 'Instagram'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/tiktok\.com$/, 'TikTok'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'Telegram'],
  [/pinterest\./, 'Pinterest'],
  [/linkedin\.com$/, 'LinkedIn'],
];

export const AI_SOURCES = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 'DeepSeek', 'Grok', 'Meta AI', 'Mistral', 'You.com', 'Poe', 'Phind'];
const SEARCH_SOURCES = ['Google', 'Bing', 'Yandex', 'DuckDuckGo', 'Yahoo'];
const SOCIAL_SOURCES = ['Instagram', 'Facebook', 'Threads', 'X (Twitter)', 'YouTube', 'TikTok', 'WhatsApp', 'Telegram', 'Pinterest', 'LinkedIn'];

export function classifyReferrer(referrer: string | undefined, ownHost: string): string {
  if (!referrer) return 'Doğrudan';
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'Diğer';
  }
  if (host === ownHost.toLowerCase().replace(/^www\./, '') || host.endsWith('.vercel.app')) return 'Doğrudan';
  for (const [re, name] of REFERRERS) if (re.test(host)) return name;
  return host.slice(0, 60);
}

// utm_source değerleri (ChatGPT bağlantılara "chatgpt.com" ekler; kendi paylaşımlarımız "instagram", "threads" vb.)
const UTM_NAMES: [RegExp, string][] = [
  [/^(chatgpt(\.com)?|openai)$/, 'ChatGPT'],
  [/^claude(\.ai)?$/, 'Claude'],
  [/^(gemini|bard)$/, 'Gemini'],
  [/^perplexity(\.ai)?$/, 'Perplexity'],
  [/^copilot$/, 'Copilot'],
  [/^(instagram|ig)$/, 'Instagram'],
  [/^(facebook|fb)$/, 'Facebook'],
  [/^threads$/, 'Threads'],
  [/^tiktok$/, 'TikTok'],
  [/^pinterest$/, 'Pinterest'],
  [/^telegram$/, 'Telegram'],
  [/^whatsapp$/, 'WhatsApp'],
  [/^google$/, 'Google'],
  [/^qr$/, 'QR kod'],
];

/** Sayaç anahtarını okunur kaynak adına çevirir (eski kayıtlarda ham alan adı "chatgpt.com" ya da utm "chatgpt_com" olabilir). */
export function sourceLabel(key: string): string {
  const k = key.toLowerCase().replace(/_/g, '.').replace(/^www\./, '');
  for (const [re, name] of UTM_NAMES) if (re.test(k)) return name;
  for (const [re, name] of REFERRERS) if (re.test(k)) return name;
  return key.replace(/_/g, '.');
}

export type SourceGroup = 'Arama motoru' | 'Sosyal medya' | 'Yapay zeka' | 'Doğrudan' | 'Diğer siteler';

export function sourceGroup(label: string): SourceGroup {
  if (label === 'Doğrudan') return 'Doğrudan';
  if (AI_SOURCES.includes(label)) return 'Yapay zeka';
  if (SEARCH_SOURCES.includes(label)) return 'Arama motoru';
  if (SOCIAL_SOURCES.includes(label)) return 'Sosyal medya';
  return 'Diğer siteler';
}

/**
 * Oturumun kaynağı: önce gelinen sitenin adresi (referrer); yoksa utm_source; o da yoksa uygulama içi tarayıcı
 * (Instagram/Facebook/TikTok uygulamaları çoğu zaman referrer göndermez, yanlışlıkla "Doğrudan" görünürdü).
 */
export function resolveSource(referrer: string | undefined, utmSource: string | undefined, browser: string, ownHost: string): string {
  const ref = classifyReferrer(referrer, ownHost);
  if (ref !== 'Doğrudan') return ref;
  if (utmSource) {
    const u = utmSource.toLowerCase().trim();
    for (const [re, name] of UTM_NAMES) if (re.test(u)) return name;
  }
  if (/^Instagram/.test(browser)) return 'Instagram';
  if (/^Facebook/.test(browser)) return 'Facebook';
  if (/^TikTok/.test(browser)) return 'TikTok';
  return 'Doğrudan';
}

/** Firestore alan adı olarak güvenli, kısa anahtar üretir. */
export function sanitizeKey(raw: string, max = 60): string {
  let k = raw.replace(/[./~*[\]`\\]/g, '_').replace(/\s+/g, ' ').trim().slice(0, max);
  if (!k) return 'bilinmiyor';
  if (/^__.*__$/.test(k)) k = `x${k}`;
  return k;
}

/** Yolu sayaç anahtarına çevirir: "/kategori/masa" → "›kategori›masa". Geri çevirmek için unpathKey. */
export const pathKey = (p: string) => sanitizeKey(p.replace(/\//g, '›') || '›', 80);
export const unpathKey = (k: string) => k.replace(/›/g, '/');

export function istanbulParts(d: Date = new Date()): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** Sitede yapılan aramayı normalize eder; kullanışsızsa null. */
export function normalizeQuery(q: string | undefined): string | null {
  if (!q) return null;
  const n = q.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşüâîû\s+-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return n.length >= 2 ? n : null;
}

const SLUG_RE = /^[A-Za-z0-9_-]{1,100}$/;

export type Patch = { [k: string]: number | Patch };

export interface PatchContext {
  ua: string;
  ownHost: string;
  country?: string;
  city?: string;
  hour: number;
}

/** Sayfa yolunu sınıflar: ürün / kategori / genel sayfa / yok sayılacak. */
export function classifyPath(path: string): { kind: 'prod' | 'cat' | 'blog' | 'page' | 'skip'; key: string } {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (!p.startsWith('/') || p.startsWith('/admin') || p.startsWith('/api') || p.startsWith('/siparis')) return { kind: 'skip', key: '' };
  const prod = p.match(/^\/urun\/([^/]+)$/);
  if (prod && SLUG_RE.test(prod[1])) return { kind: 'prod', key: prod[1] };
  const cat = p.match(/^\/kategori\/([^/]+)$/);
  if (cat && SLUG_RE.test(cat[1])) return { kind: 'cat', key: cat[1] };
  const blog = p.match(/^\/blog\/([^/]+)$/);
  if (blog && SLUG_RE.test(blog[1])) return { kind: 'blog', key: blog[1] };
  return { kind: 'page', key: pathKey(p.slice(0, 120)) };
}

/** Bir istekten günlük sayaçlara eklenecek artışları üretir (hepsi +1/+süre). Boş patch = yazma. */
export function buildPatch(b: TrackPayload, ctx: PatchContext): Patch {
  const patch: Patch = {};
  const add = (map: string, key: string, n = 1) => {
    const m = (patch[map] ??= {}) as Patch;
    m[key] = ((m[key] as number) || 0) + n;
  };
  const num = (k: string, n = 1) => { patch[k] = ((patch[k] as number) || 0) + n; };

  if (b.t === 'pv') {
    const c = b.path ? classifyPath(b.path) : { kind: 'skip' as const, key: '' };
    if (c.kind === 'skip') return {};
    num('pv');
    add('hr', String(ctx.hour));
    if (c.kind === 'prod') { add('prod', c.key); if (b.pu) add('prodU', c.key); }
    else if (c.kind === 'cat') add('cat', c.key);
    else if (c.kind === 'blog') add('blog', c.key);
    else add('page', c.key);
    if (b.nd) num('uv');
    if (b.nv) num('newV');
    if (b.n === 2) num('multi');
    if (b.n === 1) {
      const ua = parseUA(ctx.ua);
      num('sess');
      add('dev', ua.device);
      add('os', ua.os);
      add('br', ua.browser);
      add('ref', resolveSource(b.ref, b.utm?.s, ua.browser, ctx.ownHost));
      if (b.utm?.s) add('utm', sanitizeKey(b.utm.s.toLowerCase(), 40));
      add('country', sanitizeKey((ctx.country || 'bilinmiyor').toUpperCase(), 10));
      add('city', sanitizeKey(ctx.city || 'bilinmiyor', 40));
    }
    return patch;
  }

  if (b.t === 'leave') {
    const sec = Math.round(b.dur ?? 0);
    if (!b.path || sec < 2) return {};
    const c = classifyPath(b.path);
    if (c.kind === 'skip') return {};
    const d = Math.min(sec, 1800);
    num('dur', d);
    if (b.fl) num('durN');
    if (c.kind === 'prod') { add('prodDur', c.key, d); if (b.fl) add('prodDurN', c.key); }
    return patch;
  }

  if (b.t === 'ev') {
    const slugOk = b.slug && SLUG_RE.test(b.slug) ? b.slug : null;
    switch (b.ev) {
      case 'whatsapp':
        add('ev', 'whatsapp');
        if (b.src) add('wasrc', sanitizeKey(b.src, 20));
        if (slugOk) add('pwa', slugOk);
        return patch;
      case 'cart_add':
        add('ev', 'cart_add');
        if (slugOk) add('pcart', slugOk);
        return patch;
      case 'cart_send':
        add('ev', 'cart_send');
        return patch;
      case 'blog_read':
        add('ev', 'blog_read');
        return patch;
      case 'search': {
        const q = normalizeQuery(b.q);
        if (!q) return {};
        add('ev', 'search');
        add('q', sanitizeKey(q, 40));
        if (b.zero) add('qz', sanitizeKey(q, 40));
        return patch;
      }
      case 'filter': {
        const f = normalizeQuery(b.q);
        if (!f) return {};
        add('ev', 'filter');
        add('flt', sanitizeKey(f, 40));
        return patch;
      }
      default:
        return {};
    }
  }

  return {};
}

export const mergeCounts = (a: Counts, b: Counts | undefined): Counts => {
  const out = { ...a };
  if (b) for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + (Number(v) || 0);
  return out;
};
