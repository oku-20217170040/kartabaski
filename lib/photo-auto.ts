import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidateTag } from 'next/cache';
import { adminDb } from './firebase-admin';
import { uploadToCloudinary, deleteCloudinaryImages } from './cloudinary-admin';
import { cloudinaryUrl } from './format';
import { pickProvider } from './image-gen/registry';
import { STUDIO_SCENES, buildPrompt } from './image-gen/prompts';
import { ImageGenError } from './image-gen/types';
import {
  addUsage, findOpenJob, finalStatus, isStaleRunning, parseSettings, pickReferenceIds, pickScenes, remainingToday,
  scenesToGenerate, statusAfterError, usageToday, MAX_ATTEMPTS,
  type JobStatus, type PhotoAutoSettings, type PhotoJob, type PhotoResult, type UsageState,
} from './photo-auto-utils';

/**
 * Ürün Fotoğraf Otomasyonu (sağlayıcıdan bağımsız).
 * Firestore: `photo_auto/settings` (ayarlar), `photo_auto/state` ({ day, count } günlük kota), `photo_jobs/{id}` (işler).
 * Hepsi yalnızca Admin SDK ile okunur/yazılır (firestore.rules varsayılan deny). Okumalar bilerek az tutuldu (Spark):
 * bileşik indeks gerektirmemek için sorgular tek alanlı, sıralama bellekte yapılır.
 */

const JOBS = 'photo_jobs';
export const PHOTO_FOLDER = 'karta-baski/studio';
const settingsRef = () => adminDb.collection('photo_auto').doc('settings');
const stateRef = () => adminDb.collection('photo_auto').doc('state');
const jobRef = (id: string) => adminDb.collection(JOBS).doc(id);
const errText = (e: unknown, n = 300) => (e instanceof Error ? e.message : 'Bilinmeyen hata').slice(0, n);

/** Firestore undefined kabul etmez. */
function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function toJob(id: string, d: FirebaseFirestore.DocumentData): PhotoJob {
  return {
    id,
    productId: String(d.productId ?? ''),
    productTitle: String(d.productTitle ?? ''),
    status: (['queued', 'running', 'done', 'partial', 'failed'] as const).includes(d.status) ? d.status : 'failed',
    scenes: Array.isArray(d.scenes) ? d.scenes.filter((s: unknown): s is string => typeof s === 'string') : [],
    results: Array.isArray(d.results) ? (d.results as PhotoResult[]) : [],
    provider: String(d.provider ?? 'auto'),
    model: typeof d.model === 'string' ? d.model : undefined,
    referenceIds: Array.isArray(d.referenceIds) ? d.referenceIds.filter((s: unknown): s is string => typeof s === 'string') : [],
    attempts: Number(d.attempts) || 0,
    createdAt: Number(d.createdAt) || 0,
    updatedAt: Number(d.updatedAt) || 0,
    error: typeof d.error === 'string' ? d.error : undefined,
  };
}

// ── Ayarlar / kota ───────────────────────────────────────────────────────────

export async function getPhotoSettings(): Promise<PhotoAutoSettings> {
  return parseSettings((await settingsRef().get()).data());
}

export async function savePhotoSettings(raw: unknown): Promise<PhotoAutoSettings> {
  const s = parseSettings(raw);
  await settingsRef().set(clean({ ...s, updatedAt: Date.now() }));
  return s;
}

async function getUsage(): Promise<UsageState | undefined> {
  const d = (await stateRef().get()).data();
  return d ? { day: String(d.day ?? ''), count: Number(d.count) || 0 } : undefined;
}

async function bumpUsage(now: number, n: number): Promise<void> {
  if (n <= 0) return;
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef());
    const d = snap.data();
    const cur = d ? { day: String(d.day ?? ''), count: Number(d.count) || 0 } : undefined;
    tx.set(stateRef(), addUsage(cur, now, n));
  });
}

// ── İş okuma ─────────────────────────────────────────────────────────────────

export async function getJob(id: string): Promise<PhotoJob | null> {
  const s = await jobRef(id).get();
  return s.exists ? toJob(s.id, s.data()!) : null;
}

