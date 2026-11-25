import 'server-only';
import { adminDb } from './firebase-admin';
import { cloudinaryUrl, displayTitle } from './format';
import { SITE_URL } from './site';
import { uploadToCloudinary, deleteCloudinaryImages } from './cloudinary-admin';
import { pickProvider } from './image-gen/registry';
import { STUDIO_SCENES, buildPrompt } from './image-gen/prompts';
import { logActivity } from './social-settings';
import {
  isConnected as isInstagramConnected,
  refreshTokenIfNeeded as refreshInstagramTokenIfNeeded,
  publishSinglePost,
  publishCarousel,
  publishStory,
} from './instagram';
import { getFacebookConfig, publishToFacebookPage } from './facebook-page';
import {
  threadsConfigured,
  refreshThreadsTokenIfNeeded,
  publishThreadsMedia,
} from './threads';
import { channelConfigured, tgChannel } from './telegram-channel';
import {
  pinterestConfigured,
  refreshPinterestTokenIfNeeded,
  listBoards,
  createBoard,
  createPin,
} from './pinterest';
import { findBoard, altBoardName, isBoardNameTaken, type PinterestBoard } from './pinterest-utils';
import { tiktokConfigured, getTikTokState, sendPhotoDraft } from './tiktok';
import { tiktokPhotoUrls } from './tiktok-utils';
import {
  ALL_SOCIAL_PLATFORMS,
  BROADCAST_KINDS,
  type BroadcastKind,
  type BroadcastSettings,
  type BroadcastStatus,
  type BroadcastTargetResult,
  type BroadcastTargetStatus,
  type CreateBroadcastInput,
  type GeneratedCaptions,
  type SocialBroadcast,
} from './social-broadcast-types';
import {
  computeBroadcastStatus,
  generateBroadcastCaptions,
  mergeCaptions,
  parseBroadcastSettings,
  pickQueuedBroadcasts,
  sanitizeBroadcastImageIds,
} from './social-broadcast-utils';
import type { SocialPlatform } from './social-types';

const SETTINGS_COL = 'social_broadcast_meta';
const SETTINGS_DOC = 'settings';
const BROADCASTS_COL = 'social_broadcasts';
const SOCIAL_IMAGE_FOLDER = 'karta-baski/sosyal';

const VALID_PLATFORMS = new Set<SocialPlatform>(ALL_SOCIAL_PLATFORMS);
const VALID_KINDS = new Set<BroadcastKind>(BROADCAST_KINDS);
const VALID_STATUSES = new Set<BroadcastStatus>(['draft', 'queued', 'publishing', 'done', 'partial', 'failed']);
const VALID_TARGET_STATUSES = new Set<BroadcastTargetStatus>(['pending', 'posted', 'skipped', 'failed']);

const settingsRef = () => adminDb.collection(SETTINGS_COL).doc(SETTINGS_DOC);
const broadcastsCol = () => adminDb.collection(BROADCASTS_COL);
const broadcastRef = (id: string) => broadcastsCol().doc(id);

const shortError = (err: unknown, max = 250): string =>
  (err instanceof Error ? err.message : String(err || 'Bilinmeyen hata')).replace(/\s+/g, ' ').trim().slice(0, max);

/** Firestore undefined değer kabul etmez; nesne ve alt nesnelerdeki undefined alanları temizler. */
function cleanForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = cleanForFirestore(v);
      }
    }
    return out as T;
  }
  return value;
}

function sanitizePlatforms(raw: unknown): SocialPlatform[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<SocialPlatform>();
  for (const item of raw) {
    if (typeof item === 'string' && VALID_PLATFORMS.has(item as SocialPlatform)) {
      seen.add(item as SocialPlatform);
    }
  }
  return Array.from(seen);
}

function parseTargetResult(raw: unknown): BroadcastTargetResult | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const status = typeof r.status === 'string' && VALID_TARGET_STATUSES.has(r.status as BroadcastTargetStatus)
    ? (r.status as BroadcastTargetStatus)
    : 'failed';
  return {
    status,
    ...(typeof r.remoteId === 'string' && r.remoteId ? { remoteId: r.remoteId } : {}),
    ...(typeof r.permalink === 'string' && r.permalink ? { permalink: r.permalink } : {}),
    ...(typeof r.error === 'string' && r.error ? { error: r.error } : {}),
    updatedAt: Number(r.updatedAt) || 0,
  };
}

