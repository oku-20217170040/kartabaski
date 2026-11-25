import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

/**
 * Photoroom API Entegrasyonu (v2 Image Editing API)
 *
 * Kupa/fincanın formunu, baskısını ve rengini koruyarak:
 * 1. Bokeh Portre Modu: Mevcut arka planı optik bokeh ile flulaştırır.
 * 2. Sahne (studio_staging): Ürünü seçilen sahneye (ahşap masa, mermer tezgâh, hediye vb.) ve temas gölgesine oturtur.
 * 3. Temiz Beyaz Stüdyo: Katalog formatında beyaz arka plan ve doğal gölge ekler.
 *
 * GÜVENLİK: API anahtarları ASLA kodda/Firestore'da/istemcide tutulmaz.
 * Yalnızca sunucu ortam değişkenlerinden okunur:
 *   PHOTOROOM_LIVE_API_KEY     (filigransız, ücretli)
 *   PHOTOROOM_SANDBOX_API_KEY  (filigranlı, test)
 */

export const PHOTOROOM_API_ENDPOINT = 'https://image-api.photoroom.com/v2/edit';
export const PHOTOROOM_TIMEOUT_MS = 40_000;
/** Canlı görsel başına tahmini maliyet (USD). Ayarlardan değiştirilebilir. */
export const DEFAULT_COST_PER_IMAGE_USD = 0.02;

export type PhotoroomMode = 'bokeh' | 'studio_staging' | 'clean_white';
export type PhotoroomEnv = 'sandbox' | 'live';

export interface PhotoroomOptions {
  mode: PhotoroomMode;
  blurRadius?: number; // 0.005 - 0.05 (varsayılan: 0.02)
  prompt?: string;
  shadowMode?: 'ai.soft' | 'ai.hard' | 'ai.floating';
  environment?: PhotoroomEnv;
}

/** Firestore'da yalnızca anahtar OLMAYAN ayarlar tutulur (anahtarlar sunucu ortam değişkenlerinde). */
export interface PhotoroomSettings {
  activeEnvironment: PhotoroomEnv;
  defaultMode: PhotoroomMode;
  defaultPrompt: string;
  defaultBlur: number;
  costPerImageUSD: number;
  updatedAt?: number;
}

export interface PhotoroomKeyStatus {
  live: boolean;
  sandbox: boolean;
}

export const DEFAULT_PHOTOROOM_PROMPT =
  'warm rustic wooden table with scattered roasted coffee beans, soft morning window light, cozy cafe atmosphere';

const MODES: PhotoroomMode[] = ['bokeh', 'studio_staging', 'clean_white'];

/** Varsayılan mod: katalog için temiz beyaz stüdyo. */
export const DEFAULT_PHOTOROOM_MODE: PhotoroomMode = 'clean_white';

export async function getPhotoroomSettings(): Promise<PhotoroomSettings> {
  let docData: Record<string, unknown> = {};
  try {
    const snap = await adminDb.collection('photoroom_settings').doc('main').get();
    docData = (snap.data() as Record<string, unknown> | undefined) || {};
  } catch {}

  const fallbackEnv: PhotoroomEnv = process.env.PHOTOROOM_LIVE_API_KEY ? 'live' : 'sandbox';

  return {
    activeEnvironment:
      docData.activeEnvironment === 'sandbox' || docData.activeEnvironment === 'live' ? docData.activeEnvironment : fallbackEnv,
    defaultMode: MODES.includes(docData.defaultMode as PhotoroomMode) ? (docData.defaultMode as PhotoroomMode) : DEFAULT_PHOTOROOM_MODE,
    defaultPrompt: typeof docData.defaultPrompt === 'string' && docData.defaultPrompt ? docData.defaultPrompt : DEFAULT_PHOTOROOM_PROMPT,
    defaultBlur: typeof docData.defaultBlur === 'number' ? docData.defaultBlur : 0.02,
    costPerImageUSD: typeof docData.costPerImageUSD === 'number' ? docData.costPerImageUSD : DEFAULT_COST_PER_IMAGE_USD,
    updatedAt: typeof docData.updatedAt === 'number' ? docData.updatedAt : undefined,
  };
}

/** API anahtarları YALNIZCA sunucu ortam değişkenlerinden okunur (Firestore'a asla yazılmaz). */
export function getResolvedApiKey(env: PhotoroomEnv): string {
  return env === 'live' ? process.env.PHOTOROOM_LIVE_API_KEY || '' : process.env.PHOTOROOM_SANDBOX_API_KEY || '';
}