export async function listJobs(limit = 30): Promise<PhotoJob[]> {
  const snap = await adminDb.collection(JOBS).orderBy('createdAt', 'desc').limit(Math.max(1, Math.min(100, limit))).get();
  return snap.docs.map((d) => toJob(d.id, d.data()));
}

async function jobsForProduct(productId: string): Promise<PhotoJob[]> {
  const snap = await adminDb.collection(JOBS).where('productId', '==', productId).limit(25).get();
  return snap.docs.map((d) => toJob(d.id, d.data()));
}

export interface PhotoAutoStatus {
  settings: PhotoAutoSettings;
  usedToday: number;
  remainingToday: number;
  queued: number;
  running: number;
  pendingReview: number; // onay bekleyen görsel sayısı
  activeProvider: string | null;
}

export async function getPhotoAutoStatus(jobs?: PhotoJob[], now = Date.now()): Promise<PhotoAutoStatus> {
  const [settings, usage, list] = await Promise.all([getPhotoSettings(), getUsage(), jobs ? Promise.resolve(jobs) : listJobs(50)]);
  const provider = pickProvider(settings.provider === 'auto' ? undefined : settings.provider);
  return {
    settings,
    usedToday: usageToday(usage, now),
    remainingToday: remainingToday(settings.dailyLimit, usage, now),
    queued: list.filter((j) => j.status === 'queued').length,
    running: list.filter((j) => j.status === 'running').length,
    pendingReview: list.reduce((n, j) => n + j.results.filter((r) => r.status === 'pending').length, 0),
    activeProvider: provider ? provider.id : null,
  };
}

// ── Kuyruğa alma ─────────────────────────────────────────────────────────────

export interface EnqueueResult {
  jobId: string | null;
  created: boolean;
  reason?: string;
}

/**
 * Ürün için üretim işi açar. Aynı ürün için sırada/çalışan iş varsa yenisini AÇMAZ (mevcut işi döner).
 * force=false iken ürün için daha önce tamamlanmış (done/partial) bir iş varsa da açmaz (otomatik tetikte çift maliyeti önler).
 */
export async function enqueuePhotoJob(productId: string, opts: { sceneIds?: string[]; force?: boolean } = {}): Promise<EnqueueResult> {
  const snap = await adminDb.collection('products').doc(productId).get();
  if (!snap.exists) throw new Error('Ürün bulunamadı.');
  const data = snap.data() ?? {};

  const existing = await jobsForProduct(productId);
  const open = findOpenJob(existing, productId);
  if (open) return { jobId: open.id, created: false, reason: 'Bu ürün için zaten sırada/çalışan bir iş var.' };
  if (!opts.force && existing.some((j) => j.status === 'done' || j.status === 'partial')) {
    return { jobId: null, created: false, reason: 'Bu ürün için daha önce fotoğraf üretilmiş.' };
  }

  const settings = await getPhotoSettings();
  const referenceIds = pickReferenceIds(data.images, settings.referenceCount);
  if (!referenceIds.length) throw new Error('Üründe referans olarak kullanılabilecek fotoğraf yok.');

  const now = Date.now();
  const ref = adminDb.collection(JOBS).doc();
  await ref.set(
    clean({
      productId,
      productTitle: String(data.title ?? '').slice(0, 160),
      status: 'queued' as JobStatus,
      scenes: pickScenes(settings, opts.sceneIds),
      results: [] as PhotoResult[],
      provider: settings.provider,
      model: settings.model,
      referenceIds,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    })
  );
  return { jobId: ref.id, created: true };
}

/** Ürün oluşunca çağrılacak TEK kanca: ayar kapalıysa hiçbir şey yapmaz, asla hata fırlatmaz. */
export async function maybeEnqueueOnCreate(productId: string): Promise<void> {
  try {
    const settings = await getPhotoSettings();
    if (!settings.enabled) return;
    await enqueuePhotoJob(productId);
  } catch (e) {
    console.warn('[photo-auto] otomatik kuyruğa alma atlandı:', errText(e));
  }
}

