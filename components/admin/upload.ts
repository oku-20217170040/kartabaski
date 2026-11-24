export interface UploadFailure {
  name: string;
  message: string;
}

export interface UploadResult {
  ids: string[];
  failures: UploadFailure[];
}

async function uploadOne(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Yükleme başarısız (${res.status})`);
  }
  const data = await res.json();
  return data.public_id as string;
}

/**
 * Dosyaları paralel yükler; biri başarısız olsa bile diğerleri korunur.
 * Başarılı public_id'ler sırayla `ids` içinde, hatalar `failures` içinde döner.
 */
export async function uploadFiles(files: File[]): Promise<UploadResult> {
  const settled = await Promise.allSettled(files.map(uploadOne));
  const ids: string[] = [];
  const failures: UploadFailure[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') ids.push(r.value);
    else failures.push({ name: files[i].name, message: r.reason instanceof Error ? r.reason.message : 'Bilinmeyen hata' });
  });
  return { ids, failures };
}

/** Cloudinary'den görsel siler (best effort, hata fırlatmaz). */
export function deleteUploaded(publicIds: string[]): void {
  if (!publicIds.length) return;
  fetch('/api/cloudinary-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicIds }),
  }).catch(() => undefined);
}

/** Türkçe karakterleri ASCII'ye çevirip URL uyumlu slug üretir. */
export function toSlug(input: string, opts: { trimEnds?: boolean } = { trimEnds: true }): string {
  let s = input
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (opts.trimEnds !== false) s = s.replace(/^-+|-+$/g, '');
  return s;
}
