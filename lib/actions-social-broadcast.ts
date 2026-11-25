'use server';

import { requireAdmin } from './require-admin';
import { getAllSocialStatus } from './social-run';
import { pickProvider } from './image-gen/registry';
import { STUDIO_SCENES } from './image-gen/prompts';
import { getProductsServer } from './products-server';
import { getCategory, getPriceMax, getPriceMin, getSlug, getTitle } from './product-utils';
import { displayTitle } from './format';
import { generateBroadcastCaptions } from './social-broadcast-utils';
import {
  createBroadcast,
  deleteBroadcast,
  getBroadcastSettings,
  listBroadcasts,
  publishBroadcast,
  saveBroadcastSettings,
  updateBroadcast,
} from './social-broadcast';
import { ALL_SOCIAL_PLATFORMS } from './social-broadcast-types';
import type {
  BroadcastPageData,
  BroadcastPlatformInfo,
  BroadcastProductLite,
  BroadcastSettings,
  CreateBroadcastInput,
  GeneratedCaptions,
  PreviewCaptionInput,
  SocialBroadcast,
} from './social-broadcast-types';
import type { SocialPlatform } from './social-types';

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const DEFAULT_BROADCAST_SETTINGS: BroadcastSettings = {
  instantOnUpload: false,
  defaultMode: 'queue',
  defaultPlatforms: [...ALL_SOCIAL_PLATFORMS],
  defaultKind: 'musteri',
  defaultStudioEnhance: false,
  defaultStudioSceneId: STUDIO_SCENES[0]?.id ?? 'beyaz-fon',
  defaultInstagramStory: true,
  queuePerCycle: 1,
};

/** Sosyal medya hızlı yayın sayfası için ayarlar, platform durumları, stüdyo, ürünler ve son yayınları getirir. */
export async function getBroadcastPageDataAction(): Promise<BroadcastPageData> {
  await requireAdmin();
  const warnings: string[] = [];

  const [settings, statuses, items, rawProducts] = await Promise.all([
    getBroadcastSettings().catch((e) => {
      warnings.push(`Yayın ayarları okunamadı: ${errMsg(e, 'bilinmeyen hata')}`);
      return DEFAULT_BROADCAST_SETTINGS;
    }),
    getAllSocialStatus().catch((e) => {
      warnings.push(`Platform durumları okunamadı: ${errMsg(e, 'bilinmeyen hata')}`);
      return [];
    }),
    listBroadcasts(30).catch((e) => {
      warnings.push(`Geçmiş yayınlar okunamadı: ${errMsg(e, 'bilinmeyen hata')}`);
      return [];
    }),
    getProductsServer().catch((e) => {
      warnings.push(`Ürün listesi okunamadı: ${errMsg(e, 'bilinmeyen hata')}`);
      return [];
    }),
  ]);

  const provider = pickProvider();
  const platforms: BroadcastPlatformInfo[] = statuses.map((s) => ({
    platform: s.platform,
    configured: s.configured,
    enabled: s.enabled,
    detail: s.detail,
  }));

  const products: BroadcastProductLite[] = rawProducts
    .filter((p) => (p.images ?? []).length > 0)
    .map((p) => ({
      id: p.id,
      title: displayTitle(getTitle(p)),
      slug: getSlug(p) || p.id,
      category: getCategory(p) || 'Özel Tasarım',
      priceMin: getPriceMin(p),
      priceMax: getPriceMax(p),
      images: p.images,
    }));

  return {
    settings,
    platforms,
    studioAvailable: !!provider,
    studioProviderLabel: provider?.label ?? null,
    scenes: STUDIO_SCENES.map((s) => ({ id: s.id, label: s.label })),
    products,
    items,
    warnings,
  };
}

/** Seçilen içerik türü, not ve ürün bilgisine göre platform metinlerini önizler. */
export async function previewBroadcastCaptionsAction(input: PreviewCaptionInput): Promise<GeneratedCaptions> {
  await requireAdmin();
  return generateBroadcastCaptions(input);
}

/** Yayın ayarlarını mevcut değerlerle birleştirerek kaydeder. */
export async function saveBroadcastSettingsAction(input: Partial<BroadcastSettings>): Promise<BroadcastSettings> {
  await requireAdmin();
  return saveBroadcastSettings({ ...(await getBroadcastSettings()), ...input });
}

/** Yeni yayın oluşturur ve seçilen moda göre (anında, kuyruk, taslak) işler. */
export async function createAndRunBroadcastAction(input: CreateBroadcastInput): Promise<SocialBroadcast> {
  await requireAdmin();
  return createBroadcast(input);
}

/** Mevcut bir yayını tüm hedef platformlara hemen gönderir. */
export async function publishBroadcastNowAction(id: string): Promise<SocialBroadcast> {
  await requireAdmin();
  return publishBroadcast(id);
}

/** Başarısız veya bekleyen hedef platformlar için yayını yeniden dener. */
export async function retryBroadcastAction(id: string): Promise<SocialBroadcast> {
  await requireAdmin();
  return publishBroadcast(id, { onlyFailedOrPending: true });
}

/** Taslak veya sıradaki bir yayının metinlerini, platformlarını veya durumunu günceller. */
export async function updateBroadcastAction(
  id: string,
  patch: { captions?: Partial<GeneratedCaptions>; platforms?: SocialPlatform[]; status?: 'queued' | 'draft' },
): Promise<SocialBroadcast> {
  await requireAdmin();
  return updateBroadcast(id, patch);
}

/** Bir yayını (ve istenirse bağlı görselleri) siler. */
export async function deleteBroadcastAction(id: string, deleteImages = false): Promise<void> {
  await requireAdmin();
  await deleteBroadcast(id, deleteImages);
}
