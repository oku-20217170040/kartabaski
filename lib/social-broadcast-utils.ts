// Sosyal Medya Otomatik Gönderi Yayını — Saf Metin Üreteci, Doğrulama ve Kuyruk Yardımcıları (0 TL, server-only YOK).
import { z } from 'zod';
import { PHONE_DISPLAY, SLOGAN } from './constants';
import { displayTitle, formatPriceRange } from './format';
import { SITE_URL } from './site';
import {
  ALL_SOCIAL_PLATFORMS,
  BROADCAST_KINDS,
  type BroadcastKind,
  type BroadcastSettings,
  type BroadcastStatus,
  type BroadcastTargetResult,
  type GeneratedCaptions,
  type PreviewCaptionInput,
  type SocialBroadcast,
} from './social-broadcast-types';
import { clip, hashtagsFor, hashStr } from './social-content-utils';
import type { SocialPlatform } from './social-types';

const CLOUDINARY_PUBLIC_ID_RE = /^karta-baski\/(?:urunler|studio|sosyal)\/[A-Za-z0-9_/-]{1,160}$/;
const VALID_PLATFORM_SET = new Set<SocialPlatform>(ALL_SOCIAL_PLATFORMS);

const MAX_TITLE_LEN = 90;
const MAX_MAIN_CAPTION_LEN = 2000;
const MAX_SHORT_CAPTION_LEN = 500;

const HOOK_POOLS: Record<BroadcastKind, readonly string[]> = {
  musteri: [
    'Sizden gelen bu güzel kareyle atölyemizde yüzler güldü. Kişiye özel baskılarınız özenle hazırlanıyor!',
    'Bir müşterimizin hayal ettiği tasarım daha kupasına hayat buldu. İyi günlerde kullanılsın!',
    'Her yudumda özel bir anı saklı! Siz tasarlayın, biz en canlı renklerle kupanıza basalım.',
    'Atölyemizden çıkan taze bir müşteri siparişi! Sizin tasarımınızı da hazırlamak için sabırsızlanıyoruz.',
    'Sevdiklerinize ya da kendinize kalıcı bir hatıra: sizden gelenlerle gurur duyuyoruz.',
  ],
  urun: [
    'Günün en keyifli kahve molasına eşlik edecek özel tasarım kupamızla tanışın.',
    'İsim, fotoğraf ya da logonuzla tamamen size özel hale gelen şık ve dayanıklı kupa baskısı.',
    'Sevdiklerinize anlamlı, kendinize keyifli bir hediye arıyorsanız doğru yerdesiniz.',
    'Canlı baskı kalitesi ve özenli paketlemeyle hayalinizdeki tasarım artık masanızda.',
    'Her detayıyla özenle hazırlanan bu modelimiz, özel tasarımlarınız için hazır.',
  ],
  atolye: [
    'KAR-TA BASKI atölyesinde bugün de renkler ve tasarımlar bir araya geliyor!',
    'Fırından taze çıkan baskılar, titiz kalite kontrol ve özenli paketleme: perde arkasına hoş geldiniz.',
    'Her kupayı kendi hediyemizmiş gibi özenle hazırlıyoruz. Atölyemizden sıcak kareler!',
    'Tasarımın kupayla buluştuğu an: yüksek ısıda kalıcı, canlı ve pürüzsüz baskı süreci.',
    'Hayalinizdeki fikri gerçeğe dönüştürdüğümüz atölyemizde mesai keyifle sürüyor.',
  ],
  kampanya: [
    'Özel günler ve toplu siparişler için kaçırılmayacak kişiye özel baskı fırsatları başladı!',
    'Sevdiklerinizi mutlu edecek kişiye özel hediyelerde şimdi tam zamanı!',
    'Kurumsal hediyelerden özel gün sürprizlerine kadar avantajlı baskı seçeneklerimizle yanınızdayız.',
    'Planladığınız hediyeler için erken davranın, tasarımınızı birlikte hazırlayıp zamanında ulaştıralım.',
    'Sınırlı süreli fırsatlarla kendi tasarımınızı kupaya taşımanın tam sırası!',
  ],
  serbest: [
    `${SLOGAN} — kahve keyfinize ve masanıza karakter katan tasarımlar.`,
    'Küçük bir detay, büyük bir tebessüm! Kişiye özel baskılı kupalarla anılarınızı yaşatın.',
    'Bugün kendinize ya da sevdiğinize küçük ama anlamlı bir sürpriz yapmaya ne dersiniz?',
    'Sıradan kupalara veda edin; fotoğrafınız, çiziminiz veya mesajınızla fark yaratın.',
    'Sıcacık bir kahve eşliğinde size özel bir tasarım… Dilediğiniz modeli birlikte hazırlayalım.',
  ],
};