/** Başarısız/biten işi yeniden dener: yalnızca hatalı veya eksik sahneler yeniden üretilir. */
export async function retryPhotoJob(jobId: string): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef(jobId));
    if (!snap.exists) throw new Error('İş bulunamadı.');
    const j = toJob(snap.id, snap.data()!);
    if (j.status === 'queued' || (j.status === 'running' && !isStaleRunning(j, Date.now()))) throw new Error('İş zaten sırada veya çalışıyor.');
    tx.update(jobRef(jobId), { status: 'queued', attempts: 0, updatedAt: Date.now(), error: FieldValue.delete() });
  });
}

// ── İşleme ───────────────────────────────────────────────────────────────────

/** En eski kuyruktaki (veya takılı kalmış) işi `running` yapıp kilitler. Yoksa null. */
async function claimJob(now: number, jobId?: string): Promise<PhotoJob | null> {
  let candidates: PhotoJob[];
  if (jobId) {
    const j = await getJob(jobId);
    candidates = j ? [j] : [];
  } else {
    const [q, r] = await Promise.all([
      adminDb.collection(JOBS).where('status', '==', 'queued').limit(20).get(),
      adminDb.collection(JOBS).where('status', '==', 'running').limit(10).get(),
    ]);
    candidates = [...q.docs, ...r.docs].map((d) => toJob(d.id, d.data()));
    candidates = candidates.filter((j) => j.status === 'queued' || isStaleRunning(j, now)).sort((a, b) => a.createdAt - b.createdAt);
  }

  for (const c of candidates) {
    const claimed = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef(c.id));
      if (!snap.exists) return null;
      const cur = toJob(snap.id, snap.data()!);
      const ok = cur.status === 'queued' || isStaleRunning(cur, now);
      if (!ok) return null;
      if (cur.attempts >= MAX_ATTEMPTS) {
        // Takılı kalıp deneme hakkı bitmiş iş: kapat
        tx.update(jobRef(c.id), { status: finalStatus(cur), error: 'Zaman aşımı: iş tamamlanamadı.', updatedAt: now });
        return null;
      }
      tx.update(jobRef(c.id), { status: 'running', attempts: cur.attempts + 1, updatedAt: now });
      return { ...cur, status: 'running' as JobStatus, attempts: cur.attempts + 1, updatedAt: now };
    });
    if (claimed) return claimed;
  }
  return null;
}

/** Sonucu işe yazar (sahne başına tek kayıt). İş silinmişse false döner. */
async function upsertResult(jobId: string, r: PhotoResult): Promise<boolean> {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef(jobId));
    if (!snap.exists) return false;
    const j = toJob(snap.id, snap.data()!);
    const results = [...j.results.filter((x) => x.sceneId !== r.sceneId), clean({ ...r })].sort(
      (a, b) => j.scenes.indexOf(a.sceneId) - j.scenes.indexOf(b.sceneId)
    );
    tx.update(jobRef(jobId), { results, updatedAt: Date.now() });
    return true;
  });
}

export interface ProcessResult {
  processed: boolean;
  jobId?: string;
  status?: JobStatus | 'quota' | 'no-provider';
  generated: number;
  failed: number;
  message?: string;
}

/**
 * En eski kuyruktaki işi işler (tur başına tek iş). Sahne hatası diğer sahneleri durdurmaz; yeniden denenebilir hata
 * işi sıraya geri koyar (en çok 3 deneme). opts.jobId: belirli işi işle; opts.ignoreQuota: elle çalıştırmada günlük limiti atla.
 */
