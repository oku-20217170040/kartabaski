// Ürün Fotoğraf Otomasyonu: saf (pure) yardımcılar — ayar şeması, iş durumları, sahne seçimi, günlük kota.
// Firebase'e bağımlı DEĞİL; istemci ve sunucuda güvenle import edilir.
import { z } from 'zod';
import { DEFAULT_SCENE_IDS } from './image-gen/prompts';
import type { ImageProviderId } from './image-gen/types';
import { trDayKey } from './tr-time';

export const PROVIDER_IDS = ['cloudflare', 'huggingface', 'gemini', 'fal', 'openai', 'replicate', 'mock'] as const satisfies readonly ImageProviderId[];
export type ProviderChoice = ImageProviderId | 'auto';
export type AutoApply = 'review' | 'append';

export const MAX_ATTEMPTS = 3;
export const STALE_RUNNING_MS = 10 * 60 * 1000;
export const MAX_SCENES = 12;
export const MAX_PER_PRODUCT = 8;

const clampInt = (min: number, max: number, def: number) =>
  z.coerce
    .number()
    .transform((n) => Math.min(max, Math.max(min, Math.round(n))))
    .catch(def);

function cleanSceneIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(x) && !out.includes(x)) out.push(x);
  }
  return out.slice(0, MAX_SCENES);
}

export const PhotoAutoSettingsSchema = z.object({
  enabled: z.boolean().catch(false),
  provider: z.enum(['auto', ...PROVIDER_IDS]).catch('auto'),
  model: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((s) => (s ? s : undefined))
    .catch(undefined),
  sceneIds: z
    .unknown()
    .transform((v) => {
      const ids = cleanSceneIds(v);
      return ids.length ? ids : [...DEFAULT_SCENE_IDS];
    })
    .catch([...DEFAULT_SCENE_IDS]),
  perProduct: clampInt(1, MAX_PER_PRODUCT, 4),
  referenceCount: clampInt(1, 3, 2),
  autoApply: z.enum(['review', 'append']).catch('review'),
  dailyLimit: clampInt(1, 500, 20),
});

export type PhotoAutoSettings = {
  enabled: boolean;
  provider: ProviderChoice;
  model?: string;
  sceneIds: string[];
  perProduct: number;
  referenceCount: number;
  autoApply: AutoApply;
  dailyLimit: number;
};

export function defaultSettings(): PhotoAutoSettings {
  return PhotoAutoSettingsSchema.parse({}) as PhotoAutoSettings;
}

/** Firestore'dan/istemciden gelen ham veriyi güvenli ayara çevirir (eksik/bozuk alanlar varsayılana düşer). */
export function parseSettings(raw: unknown): PhotoAutoSettings {
  const obj = raw && typeof raw === 'object' ? raw : {};
  return PhotoAutoSettingsSchema.parse(obj) as PhotoAutoSettings;
}

// ── İş modeli ────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'done' | 'partial' | 'failed';
export type ResultStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface PhotoResult {
  sceneId: string;
  publicId: string; // başarısız sahnede boş
  status: ResultStatus;
  error?: string;
}

export interface PhotoJob {
  id: string;
  productId: string;
  productTitle: string;
  status: JobStatus;
  scenes: string[];
  results: PhotoResult[];
  provider: string; // seçilen/kullanılan sağlayıcı kimliği (veya 'auto')
  model?: string;
  referenceIds: string[];
  attempts: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Sırada',
  running: 'Üretiliyor',
  done: 'Tamamlandı',
  partial: 'Kısmen tamamlandı',
  failed: 'Başarısız',
};

export const RESULT_STATUS_LABEL: Record<ResultStatus, string> = {
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  failed: 'Hata',
};

export const isOpenStatus = (s: JobStatus) => s === 'queued' || s === 'running';

/** Ürün için açık (sırada/çalışan) iş var mı? */
export function findOpenJob<T extends { productId: string; status: JobStatus }>(jobs: T[], productId: string): T | undefined {
  return jobs.find((j) => j.productId === productId && isOpenStatus(j.status));
}

