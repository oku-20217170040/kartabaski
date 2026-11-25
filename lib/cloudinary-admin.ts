import 'server-only';

import crypto from 'crypto';
import { sanitizePublicIds } from './cloudinary-ids';
import { canRenameImage, seoImageName } from './image-names';
import { deliveryProbeUrl } from './image-check';

/** Cloudinary'den görselleri kalıcı siler (imzalı destroy). Geçersiz kimlikler atlanır. */
export async function deleteCloudinaryImages(rawIds: string[]): Promise<void> {
  const publicIds = sanitizePublicIds(rawIds, 100);
  if (!publicIds.length) return;

  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return;

  await Promise.allSettled(
    publicIds.map(async (publicId) => {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto
        .createHash('sha256')
        .update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
        .digest('hex');

      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', API_KEY);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);

      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
        method: 'POST',
        body: form,
      });
    })
  );
}

/**
 * Görselin sosyal medya akışlarının kullandığı dönüşümle gerçekten teslim edildiğini doğrular (200 + görsel türü).
 * Cloudinary yeni/yeniden adlandırılan görseli ilk saniyelerde 404 verebildiği için kısa aralıklarla birkaç kez dener.
 */
export async function isImageDeliverable(publicId: string, attempts = 3): Promise<boolean> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) return true; // yapılandırma yoksa doğrulanamaz; engelleme
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 800 * i));
    try {
      const res = await fetch(deliveryProbeUrl(cloud, publicId), { signal: AbortSignal.timeout(8_000), cache: 'no-store' });
      const ok = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
      await res.arrayBuffer().catch(() => null); // bağlantıyı kapat
      if (ok) return true;
    } catch {
      // zaman aşımı/ağ hatası: yeniden dene
    }
  }
  return false;
}

/** Cloudinary'ye (data URI veya uzak URL) imzalı yükleme yapar, public_id döner. */
export async function uploadToCloudinary(file: string, folder = 'karta-baski/urunler'): Promise<string> {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) throw new Error('Cloudinary bilgileri eksik.');

  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(`folder=${folder}&timestamp=${timestamp}${API_SECRET}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.public_id) {
    throw new Error(`Cloudinary yükleme hatası: ${data?.error?.message || `HTTP ${res.status}`}`);
  }
  return data.public_id as string;
}

/**
 * Cloudinary görselinin kimliğini (public_id) değiştirir (imzalı rename). Başarılıysa true döner; hata fırlatmaz.
 * invalidate: CDN önbelleği temizlenir. Hedef ad doluysa Cloudinary reddeder (false).
 */
export async function renameCloudinaryImage(fromPublicId: string, toPublicId: string): Promise<boolean> {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return false;
  if (!sanitizePublicIds([fromPublicId, toPublicId], 2).length || fromPublicId === toPublicId) return false;

  try {
    const timestamp = Math.round(Date.now() / 1000);
    // İmza parametreleri alfabetik sırayla: from_public_id, invalidate, timestamp, to_public_id
    const signature = crypto
      .createHash('sha256')
      .update(`from_public_id=${fromPublicId}&invalidate=true&timestamp=${timestamp}&to_public_id=${toPublicId}${API_SECRET}`)
      .digest('hex');

    const form = new FormData();
    form.append('from_public_id', fromPublicId);
    form.append('to_public_id', toPublicId);
    form.append('invalidate', 'true');
    form.append('api_key', API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/rename`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ürün kaydedilirken yeni (rastgele adlı) fotoğrafları ürün adından türeyen SEO adıyla yeniden adlandırır.
 * Sıra, dizideki konumdur. Yeniden adlandırılamayan görsel eski adıyla kalır (kayıt asla bozulmaz).
 * renamed: eski → yeni eşlemesi (kayıt başarısız olursa geri almak için).
 */
export async function renameProductImages(
  images: string[],
  slug: string,
  only?: (id: string) => boolean
): Promise<{ images: string[]; renamed: Record<string, string> }> {
  const renamed: Record<string, string> = {};
  const next = await Promise.all(
    images.map(async (id, i) => {
      if (!canRenameImage(id) || (only && !only(id))) return id;
      const to = seoImageName(slug, i + 1, id);
      const ok = await renameCloudinaryImage(id, to);
      if (!ok) return id;
      // Yeni ad teslim edilemiyorsa (CDN gecikmesi/önbellek) kayıt bozuk adresle çıkmasın: eski ada dön
      if (!(await isImageDeliverable(to))) {
        await renameCloudinaryImage(to, id);
        return id;
      }
      renamed[id] = to;
      return to;
    })
  );
  return { images: next, renamed };
}

/** Kayıt başarısız olursa yapılan yeniden adlandırmaları geri alır (en iyi çaba). */
export async function revertImageRenames(renamed: Record<string, string>): Promise<void> {
  await Promise.allSettled(Object.entries(renamed).map(([from, to]) => renameCloudinaryImage(to, from)));
}