export async function processNextPhotoJob(now = Date.now(), opts: { jobId?: string; ignoreQuota?: boolean } = {}): Promise<ProcessResult> {
  const job = await claimJob(now, opts.jobId);
  if (!job) return { processed: false, generated: 0, failed: 0, message: 'Sırada iş yok.' };

  const release = async (extra: Record<string, unknown>) => jobRef(job.id).update({ updatedAt: Date.now(), ...extra });
  const [settings, usage] = await Promise.all([getPhotoSettings(), getUsage()]);

  const provider = pickProvider(job.provider === 'auto' ? undefined : (job.provider as Parameters<typeof pickProvider>[0]));
  if (!provider) {
    const message = 'Bağlı bir görsel sağlayıcı yok. Sunucuya bir API anahtarı ekleyin.';
    await release({ status: 'queued', attempts: Math.max(0, job.attempts - 1), error: message });
    return { processed: false, jobId: job.id, status: 'no-provider', generated: 0, failed: 0, message };
  }

  let todo = scenesToGenerate(job);
  let quotaTrimmed = false;
  if (!opts.ignoreQuota) {
    const left = remainingToday(settings.dailyLimit, usage, now);
    if (left < todo.length) {
      todo = todo.slice(0, left);
      quotaTrimmed = true;
    }
    if (!todo.length) {
      const message = 'Günlük üretim limiti doldu; iş yarın devam eder.';
      await release({ status: 'queued', attempts: Math.max(0, job.attempts - 1), error: message });
      return { processed: false, jobId: job.id, status: 'quota', generated: 0, failed: 0, message };
    }
  }

  // Ürün + referanslar
  const prodSnap = await adminDb.collection('products').doc(job.productId).get();
  if (!prodSnap.exists) {
    await release({ status: 'failed', error: 'Ürün silinmiş.' });
    return { processed: true, jobId: job.id, status: 'failed', generated: 0, failed: 0, message: 'Ürün silinmiş.' };
  }
  const pd = prodSnap.data() ?? {};
  const product = { title: job.productTitle || String(pd.title ?? ''), category: typeof pd.category === 'string' ? pd.category : undefined };
  // Cloudflare FLUX.2 referans görsellerde <=512x512 önerir (ücretsiz günlük neuron kotasını korur).
  const refTransform = provider.id === 'cloudflare' ? 'f_jpg,q_auto,w_512,c_limit' : 'f_jpg,q_auto,w_1536,c_limit';
  const referenceUrls = job.referenceIds.map((id) => cloudinaryUrl(id, refTransform));

  let generated = 0;
  let failed = 0;
  let anyRetryable = false;
  const created: string[] = [];
  const errors: string[] = [];
  let usedModel = job.model;

  try {
    for (const sceneId of todo) {
      const scene = STUDIO_SCENES.find((s) => s.id === sceneId);
      if (!scene) {
        await upsertResult(job.id, { sceneId, publicId: '', status: 'failed', error: 'Bilinmeyen sahne.' });
        failed++;
        errors.push(`${sceneId}: bilinmeyen sahne`);
        continue;
      }
      try {
        const res = await provider.generate({
          referenceUrls,
          prompt: buildPrompt(scene, product),
          aspectRatio: scene.aspectRatio,
          model: job.model || settings.model,
        });
        usedModel = res.model || usedModel;
        const img = res.images[0];
        if (!img || (!img.data && !img.url)) throw new ImageGenError('Sağlayıcı görsel döndürmedi.', true);
        const file = img.data
          ? `data:${img.mimeType || 'image/png'};base64,${Buffer.from(img.data).toString('base64')}`
          : (img.url as string);
        const publicId = await uploadToCloudinary(file, PHOTO_FOLDER);
        const stored = await upsertResult(job.id, { sceneId, publicId, status: 'pending' });
        if (!stored) {
          await deleteCloudinaryImages([publicId]); // iş bu arada silindi
          break;
        }
        created.push(sceneId);
        generated++;
      } catch (e) {
        const retryable = e instanceof ImageGenError ? e.retryable : false;
        anyRetryable = anyRetryable || retryable;
        const message = errText(e);
        failed++;
        errors.push(`${scene.label}: ${message}`);
        await upsertResult(job.id, { sceneId, publicId: '', status: 'failed', error: message });
      }
    }
  } finally {
    await bumpUsage(now, generated).catch((e) => console.warn('[photo-auto] kota yazılamadı:', errText(e)));
  }

  const fresh = (await getJob(job.id)) ?? job;
  const stillTodo = scenesToGenerate(fresh).length > 0;
  let status: JobStatus;
  let attempts = fresh.attempts;
  if (quotaTrimmed && stillTodo && !anyRetryable) {
    status = 'queued'; // kota yarın açılınca kalan sahneler üretilir
    attempts = Math.max(0, attempts - 1);
  } else {
    status = statusAfterError(fresh.attempts, anyRetryable, fresh);
  }

  await release({
    status,
    attempts,
    ...(usedModel ? { model: usedModel } : {}),
    provider: provider.id,
    error: errors.length ? errors.join(' | ').slice(0, 500) : quotaTrimmed && status === 'queued' ? 'Günlük limit doldu; kalan sahneler yarın üretilecek.' : FieldValue.delete(),
  });

  if (settings.autoApply === 'append' && created.length && status !== 'queued') {
    try {
      await approveResults(job.id, created);
    } catch (e) {
      await release({ error: `Otomatik ekleme başarısız: ${errText(e)}` });
    }
  }

  return { processed: true, jobId: job.id, status, generated, failed, message: errors[0] };
}

