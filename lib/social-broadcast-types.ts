// Tek Merkezden Sosyal Medya Hızlı & Otomatik Gönderi Yayını — Ortak Sözleşme (server-only YOK).
import type { SocialPlatform } from './social-types';

export const ALL_SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
  'threads',
  'telegram',
  'pinterest',
  'tiktok',
] as const;

export type BroadcastKind = 'musteri' | 'urun' | 'atolye' | 'kampanya' | 'serbest';

export const BROADCAST_KINDS: readonly BroadcastKind[] = [
  'musteri',
  'urun',
  'atolye',
  'kampanya',
  'serbest',
] as const;

export const BROADCAST_KIND_LABELS: Record<BroadcastKind, string> = {
  musteri: 'Müşteri Siparişi / Sizden Gelenler',
  urun: 'Ürün Tanıtımı',
  atolye: 'Atölye & Üretim Anı',
  kampanya: 'Kampanya & Duyuru',
  serbest: 'Serbest Paylaşım',
};

export type BroadcastStatus = 'draft' | 'queued' | 'publishing' | 'done' | 'partial' | 'failed';

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: 'Taslak',
  queued: 'Sırada',
  publishing: 'Yayınlanıyor',
  done: 'Yayınlandı',
  partial: 'Kısmen yayınlandı',
  failed: 'Başarısız',
};

export type BroadcastTargetStatus = 'pending' | 'posted' | 'skipped' | 'failed';

export interface BroadcastTargetResult {
  status: BroadcastTargetStatus;
  remoteId?: string;
  permalink?: string;
  error?: string;
  updatedAt: number;
}

export interface GeneratedCaptions {
  /** Pinterest ve TikTok için kısa başlık (<= 90 karakter). */
  title: string;
  /** Instagram, Facebook, Telegram ve Pinterest açıklaması için zengin metin + hashtag'ler. */
  mainCaption: string;
  /** Threads için 500 karakter sınırına uygun özlü metin + az sayıda hashtag. */
  shortCaption: string;
  /** Ürün veya ana sayfa bağlantısı. */
  linkUrl: string;
}

export interface SocialBroadcast {
  id: string;
  kind: BroadcastKind;
  note: string;
  productId?: string;
  productTitle?: string;
  rawImageIds: string[];
  finalImageIds: string[];
  studioEnhance: boolean;
  studioSceneId?: string;
  instagramStory: boolean;
  platforms: SocialPlatform[];
  captions: GeneratedCaptions;
  status: BroadcastStatus;
  targets: Partial<Record<SocialPlatform, BroadcastTargetResult>>;
  storyStatus?: BroadcastTargetResult;
  scheduledAt?: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  studioError?: string;
}

export interface BroadcastSettings {
  /** Açıkken fotoğraf yüklenir yüklenmez varsayılan modda (anında veya kuyruk) otomatik gönderi oluşturur. */
  instantOnUpload: boolean;
  /** Varsayılan işlem modu: anında tüm platformlara yayınla veya kuyruğa ekle. */
  defaultMode: 'instant' | 'queue';
  /** Varsayılan seçili platformlar. */
  defaultPlatforms: SocialPlatform[];
  /** Varsayılan içerik türü. */
  defaultKind: BroadcastKind;
  /** Yüklenen ilk fotoğrafa ücretsiz stüdyo arka planı ekle. */
  defaultStudioEnhance: boolean;
  /** Varsayılan stüdyo sahnesi kimliği. */
  defaultStudioSceneId: string;
  /** Instagram seçiliyse Hikâye (Story) olarak da paylaş. */
  defaultInstagramStory: boolean;
  /** Otomasyon turu (/api/cron/main) başına kuyruktan yayınlanacak gönderi sayısı (1–3). */
  queuePerCycle: number;
}

export interface PreviewCaptionInput {
  kind: BroadcastKind;
  note?: string;
  productTitle?: string;
  productSlug?: string;
  productCategory?: string;
  priceMin?: number;
  priceMax?: number;
  seed?: string;
}

export interface CreateBroadcastInput {
  imageIds: string[];
  kind: BroadcastKind;
  note?: string;
  productId?: string;
  platforms: SocialPlatform[];
  instagramStory?: boolean;
  studioEnhance?: boolean;
  studioSceneId?: string;
  customCaptions?: Partial<GeneratedCaptions>;
  mode: 'instant' | 'queue' | 'draft';
}

export interface BroadcastPlatformInfo {
  platform: SocialPlatform;
  configured: boolean;
  enabled: boolean;
  detail?: string;
}

export interface BroadcastProductLite {
  id: string;
  title: string;
  slug: string;
  category: string;
  priceMin: number;
  priceMax: number;
  images: string[];
}

export interface BroadcastPageData {
  settings: BroadcastSettings;
  platforms: BroadcastPlatformInfo[];
  studioAvailable: boolean;
  studioProviderLabel: string | null;
  scenes: { id: string; label: string }[];
  products: BroadcastProductLite[];
  items: SocialBroadcast[];
  warnings: string[];
}