const KIND_DEFAULT_TITLES: Record<BroadcastKind, string> = {
  musteri: 'Sizden Gelen Kişiye Özel Kupa Baskısı',
  urun: 'Kişiye Özel Baskılı Kupa Modeli',
  atolye: 'KAR-TA BASKI Atölyesinden Üretim Kareleri',
  kampanya: 'KAR-TA BASKI Özel Baskı Fırsatları',
  serbest: `KAR-TA BASKI — ${SLOGAN}`,
};

const KIND_HASHTAGS: Record<BroadcastKind, readonly [string, string]> = {
  musteri: ['#sizdengelenler', '#müşterimemnuniyeti'],
  urun: ['#hediyefikirleri', '#tasarımkupa'],
  atolye: ['#üretim', '#baskıatölyesi'],
  kampanya: ['#kampanya', '#fırsat'],
  serbest: ['#kahvemolası', '#gününkaresi'],
};

function truncatePreserveLines(text: string, maxLen: number): string {
  const normalized = text.trim();
  if (maxLen <= 0) return '';
  if (normalized.length <= maxLen) return normalized;
  if (maxLen === 1) return '…';
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

function stripHashtags(text: string): string {
  return text.replace(/#[\wçğıöşüÇĞİÖŞÜ-]+/g, '').replace(/\s+/g, ' ').trim();
}

function resolveKind(kind: unknown): BroadcastKind {
  return typeof kind === 'string' && (BROADCAST_KINDS as readonly string[]).includes(kind)
    ? (kind as BroadcastKind)
    : 'serbest';
}

function buildLinkUrl(productSlug?: string): string {
  const slug = (productSlug ?? '').trim().replace(/^\/+/, '');
  return slug ? `${SITE_URL}/urun/${slug}` : SITE_URL;
}

function buildPriceText(priceMin?: number, priceMax?: number): string | null {
  const min = typeof priceMin === 'number' && Number.isFinite(priceMin) && priceMin > 0 ? priceMin : 0;
  const max = typeof priceMax === 'number' && Number.isFinite(priceMax) && priceMax > 0 ? priceMax : 0;
  if (min <= 0 && max <= 0) return null;
  return formatPriceRange(min, max);
}

function buildTitle(kind: BroadcastKind, cleanProductTitle: string, cleanNote: string): string {
  if (cleanProductTitle) {
    return clip(stripHashtags(cleanProductTitle), MAX_TITLE_LEN);
  }
  const noteWithoutTags = stripHashtags(cleanNote);
  if (noteWithoutTags) {
    const firstSentence = noteWithoutTags.split(/[.!?\n]/)[0]?.trim() || noteWithoutTags;
    return clip(firstSentence, MAX_TITLE_LEN);
  }
  return clip(KIND_DEFAULT_TITLES[kind], MAX_TITLE_LEN);
}

// ── Ayarlar ──────────────────────────────────────────────────────────────────

/** Sosyal medya tek merkez yayın ayarlarının varsayılan değerlerini döndürür. */
export function defaultBroadcastSettings(): BroadcastSettings {
  return {
    instantOnUpload: false,
    defaultMode: 'instant',
    defaultPlatforms: [...ALL_SOCIAL_PLATFORMS],
    defaultKind: 'musteri',
    defaultStudioEnhance: false,
    defaultStudioSceneId: 'ahsap-masa',
    defaultInstagramStory: false,
    queuePerCycle: 1,
  };
}

const boolSchema = z.boolean();
const modeSchema = z.enum(['instant', 'queue']);
const kindSchema = z.enum(['musteri', 'urun', 'atolye', 'kampanya', 'serbest']);
const sceneIdSchema = z.string().trim().min(1).max(80);
const finiteNumberSchema = z.number().finite();

/** Ham ayar nesnesini güvenli biçimde doğrular; bozuk veya eksik alanları varsayılana düşürür. */
export function parseBroadcastSettings(raw: unknown): BroadcastSettings {
  const def = defaultBroadcastSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return def;
  }

  const rec = raw as Record<string, unknown>;

  const instantOnUpload = boolSchema.safeParse(rec.instantOnUpload);
  const defaultMode = modeSchema.safeParse(rec.defaultMode);
  const defaultKind = kindSchema.safeParse(rec.defaultKind);
  const defaultStudioEnhance = boolSchema.safeParse(rec.defaultStudioEnhance);
  const defaultStudioSceneId = sceneIdSchema.safeParse(rec.defaultStudioSceneId);
  const defaultInstagramStory = boolSchema.safeParse(rec.defaultInstagramStory);
  const queuePerCycleRaw = finiteNumberSchema.safeParse(rec.queuePerCycle);

  let defaultPlatforms: SocialPlatform[] = def.defaultPlatforms;
  if (Array.isArray(rec.defaultPlatforms)) {
    const seen = new Set<SocialPlatform>();
    for (const item of rec.defaultPlatforms) {
      if (typeof item === 'string' && VALID_PLATFORM_SET.has(item as SocialPlatform)) {
        seen.add(item as SocialPlatform);
      }
    }
    defaultPlatforms = Array.from(seen);
  }

  const queuePerCycle = queuePerCycleRaw.success
    ? Math.min(3, Math.max(1, Math.round(queuePerCycleRaw.data)))
    : def.queuePerCycle;

  return {
    instantOnUpload: instantOnUpload.success ? instantOnUpload.data : def.instantOnUpload,
    defaultMode: defaultMode.success ? defaultMode.data : def.defaultMode,
    defaultPlatforms,
    defaultKind: defaultKind.success ? defaultKind.data : def.defaultKind,
    defaultStudioEnhance: defaultStudioEnhance.success ? defaultStudioEnhance.data : def.defaultStudioEnhance,
    defaultStudioSceneId: defaultStudioSceneId.success ? defaultStudioSceneId.data : def.defaultStudioSceneId,
    defaultInstagramStory: defaultInstagramStory.success ? defaultInstagramStory.data : def.defaultInstagramStory,
    queuePerCycle,
  };
}

// ── Görsel Kimliği Doğrulama ─────────────────────────────────────────────────

/** Yalnızca güvenli Cloudinary `public_id` değerlerini tekrarsız ve en çok `max` adet döndürür. */
export function sanitizeBroadcastImageIds(raw: unknown, max = 10): string[] {
  if (!Array.isArray(raw) || typeof max !== 'number' || !Number.isFinite(max) || max <= 0) {
    return [];
  }
  const limit = Math.floor(max);
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (item.startsWith('/') || item.includes('..') || item.includes('//') || item.endsWith('/')) {
      continue;
    }
    if (!CLOUDINARY_PUBLIC_ID_RE.test(item)) continue;
    seen.add(item);
    if (seen.size >= limit) break;
  }

  return Array.from(seen);
}

