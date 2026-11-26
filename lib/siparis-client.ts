/** Tarayıcı tarafı: fotoğraf hazırlığı ve siparişin gönderilmesi. */
import type { CartItem } from './cart-types';
import type { Proof } from './siparis-types';
import { loadFile } from './cart-files';
import { looksLikeImage } from './image-sniff';

const KEEP_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 3000;

/**
 * Baskı kalitesi bozulmasın: küçük dosya aynen kalır, büyük olan 3000 px'e indirilir.
 * PNG, saydamlığı kaybolmasın diye PNG olarak kalır.
 */
export async function prepareUpload(file: Blob): Promise<Blob> {
  if (file.size <= KEEP_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Seçilen dosya gerçekten açılabilen bir fotoğraf mı?
 * `allowHeic`: tarayıcının gösteremediği iPhone biçimi, önizleme gerekmiyorsa kabul edilir.
 */
export async function isUsableImage(file: Blob, allowHeic = false): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!looksLikeImage(head)) return false;
  try {
    (await createImageBitmap(file)).close();
    return true;
  } catch {
    const heic = String.fromCharCode(...Array.from(head.slice(4, 8))) === 'ftyp';
    return allowHeic && heic;
  }
}

async function request(url: string, init: RequestInit) {
  const res = await fetch(url, init).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(data?.error || 'Bağlantı kurulamadı. Lütfen tekrar deneyin.');
  return data;
}

export interface Contact {
  name: string;
  phone: string;
  city?: string;
  district?: string;
  address?: string;
  note?: string;
  kvkk: boolean;
  website?: string;
}

/** Siparişi açar, cihazdaki fotoğrafları yükler ve tamamlar. Sipariş anahtarını döner. */
export async function submitOrder(
  items: CartItem[],
  contact: Contact,
  onProgress: (done: number, total: number) => void,
): Promise<string> {
  // Dosyaları baştan oku: biri kayıpsa sunucuda yarım sipariş açılmasın.
  const lines = await Promise.all(items.map(async (item) => {
    const load = (ids: string[]) => Promise.all(ids.map(async (id) => {
      const blob = await loadFile(id);
      if (!blob) throw new Error(`“${item.title}” için eklediğiniz fotoğraf bu cihazda bulunamadı. Satırı düzenleyip yeniden ekleyin.`);
      return blob;
    }));
    const photos = await load(item.design?.photos ?? []);
    const backPhotos = await load(item.design?.back?.photos ?? []);
    const preview = item.design?.preview ? await loadFile(item.design.preview) : null;
    return { item, photos, backPhotos, preview };
  }));

  const { token } = await request('/api/siparis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...contact,
      items: lines.map(({ item, photos, backPhotos, preview }) => {
        const d = item.design;
        const b = d?.back;
        return {
          productId: item.productId, qty: item.qty, color: item.color, note: item.note,
          text: d?.text, font: d?.font, placement: d?.placement, removeBg: d?.removeBg, needsDesign: d?.needsDesign,
          photoCount: photos.length, hasPreview: Boolean(preview), readyId: d?.ready?.id,
          back: b && {
            text: b.text, font: b.font, placement: b.placement, removeBg: b.removeBg,
            photoCount: backPhotos.length, readyId: b.ready?.id,
          },
        };
      }),
    }),
  }) as { token: string };

  // Sunucu satır sırasını korur.
  const uploads = lines.flatMap(({ item, photos, backPhotos, preview }, line) => {
    return [
      ...photos.map((blob, n) => ({ line, kind: 'photo', blob, where: `“${item.title}”, ${n + 1}. fotoğraf` })),
      ...backPhotos.map((blob, n) => ({ line, kind: 'back', blob, where: `“${item.title}”, arka yüz ${n + 1}. fotoğraf` })),
      ...(preview ? [{ line, kind: 'preview', blob: preview, where: `“${item.title}” önizlemesi` }] : []),
    ];
  });

  onProgress(0, uploads.length);
  for (let i = 0; i < uploads.length; i += 1) {
    const { line, kind, blob, where } = uploads[i];
    const form = new FormData();
    form.append('line', String(line));
    form.append('kind', kind);
    form.append('file', blob, `foto-${i}`);
    try {
      await request(`/api/siparis/${token}/dosya`, { method: 'POST', body: form });
    } catch (error) {
      throw new Error(`${where}: ${error instanceof Error ? error.message : 'yüklenemedi.'}`);
    }
    onProgress(i + 1, uploads.length);
  }
  await request(`/api/siparis/${token}/tamamla`, { method: 'POST' });
  return token;
}

export const deleteOrderByCustomer = (token: string) => request(`/api/siparis/${token}`, { method: 'DELETE' });

export const replyProofRequest = async (
  token: string,
  body: { round: number; decision: 'onaylandi' | 'duzeltme'; reply?: string },
): Promise<Proof> =>
  (await request(`/api/siparis/${token}/onay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).proof;

/** Yönetici: baskı önizlemesi gönderir. */
export async function sendProofRequest(token: string, files: File[], message: string): Promise<Proof> {
  const form = new FormData();
  for (const file of files) form.append('file', await prepareUpload(file), file.name);
  form.append('message', message);
  return (await request(`/api/siparis/${token}/onizleme`, { method: 'POST', body: form })).proof;
}