function parseCaptions(raw: unknown): GeneratedCaptions {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    title: typeof r.title === 'string' ? r.title : '',
    mainCaption: typeof r.mainCaption === 'string' ? r.mainCaption : '',
    shortCaption: typeof r.shortCaption === 'string' ? r.shortCaption : '',
    linkUrl: typeof r.linkUrl === 'string' ? r.linkUrl : SITE_URL,
  };
}

function toSocialBroadcast(id: string, data: Record<string, unknown>): SocialBroadcast {
  const rawImageIds = Array.isArray(data.rawImageIds)
    ? data.rawImageIds.filter((x): x is string => typeof x === 'string')
    : [];
  const finalImageIdsRaw = Array.isArray(data.finalImageIds)
    ? data.finalImageIds.filter((x): x is string => typeof x === 'string')
    : [];
  const finalImageIds = finalImageIdsRaw.length ? finalImageIdsRaw : [...rawImageIds];

  const targetsRaw = data.targets && typeof data.targets === 'object' && !Array.isArray(data.targets)
    ? (data.targets as Record<string, unknown>)
    : {};
  const targets: Partial<Record<SocialPlatform, BroadcastTargetResult>> = {};
  for (const platform of ALL_SOCIAL_PLATFORMS) {
    const parsed = parseTargetResult(targetsRaw[platform]);
    if (parsed) targets[platform] = parsed;
  }

  const kind: BroadcastKind =
    typeof data.kind === 'string' && VALID_KINDS.has(data.kind as BroadcastKind)
      ? (data.kind as BroadcastKind)
      : 'serbest';
  const status: BroadcastStatus =
    typeof data.status === 'string' && VALID_STATUSES.has(data.status as BroadcastStatus)
      ? (data.status as BroadcastStatus)
      : 'draft';

  const storyStatus = parseTargetResult(data.storyStatus);

  return {
    id,
    kind,
    note: typeof data.note === 'string' ? data.note : '',
    ...(typeof data.productId === 'string' && data.productId ? { productId: data.productId } : {}),
    ...(typeof data.productTitle === 'string' && data.productTitle ? { productTitle: data.productTitle } : {}),
    rawImageIds,
    finalImageIds,
    studioEnhance: Boolean(data.studioEnhance),
    ...(typeof data.studioSceneId === 'string' && data.studioSceneId ? { studioSceneId: data.studioSceneId } : {}),
    instagramStory: Boolean(data.instagramStory),
    platforms: sanitizePlatforms(data.platforms),
    captions: parseCaptions(data.captions),
    status,
    targets,
    ...(storyStatus ? { storyStatus } : {}),
    ...(typeof data.scheduledAt === 'number' && Number.isFinite(data.scheduledAt) ? { scheduledAt: data.scheduledAt } : {}),
    createdAt: Number(data.createdAt) || 0,
    updatedAt: Number(data.updatedAt) || 0,
    ...(typeof data.publishedAt === 'number' && Number.isFinite(data.publishedAt) ? { publishedAt: data.publishedAt } : {}),
    ...(typeof data.studioError === 'string' && data.studioError ? { studioError: data.studioError } : {}),
  };
}

// ── Ayarlar ──────────────────────────────────────────────────────────────────

/** Tek merkez yayın ayarlarını okur (yoksa güvenli varsayılanları döndürür). */
export async function getBroadcastSettings(): Promise<BroadcastSettings> {
  const snap = await settingsRef().get();
  return parseBroadcastSettings(snap.data());
}