/** Cron adımı: ayar kapalıysa da kuyruktaki işleri işler; tur başına en çok 1 iş; günlük kota geçerli. */
export async function runPhotoStep(now = Date.now()): Promise<ProcessResult> {
  return processNextPhotoJob(now);
}

// ── Onay / red / silme ───────────────────────────────────────────────────────

/** Bekleyen sonuçları ürünün `images` dizisinin SONUNA ekler (kapak değişmez) ve sonucu onaylı işaretler. */
export async function approveResults(jobId: string, sceneIds: string[]): Promise<{ approved: number }> {
  const job = await getJob(jobId);
  if (!job) throw new Error('İş bulunamadı.');
  const pick = new Set(sceneIds);
  const targets = job.results.filter((r) => r.status === 'pending' && r.publicId && pick.has(r.sceneId));
  if (!targets.length) return { approved: 0 };

  const pRef = adminDb.collection('products').doc(job.productId);
  if (!(await pRef.get()).exists) throw new Error('Ürün bulunamadı; görseller eklenemedi.');
  await pRef.update({ images: FieldValue.arrayUnion(...targets.map((r) => r.publicId)), updatedAt: Date.now() });

  const ids = new Set(targets.map((r) => r.sceneId));
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef(jobId));
    if (!snap.exists) return;
    const cur = toJob(snap.id, snap.data()!);
    const results = cur.results.map((r) => (ids.has(r.sceneId) && r.status === 'pending' ? { ...r, status: 'approved' as const } : r));
    tx.update(jobRef(jobId), { results, updatedAt: Date.now() });
  });
  revalidateTag('products');
  return { approved: targets.length };
}

/** Bekleyen sonuçları reddeder ve Cloudinary'den siler. */
export async function rejectResults(jobId: string, sceneIds: string[]): Promise<{ rejected: number }> {
  const pick = new Set(sceneIds);
  const toDelete: string[] = [];
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef(jobId));
    if (!snap.exists) throw new Error('İş bulunamadı.');
    const cur = toJob(snap.id, snap.data()!);
    toDelete.length = 0;
    const results = cur.results.map((r) => {
      if (r.status === 'pending' && pick.has(r.sceneId)) {
        if (r.publicId) toDelete.push(r.publicId);
        return { sceneId: r.sceneId, publicId: '', status: 'rejected' as const };
      }
      return r;
    });
    tx.update(jobRef(jobId), { results, updatedAt: Date.now() });
  });
  await deleteCloudinaryImages(toDelete);
  return { rejected: toDelete.length };
}

/** İşi siler; onaylanmamış (bekleyen) görseller Cloudinary'den temizlenir, onaylılara dokunulmaz. */
export async function deleteJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  if (job.status === 'running' && !isStaleRunning(job, Date.now())) throw new Error('Çalışan iş silinemez; bitmesini bekleyin.');
  await jobRef(jobId).delete();
  await deleteCloudinaryImages(job.results.filter((r) => r.status === 'pending' && r.publicId).map((r) => r.publicId));
}
