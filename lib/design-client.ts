/** Tarayıcı tarafı: tasarım siparişi istekleri ve fotoğraf hazırlığı. */
import type { DesignInput } from './design-types';
import { compressImage } from '@/components/reviews/compress';

/** Baskı kalitesi bozulmasın: küçük dosya aynen gider, büyük olan 3000 px'e indirilir. */
export async function prepareUpload(file: File): Promise<File> {
  if (file.size <= 4 * 1024 * 1024) return file;
  return compressImage(file, 3000, 0.9);
}

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, init).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(data?.error || 'Bağlantı kurulamadı. Lütfen tekrar deneyin.');
  return data;
}

export async function createDesignRequest(input: DesignInput, preview?: Blob | null, photo?: File | null): Promise<string> {
  const form = new FormData();
  form.append('data', JSON.stringify(input));
  if (preview) form.append('preview', preview, 'onizleme.jpg');
  if (photo) form.append('photo', await prepareUpload(photo));
  return (await request('/api/tasarim', { method: 'POST', body: form })).token as string;
}

export async function addDesignFileRequest(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', await prepareUpload(file));
  return (await request(`/api/tasarim/${token}/dosya`, { method: 'POST', body: form })).id as string;
}

export const removeDesignFileRequest = (token: string, id: string) =>
  request(`/api/tasarim/${token}/dosya?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

export const updateDesignRequest = (token: string, patch: { note?: string; productSlug?: string; color?: string }) =>
  request(`/api/tasarim/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

/** Sayfa WhatsApp'a geçerken de istek tamamlansın diye keepalive. */
export const submitDesignRequest = (token: string) =>
  request(`/api/tasarim/${token}/gonder`, { method: 'POST', keepalive: true });