/** Tek merkez yayın ayarlarını doğrular ve Firestore'a kaydeder. */
export async function saveBroadcastSettings(raw: unknown): Promise<BroadcastSettings> {
  const settings = parseBroadcastSettings(raw);
  await settingsRef().set(cleanForFirestore({ ...settings, updatedAt: Date.now() }));
  return settings;
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/** En yeni yayınları listeler. */
export async function listBroadcasts(limit = 30): Promise<SocialBroadcast[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 30)));
  const snap = await broadcastsCol().orderBy('createdAt', 'desc').limit(safeLimit).get();
  return snap.docs.map((doc) => toSocialBroadcast(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

/** Kimliğe göre tek bir yayını getirir; yoksa null döndürür. */
export async function getBroadcast(id: string): Promise<SocialBroadcast | null> {
  const cleanId = id.trim();
  if (!cleanId) return null;
  const snap = await broadcastRef(cleanId).get();
  if (!snap.exists) return null;
  return toSocialBroadcast(snap.id, (snap.data() ?? {}) as Record<string, unknown>);
}

// ── Oluşturma ────────────────────────────────────────────────────────────────

interface ProductMeta {
  productId: string;
  productTitle?: string;
  productSlug?: string;
  productCategory?: string;
  priceMin?: number;
  priceMax?: number;
}

async function loadProductMeta(productId: string): Promise<ProductMeta> {
  const snap = await adminDb.collection('products').doc(productId).get();
  if (!snap.exists) {
    return { productId };
  }
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  const rawTitle = d.title ?? d.baslik ?? d.isim ?? d.name;
  const productTitle = typeof rawTitle === 'string' && rawTitle.trim() ? displayTitle(rawTitle.trim()) : undefined;
  const rawSlug = d.slug;
  const productSlug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : snap.id;
  const rawCat = d.category ?? d.kategori ?? d.Category;
  const productCategory = typeof rawCat === 'string' && rawCat.trim() ? rawCat.trim() : undefined;
  const priceMin = Number(d.priceMin ?? d.priceTRY ?? d.price ?? d.fiyat ?? 0) || undefined;
  const priceMax = Number(d.priceMax ?? d.priceMin ?? d.priceTRY ?? d.price ?? d.fiyat ?? 0) || undefined;
  return {
    productId: snap.id,
    productTitle,
    productSlug,
    productCategory,
    priceMin,
    priceMax,
  };
}

/** Yeni bir sosyal medya yayını oluşturur; mode 'instant' ise hemen yayınlar. */
export async function createBroadcast(input: CreateBroadcastInput, now = Date.now()): Promise<SocialBroadcast> {
  const rawImageIds = sanitizeBroadcastImageIds(input.imageIds, 10);
  if (rawImageIds.length === 0) {
    throw new Error('En az bir fotoğraf yükleyin.');
  }

  const productId = input.productId?.trim();
  const productMeta = productId ? await loadProductMeta(productId) : undefined;

  const ref = broadcastsCol().doc();
  const generated = generateBroadcastCaptions({
    kind: input.kind,
    note: input.note,
    productTitle: productMeta?.productTitle,
    productSlug: productMeta?.productSlug,
    productCategory: productMeta?.productCategory,
    priceMin: productMeta?.priceMin,
    priceMax: productMeta?.priceMax,
    seed: ref.id,
  });
  const captions = mergeCaptions(generated, input.customCaptions);
  const platforms = sanitizePlatforms(input.platforms);
  const status: BroadcastStatus = input.mode === 'draft' ? 'draft' : 'queued';

  const broadcast: SocialBroadcast = {
    id: ref.id,
    kind: VALID_KINDS.has(input.kind) ? input.kind : 'serbest',
    note: (input.note ?? '').trim(),
    ...(productMeta ? { productId: productMeta.productId } : {}),
    ...(productMeta?.productTitle ? { productTitle: productMeta.productTitle } : {}),
    rawImageIds,
    finalImageIds: [...rawImageIds],
    studioEnhance: Boolean(input.studioEnhance),
    ...(input.studioSceneId?.trim() ? { studioSceneId: input.studioSceneId.trim() } : {}),
    instagramStory: Boolean(input.instagramStory),
    platforms,
    captions,
    status,
    targets: {},
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(cleanForFirestore(broadcast));

  if (input.mode === 'instant') {
    return publishBroadcast(ref.id, {}, now);
  }
  return broadcast;
}

// ── Stüdyo Köprüsü & Platform Dağıtımı ───────────────────────────────────────

async function maybeEnhanceFirstImage(
  item: SocialBroadcast,
): Promise<{ finalImageIds: string[]; studioError?: string }> {
  const alreadyEnhanced = item.finalImageIds.length > 0 && item.finalImageIds[0] !== item.rawImageIds[0];
  if (!item.studioEnhance || alreadyEnhanced || item.rawImageIds.length === 0) {
    return { finalImageIds: [...item.finalImageIds], studioError: item.studioError };
  }

  try {
    const provider = pickProvider();
    if (!provider) {
      return {
        finalImageIds: [...item.finalImageIds],
        studioError: 'Bağlı görsel sağlayıcı bulunamadı; orijinal fotoğraf kullanıldı.',
      };
    }

    const scene = STUDIO_SCENES.find((s) => s.id === item.studioSceneId) ?? STUDIO_SCENES[0];
    if (!scene) {
      return {
        finalImageIds: [...item.finalImageIds],
        studioError: 'Stüdyo sahnesi bulunamadı; orijinal fotoğraf kullanıldı.',
      };
    }

    const refTransform = provider.id === 'cloudflare' ? 'f_jpg,q_auto,w_512,c_limit' : 'f_jpg,q_auto,w_1536,c_limit';
    const refUrl = cloudinaryUrl(item.rawImageIds[0], refTransform);
    const prompt = buildPrompt(scene, {
      title: item.productTitle || item.captions.title || 'Kişiye Özel Baskılı Kupa',
    });

    const result = await provider.generate({
      referenceUrls: [refUrl],
      prompt,
      aspectRatio: scene.aspectRatio,
    });

    const img = result.images[0];
    if (!img || (!img.data && !img.url)) {
      throw new Error('Stüdyo sağlayıcısı görsel döndürmedi.');
    }

    const file = img.data
      ? `data:${img.mimeType || 'image/png'};base64,${Buffer.from(img.data).toString('base64')}`
      : (img.url as string);

    const studioPublicId = await uploadToCloudinary(file, SOCIAL_IMAGE_FOLDER);
    return {
      finalImageIds: [studioPublicId, ...item.rawImageIds.slice(1)],
    };
  } catch (err) {
    return {
      finalImageIds: [...item.finalImageIds],
      studioError: shortError(err),
    };
  }
}

async function ensurePinterestBoard(boards: PinterestBoard[], name: string): Promise<PinterestBoard> {
  const existing = findBoard(boards, name);
  if (existing) return existing;
  try {
    const created = await createBoard(name, 'KAR-TA BASKI');
    boards.push(created);
    return created;
  } catch (err) {
    if (!isBoardNameTaken(shortError(err))) {
      throw err;
    }
    const created = await createBoard(altBoardName(name), 'KAR-TA BASKI');
    boards.push(created);
    return created;
  }
}

async function publishToPlatform(
  platform: SocialPlatform,
  item: SocialBroadcast,
  urls: string[],
  finalImageIds: string[],
  now: number,
): Promise<{ target: BroadcastTargetResult; storyStatus?: BroadcastTargetResult }> {
  try {
    switch (platform) {
      case 'instagram': {
        if (!(await isInstagramConnected())) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        await refreshInstagramTokenIfNeeded(now);
        const remoteId = urls.length === 1
          ? await publishSinglePost(urls[0], item.captions.mainCaption)
          : await publishCarousel(urls.slice(0, 10), item.captions.mainCaption);
        await logActivity('instagram', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);

        let storyStatus: BroadcastTargetResult | undefined;
        if (item.instagramStory) {
          try {
            const storyId = await publishStory(urls[0]);
            storyStatus = { status: 'posted', remoteId: storyId, updatedAt: now };
          } catch (storyErr) {
            storyStatus = { status: 'failed', error: shortError(storyErr), updatedAt: now };
          }
        }
        return {
          target: { status: 'posted', remoteId, updatedAt: now },
          ...(storyStatus ? { storyStatus } : {}),
        };
      }

      case 'facebook': {
        const cfg = getFacebookConfig();
        if (!cfg) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        const remoteId = await publishToFacebookPage(urls, item.captions.mainCaption, cfg);
        await logActivity('facebook', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);
        return { target: { status: 'posted', remoteId, updatedAt: now } };
      }

      case 'threads': {
        if (!threadsConfigured()) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        await refreshThreadsTokenIfNeeded(now);
        const out = await publishThreadsMedia(urls, item.captions.shortCaption);
        await logActivity('threads', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);
        return {
          target: {
            status: 'posted',
            remoteId: out.id,
            ...(out.permalink ? { permalink: out.permalink } : {}),
            updatedAt: now,
          },
        };
      }

      case 'telegram': {
        if (!channelConfigured()) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        const caption = item.captions.mainCaption.slice(0, 1024);
        const res = urls.length === 1
          ? await tgChannel('sendPhoto', { photo: urls[0], caption })
          : await tgChannel('sendMediaGroup', {
              media: urls.slice(0, 10).map((u, idx) => ({
                type: 'photo',
                media: u,
                ...(idx === 0 ? { caption } : {}),
              })),
            });
        if (!res.ok) {
          throw new Error(res.error || 'Telegram gönderimi başarısız');
        }
        await logActivity('telegram', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);
        return {
          target: {
            status: 'posted',
            ...(res.messageId !== undefined ? { remoteId: String(res.messageId) } : {}),
            updatedAt: now,
          },
        };
      }

      case 'pinterest': {
        if (!(await pinterestConfigured())) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        await refreshPinterestTokenIfNeeded(now);
        const boards = await listBoards();
        const board = await ensurePinterestBoard(boards, 'Kişiye Özel Kupalar');
        const pinId = await createPin({
          boardId: board.id,
          title: item.captions.title,
          description: item.captions.mainCaption.slice(0, 500),
          link: item.captions.linkUrl,
          imageUrls: urls.slice(0, 5),
        });
        await logActivity('pinterest', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);
        return { target: { status: 'posted', remoteId: pinId, updatedAt: now } };
      }

      case 'tiktok': {
        if (!tiktokConfigured()) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        const state = await getTikTokState();
        if (!state.accessToken) {
          return { target: { status: 'skipped', error: 'Bağlı değil', updatedAt: now } };
        }
        const photoUrls = tiktokPhotoUrls(SITE_URL, finalImageIds, 10);
        if (photoUrls.length === 0) {
          throw new Error('TikTok için geçerli fotoğraf bulunamadı.');
        }
        const publishId = await sendPhotoDraft({
          title: item.captions.title,
          description: item.captions.mainCaption,
          photoUrls,
        });
        await logActivity('tiktok', { posted: [item.id], errors: [] }, Date.now()).catch(() => null);
        return { target: { status: 'posted', remoteId: publishId, updatedAt: now } };
      }
    }
  } catch (err) {
    return {
      target: {
        status: 'failed',
        error: shortError(err),
        updatedAt: now,
      },
    };
  }
}

/** Yayını (isteğe bağlı stüdyo arka planıyla birlikte) seçili platformlara hata yalıtımlı olarak dağıtır. */
export async function publishBroadcast(
  id: string,
  opts: { onlyFailedOrPending?: boolean } = {},
  now = Date.now(),
): Promise<SocialBroadcast> {
  const item = await getBroadcast(id);
  if (!item) {
    throw new Error('Yayın kaydı bulunamadı.');
  }

  const ref = broadcastRef(item.id);
  const publishingState: SocialBroadcast = {
    ...item,
    status: 'publishing',
    updatedAt: now,
  };
  await ref.set(cleanForFirestore(publishingState));

  const { finalImageIds, studioError } = await maybeEnhanceFirstImage(item);
  const urls = finalImageIds.map((pid) => cloudinaryUrl(pid, 'f_jpg,q_auto,w_1080,c_limit'));

  const targets: Partial<Record<SocialPlatform, BroadcastTargetResult>> = { ...item.targets };
  let storyStatus = item.storyStatus;

  for (const platform of item.platforms) {
    if (opts.onlyFailedOrPending && targets[platform]?.status === 'posted') {
      continue;
    }
    const res = await publishToPlatform(platform, item, urls, finalImageIds, now);
    targets[platform] = res.target;
    if (res.storyStatus) {
      storyStatus = res.storyStatus;
    }
  }

  const status = computeBroadcastStatus(item.platforms, targets);
  const publishedAt = status === 'done' || status === 'partial' ? item.publishedAt ?? now : item.publishedAt;

  const updated: SocialBroadcast = {
    ...item,
    finalImageIds,
    targets,
    status,
    updatedAt: now,
    ...(storyStatus ? { storyStatus } : {}),
    ...(publishedAt !== undefined ? { publishedAt } : {}),
    ...(studioError ? { studioError } : {}),
  };
  if (!studioError) {
    delete updated.studioError;
  }

  await ref.set(cleanForFirestore(updated));
  return updated;
}

// ── Güncelleme & Silme ───────────────────────────────────────────────────────

/** Taslak veya sıradaki bir yayının metinlerini, platformlarını veya durumunu günceller. */
export async function updateBroadcast(
  id: string,
  patch: { captions?: Partial<GeneratedCaptions>; platforms?: SocialPlatform[]; status?: 'queued' | 'draft' },
): Promise<SocialBroadcast> {
  const existing = await getBroadcast(id);
  if (!existing) {
    throw new Error('Yayın kaydı bulunamadı.');
  }
  if (existing.status === 'publishing') {
    throw new Error('Yayınlanmakta olan gönderi güncellenemez.');
  }

  const captions = patch.captions ? mergeCaptions(existing.captions, patch.captions) : existing.captions;
  const platforms = patch.platforms !== undefined ? sanitizePlatforms(patch.platforms) : existing.platforms;
  const status: BroadcastStatus =
    patch.status === 'queued' || patch.status === 'draft' ? patch.status : existing.status;

  const updated: SocialBroadcast = {
    ...existing,
    captions,
    platforms,
    status,
    updatedAt: Date.now(),
  };

  await broadcastRef(existing.id).set(cleanForFirestore(updated));
  return updated;
}

/** Yayını siler; `deleteImages` true ise yalnızca `karta-baski/sosyal/` altındaki görselleri Cloudinary'den temizler. */
export async function deleteBroadcast(id: string, deleteImages = false): Promise<void> {
  const existing = await getBroadcast(id);
  if (!existing) return;

  await broadcastRef(existing.id).delete();

  if (deleteImages) {
    const candidates = Array.from(new Set([...existing.rawImageIds, ...existing.finalImageIds]));
    const socialOnly = candidates.filter((imgId) => imgId.startsWith(`${SOCIAL_IMAGE_FOLDER}/`));
    if (socialOnly.length > 0) {
      await deleteCloudinaryImages(socialOnly);
    }
  }
}

// ── Cron Kuyruk İşleyici ─────────────────────────────────────────────────────

/** Kuyruktaki zamanı gelmiş gönderilerden tur başına ayarlanan kadarını sırayla yayınlar. */
export async function runBroadcastStep(
  now = Date.now(),
): Promise<{ processed: number; posted: number; failed: number; errors: string[] }> {
  const settings = await getBroadcastSettings();
  const items = await listBroadcasts(30);
  const queued = pickQueuedBroadcasts(items, settings.queuePerCycle, now);

  let processed = 0;
  let posted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of queued) {
    processed += 1;
    try {
      const res = await publishBroadcast(item.id, {}, now);
      if (res.status === 'done' || res.status === 'partial') {
        posted += 1;
      } else {
        failed += 1;
      }
      for (const platform of res.platforms) {
        const t = res.targets[platform];
        if (t?.status === 'failed' && t.error) {
          errors.push(`${item.id} (${platform}): ${t.error}`);
        }
      }
    } catch (err) {
      failed += 1;
      errors.push(`${item.id}: ${shortError(err)}`);
    }
  }

  return { processed, posted, failed, errors };
}
