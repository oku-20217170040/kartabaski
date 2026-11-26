import 'server-only';

import crypto from 'crypto';
import { sanitizePublicIds } from './cloudinary-ids';

/*
 * Müşteri fotoğrafları "authenticated" türünde saklanır: imzasız adresle açılmaz.
 * İmzalı adres yalnız sunucuda üretilir; ziyaretçiye görsel kendi API'mizden akar.
 */

function config() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new Error('Cloudinary bilgileri eksik.');
  return { cloud, key, secret };
}

/** Parametreleri Cloudinary kuralıyla (alfabetik) imzalayıp form gövdesine yazar. */
function signedForm(params: Record<string, string>, extra: Record<string, string> = {}) {
  const { key, secret } = config();
  const signed: Record<string, string> = { ...params, timestamp: String(Math.round(Date.now() / 1000)) };
  const base = Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&');
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...signed, ...extra })) form.append(k, v);
  form.append('api_key', key);
  form.append('signature', crypto.createHash('sha256').update(base + secret).digest('hex'));
  return form;
}

export async function uploadPrivate(dataUri: string, folder: string): Promise<string> {
  const { cloud } = config();
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body: signedForm({ folder, type: 'authenticated' }, { file: dataUri }),
    signal: AbortSignal.timeout(40_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.public_id) throw new Error(`Cloudinary yükleme hatası: ${data?.error?.message || `HTTP ${res.status}`}`);
  return data.public_id as string;
}

export function signedImageUrl(publicId: string, transform = ''): string {
  const { cloud, secret } = config();
  const toSign = [transform, publicId].filter(Boolean).join('/');
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
  return `https://res.cloudinary.com/${cloud}/image/authenticated/s--${signature}--/${toSign}`;
}

export async function deletePrivate(rawIds: string[]): Promise<void> {
  const ids = sanitizePublicIds(rawIds, 300);
  if (!ids.length) return;
  const { cloud } = config();
  await Promise.allSettled(
    ids.map((id) =>
      fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
        method: 'POST',
        body: signedForm({ public_id: id, type: 'authenticated', invalidate: 'true' }),
      }),
    ),
  );
}