// ── Gönderi Metni Üretimi ────────────────────────────────────────────────────

/** Ücretsiz, deterministik Türkçe gönderi başlığı, ana açıklama, Threads kısa metni ve bağlantısı üretir. */
export function generateBroadcastCaptions(input: PreviewCaptionInput): GeneratedCaptions {
  const kind = resolveKind(input.kind);
  const cleanNote = (input.note ?? '').trim();
  const cleanProductTitle = input.productTitle ? displayTitle(input.productTitle) : '';
  const priceText = buildPriceText(input.priceMin, input.priceMax);
  const linkUrl = buildLinkUrl(input.productSlug);

  const seedSource = input.seed || cleanNote || cleanProductTitle || kind;
  const hooks = HOOK_POOLS[kind];
  const hook = hooks[hashStr(seedSource) % hooks.length];

  const categoryTags = hashtagsFor(input.productCategory?.trim() || 'Özel Tasarım', 8);
  const kindTags = KIND_HASHTAGS[kind];
  const allTags = Array.from(new Set([...categoryTags, ...kindTags]));

  const ctaLine = `📲 Sipariş ve tasarım için WhatsApp: ${PHONE_DISPLAY}`;
  const linkLine = `🔗 ${linkUrl}`;
  const tagsLine = allTags.join(' ');

  const title = buildTitle(kind, cleanProductTitle, cleanNote);

  // Ana açıklama (Instagram, Facebook, Telegram, Pinterest)
  const mainHeader: string[] = [];
  if (cleanProductTitle) {
    mainHeader.push(`☕ ${cleanProductTitle}`);
  }
  mainHeader.push(hook);

  const mainFooterParts: string[] = [];
  if (priceText) {
    mainFooterParts.push(`💰 Fiyat: ${priceText}`);
  }
  mainFooterParts.push(`✨ ${SLOGAN}`);
  mainFooterParts.push('', ctaLine, linkLine, '', tagsLine);

  const headerText = mainHeader.join('\n\n');
  const footerText = mainFooterParts.join('\n');

  let mainCaption: string;
  if (cleanNote) {
    const fixedLen = headerText.length + footerText.length + 4; // '\n\n' + '\n\n'
    const noteBudget = Math.max(0, MAX_MAIN_CAPTION_LEN - fixedLen);
    const fittedNote = noteBudget > 0 ? truncatePreserveLines(cleanNote, noteBudget) : '';
    mainCaption = fittedNote
      ? `${headerText}\n\n${fittedNote}\n\n${footerText}`
      : `${headerText}\n\n${footerText}`;
  } else {
    mainCaption = `${headerText}\n\n${footerText}`;
  }
  mainCaption = truncatePreserveLines(mainCaption, MAX_MAIN_CAPTION_LEN);

  // Threads kısa metni (KESİNLİKLE <= 500 karakter)
  const shortTags = allTags.slice(0, 3).join(' ');
  const shortFooter = [
    `📲 Sipariş ve tasarım için WhatsApp: ${PHONE_DISPLAY}`,
    `👉 ${linkUrl}`,
    shortTags,
  ]
    .filter(Boolean)
    .join('\n');

  const shortLeadParts: string[] = [];
  if (cleanProductTitle) shortLeadParts.push(`☕ ${clip(cleanProductTitle, 90)}`);
  if (priceText) shortLeadParts.push(`💰 ${priceText}`);
  if (cleanNote) shortLeadParts.push(cleanNote);
  else shortLeadParts.push(hook);

  const rawBody = shortLeadParts.join('\n');
  const bodyBudget = Math.max(0, MAX_SHORT_CAPTION_LEN - shortFooter.length - 1);
  const fittedBody = bodyBudget > 0 ? truncatePreserveLines(rawBody, bodyBudget) : '';
  const shortCaption = truncatePreserveLines(
    fittedBody ? `${fittedBody}\n${shortFooter}` : shortFooter,
    MAX_SHORT_CAPTION_LEN,
  );

  return {
    title,
    mainCaption,
    shortCaption,
    linkUrl,
  };
}