export function getPhotoroomKeyStatus(): PhotoroomKeyStatus {
  return { live: !!getResolvedApiKey('live'), sandbox: !!getResolvedApiKey('sandbox') };
}

export async function savePhotoroomSettings(data: Partial<PhotoroomSettings>): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (data.activeEnvironment) clean.activeEnvironment = data.activeEnvironment;
  if (data.defaultMode && MODES.includes(data.defaultMode)) clean.defaultMode = data.defaultMode;
  if (typeof data.defaultPrompt === 'string') clean.defaultPrompt = data.defaultPrompt.slice(0, 300);
  if (typeof data.defaultBlur === 'number') clean.defaultBlur = Math.min(0.05, Math.max(0.005, data.defaultBlur));
  if (typeof data.costPerImageUSD === 'number') clean.costPerImageUSD = Math.min(5, Math.max(0, data.costPerImageUSD));

  await adminDb.collection('photoroom_settings').doc('main').set(
    {
      ...clean,
      // Eski sürümden kalan anahtar kopyaları (varsa) bu kayıtta Firestore'dan silinir.
      liveApiKey: FieldValue.delete(),
      sandboxApiKey: FieldValue.delete(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

/** Photoroom API v2 Edit isteği için URL oluşturur */
export function buildPhotoroomRequestUrl(imageUrl: string, options: PhotoroomOptions): string {
  const url = new URL(PHOTOROOM_API_ENDPOINT);
  url.searchParams.set('imageUrl', imageUrl);
  url.searchParams.set('export.format', 'jpeg');

  if (options.mode === 'bokeh') {
    url.searchParams.set('removeBackground', 'false');
    url.searchParams.set('background.blur.mode', 'bokeh');
    const radius = Math.min(0.05, Math.max(0.005, options.blurRadius ?? 0.02));
    url.searchParams.set('background.blur.radius', String(radius));
  } else if (options.mode === 'clean_white') {
    url.searchParams.set('removeBackground', 'true');
    url.searchParams.set('background.color', 'FFFFFF');
    url.searchParams.set('shadow.mode', options.shadowMode || 'ai.soft');
  } else {
    // studio_staging
    url.searchParams.set('removeBackground', 'true');
    url.searchParams.set('shadow.mode', options.shadowMode || 'ai.soft');
    url.searchParams.set('background.prompt', options.prompt || DEFAULT_PHOTOROOM_PROMPT);
  }

  return url.toString();
}

export interface PhotoroomResult {
  dataUri: string;
  environment: PhotoroomEnv;
}

/** Photoroom API'ye görsel dönüştürme isteği gönderir ve data URI olarak döndürür */
export async function transformImageWithPhotoroom(
  imageUrl: string,
  options: PhotoroomOptions
): Promise<PhotoroomResult> {
  const settings = await getPhotoroomSettings();
  const environment: PhotoroomEnv = options.environment || settings.activeEnvironment;
  const apiKey = getResolvedApiKey(environment);

  if (!apiKey) {
    const name = environment === 'live' ? 'PHOTOROOM_LIVE_API_KEY' : 'PHOTOROOM_SANDBOX_API_KEY';
    throw new Error(`Photoroom bağlı değil: sunucu ortam değişkenine ${name} ekleyin.`);
  }

  let res: Response;
  try {
    res = await fetch(buildPhotoroomRequestUrl(imageUrl, options), {
      method: 'GET',
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(PHOTOROOM_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error('Photoroom yanıt vermedi (zaman aşımı). Biraz sonra tekrar deneyin; kredi düşmemiş olabilir.');
    }
    throw new Error(`Photoroom bağlantı hatası: ${e instanceof Error ? e.message : 'bilinmeyen'}`);
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const msg = errJson?.message || errJson?.detail || errJson?.error || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Photoroom yetkilendirme hatası: anahtar geçersiz veya yetkisiz. (${msg})`);
    }
    if (res.status === 402) throw new Error('Photoroom krediniz bitti veya limit aşıldı.');
    if (res.status === 429) throw new Error('Photoroom istek limiti aşıldı, biraz bekleyin.');
    throw new Error(`Photoroom hatası (${res.status}): ${msg}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { dataUri: `data:image/jpeg;base64,${buffer.toString('base64')}`, environment };
}
