'use server';

import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { listProviders } from './image-gen/registry';
import { STUDIO_SCENES } from './image-gen/prompts';
import {
  approveResults, deleteJob, enqueuePhotoJob, getPhotoAutoStatus, listJobs, processNextPhotoJob, rejectResults, retryPhotoJob,
  savePhotoSettings,
} from './photo-auto';
import type { PhotoAutoData, PhotoAutoSettings } from './photo-auto-utils';

const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Sayfa verisi: ayarlar + durum + sağlayıcılar + son işler + küçük ürün listesi + sahne listesi. */
export async function getPhotoAutoDataAction(): Promise<PhotoAutoData> {
  await requireAdmin();
  const warnings: string[] = [];

  const jobs = await listJobs(30).catch((e) => {
    warnings.push(`İşler okunamadı: ${msg(e, 'bilinmeyen hata')}`);
    return [];
  });
  const status = await getPhotoAutoStatus(jobs);
  const products = await getProductsServer().catch(() => []);

  return {
    settings: status.settings,
    status: {
      usedToday: status.usedToday,
      remainingToday: status.remainingToday,
      queued: status.queued,
      running: status.running,
      pendingReview: status.pendingReview,
      activeProvider: status.activeProvider,
    },
    providers: listProviders(),
    scenes: STUDIO_SCENES.map((s) => ({ id: s.id, label: s.label })),
    jobs,
    products: products
      .filter((p) => (p.images ?? []).length > 0)
      .map((p) => ({ id: p.id, title: p.title, category: p.category, cover: p.images[0], imageCount: p.images.length })),
    warnings,
  };
}

export async function saveSettingsAction(input: PhotoAutoSettings): Promise<PhotoAutoSettings> {
  await requireAdmin();
  return savePhotoSettings(input);
}

export async function enqueueAction(productId: string, sceneIds?: string[]): Promise<{ jobId: string | null; created: boolean; reason?: string }> {
  await requireAdmin();
  if (typeof productId !== 'string' || !productId) throw new Error('Ürün seçilmedi.');
  return enqueuePhotoJob(productId, { sceneIds, force: true });
}

/** Bir işi hemen işler (jobId verilirse o iş). Günlük limit elle çalıştırmada atlanır. */
export async function runNowAction(jobId?: string): Promise<{ jobId?: string; status?: string; generated: number; failed: number; message?: string }> {
  await requireAdmin();
  const r = await processNextPhotoJob(Date.now(), { jobId, ignoreQuota: true });
  if (r.status === 'no-provider') throw new Error(r.message || 'Bağlı sağlayıcı yok.');
  return { jobId: r.jobId, status: r.status, generated: r.generated, failed: r.failed, message: r.message };
}

export async function approveAction(jobId: string, sceneIds: string[]): Promise<{ approved: number }> {
  await requireAdmin();
  return approveResults(jobId, sceneIds);
}

export async function rejectAction(jobId: string, sceneIds: string[]): Promise<{ rejected: number }> {
  await requireAdmin();
  return rejectResults(jobId, sceneIds);
}

export async function retryJobAction(jobId: string): Promise<void> {
  await requireAdmin();
  await retryPhotoJob(jobId);
}

export async function deleteJobAction(jobId: string): Promise<void> {
  await requireAdmin();
  await deleteJob(jobId);
}