/** Üretilecek sahneler: elle verilenler varsa onlar (en çok 8), yoksa ayarın sahneleri ilk `perProduct` kadar. */
export function pickScenes(settings: Pick<PhotoAutoSettings, 'sceneIds' | 'perProduct'>, override?: string[]): string[] {
  const custom = cleanSceneIds(override);
  if (custom.length) return custom.slice(0, MAX_PER_PRODUCT);
  const base = cleanSceneIds(settings.sceneIds);
  return (base.length ? base : [...DEFAULT_SCENE_IDS]).slice(0, Math.max(1, Math.min(MAX_PER_PRODUCT, settings.perProduct)));
}

/** Hâlâ üretilmesi gereken sahneler: sonucu olmayan veya hatalı olanlar. (Reddedilen/onaylı/bekleyen atlanır.) */
export function scenesToGenerate(job: Pick<PhotoJob, 'scenes' | 'results'>): string[] {
  const done = new Set(job.results.filter((r) => r.status !== 'failed').map((r) => r.sceneId));
  return job.scenes.filter((s) => !done.has(s));
}

/** Ürün görsellerinden referans seç: yalnızca güvenli Cloudinary kimlikleri; üretilmiş stüdyo çıktıları hariç. */
export function pickReferenceIds(images: unknown, count: number): string[] {
  if (!Array.isArray(images)) return [];
  const max = Math.max(1, Math.min(3, count));
  const out: string[] = [];
  for (const id of images) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_\-/.]{1,200}$/.test(id) || id.includes('..') || id.startsWith('/')) continue;
    if (id.startsWith('karta-baski/studio/')) continue; // üretilmiş çıktıyı referans yapma (bozulma birikir)
    if (!out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** İşin son durumu: hepsi başarılıysa done, bir kısmı başarılıysa partial, hiçbiri değilse failed. */
export function finalStatus(job: Pick<PhotoJob, 'scenes' | 'results'>): 'done' | 'partial' | 'failed' {
  const ok = job.scenes.filter((s) => job.results.some((r) => r.sceneId === s && r.status !== 'failed')).length;
  if (ok === 0) return 'failed';
  return ok === job.scenes.length ? 'done' : 'partial';
}

/** Takılı kalmış (10 dk'dır güncellenmeyen) çalışan iş mi? */
export function isStaleRunning(job: Pick<PhotoJob, 'status' | 'updatedAt'>, now: number): boolean {
  return job.status === 'running' && now - job.updatedAt > STALE_RUNNING_MS;
}

/** Hata sonrası iş nereye gider: yeniden denenebilir ve deneme hakkı varsa sıraya, değilse final duruma. */
export function statusAfterError(attempts: number, retryable: boolean, job: Pick<PhotoJob, 'scenes' | 'results'>): JobStatus {
  if (retryable && attempts < MAX_ATTEMPTS) return 'queued';
  return finalStatus(job);
}

// ── Günlük kota (TSİ günü) ───────────────────────────────────────────────────

export interface UsageState {
  day: string; // TSİ "YYYY-MM-DD"
  count: number;
}

export const emptyUsage = (): UsageState => ({ day: '', count: 0 });

export function usageToday(usage: UsageState | undefined, now: number): number {
  return usage && usage.day === trDayKey(now) ? Math.max(0, usage.count) : 0;
}

export function remainingToday(dailyLimit: number, usage: UsageState | undefined, now: number): number {
  return Math.max(0, dailyLimit - usageToday(usage, now));
}

export function addUsage(usage: UsageState | undefined, now: number, n: number): UsageState {
  return { day: trDayKey(now), count: usageToday(usage, now) + Math.max(0, n) };
}

// ── Sayfa veri tipi (sunucu action'ı ↔ istemci) ──────────────────────────────

export interface PhotoProviderInfo {
  id: ImageProviderId;
  label: string;
  configured: boolean;
  missingEnv: string[];
  defaultModel: string;
  free?: boolean;
}

export interface PhotoProductLite {
  id: string;
  title: string;
  category: string;
  cover: string;
  imageCount: number;
}

export interface PhotoAutoData {
  settings: PhotoAutoSettings;
  status: { usedToday: number; remainingToday: number; queued: number; running: number; pendingReview: number; activeProvider: string | null };
  providers: PhotoProviderInfo[];
  scenes: { id: string; label: string }[];
  jobs: PhotoJob[];
  products: PhotoProductLite[];
  warnings: string[];
}