/** Kullanıcının elle düzenlediği alanları sınırlar içinde korur; boş alanları üretilen metinle tamamlar. */
export function mergeCaptions(
  generated: GeneratedCaptions,
  custom?: Partial<GeneratedCaptions>,
): GeneratedCaptions {
  if (!custom) {
    return { ...generated };
  }

  const customTitle = custom.title?.trim();
  const customMain = custom.mainCaption?.trim();
  const customShort = custom.shortCaption?.trim();
  const customLink = custom.linkUrl?.trim();

  return {
    title: customTitle ? clip(customTitle, MAX_TITLE_LEN) : generated.title,
    mainCaption: customMain
      ? truncatePreserveLines(customMain, MAX_MAIN_CAPTION_LEN)
      : generated.mainCaption,
    shortCaption: customShort
      ? truncatePreserveLines(customShort, MAX_SHORT_CAPTION_LEN)
      : generated.shortCaption,
    linkUrl: customLink || generated.linkUrl,
  };
}

// ── Durum ve Kuyruk Yardımcıları ─────────────────────────────────────────────

/** Seçilen platformların hedef sonuçlarına göre gönderinin genel durumunu hesaplar. */
export function computeBroadcastStatus(
  platforms: SocialPlatform[],
  targets: Partial<Record<SocialPlatform, BroadcastTargetResult>>,
): BroadcastStatus {
  if (platforms.length === 0) {
    return 'failed';
  }

  let hasAnyResult = false;
  let hasPending = false;
  let hasUnstarted = false;
  let postedCount = 0;
  let failedCount = 0;

  for (const platform of platforms) {
    const result = targets[platform];
    if (!result) {
      hasUnstarted = true;
      continue;
    }
    hasAnyResult = true;
    if (result.status === 'pending') {
      hasPending = true;
    } else if (result.status === 'posted') {
      postedCount += 1;
    } else if (result.status === 'failed') {
      failedCount += 1;
    }
  }

  if (!hasAnyResult) {
    return 'queued';
  }
  if (hasPending || hasUnstarted) {
    return 'publishing';
  }
  if (postedCount > 0 && failedCount === 0) {
    return 'done';
  }
  if (postedCount > 0 && failedCount > 0) {
    return 'partial';
  }
  return 'failed';
}

/** Kuyruktaki zamanı gelmiş gönderileri FIFO (`createdAt` artan) sırayla en çok `limit` adet seçer. */
export function pickQueuedBroadcasts(
  items: SocialBroadcast[],
  limit: number,
  now = Date.now(),
): SocialBroadcast[] {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return [];
  }
  const maxItems = Math.floor(limit);
  return items
    .filter((item) => item.status === 'queued' && (!item.scheduledAt || item.scheduledAt <= now))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, maxItems);
}
