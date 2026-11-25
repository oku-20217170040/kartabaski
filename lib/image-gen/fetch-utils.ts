// Saf yardımcılar: görsel indirme, zaman aşımlı fetch, HTTP hatası → ImageGenError.
import { ImageGenError } from './types';

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
export const DEFAULT_TIMEOUT_MS = 120_000;

/** HTTP durum kodunu kullanıcıya gösterilebilir Türkçe hataya çevirir. */
export function mapHttpError(status: number, providerLabel: string, detail?: string): ImageGenError {
  const d = detail ? ` (${detail.replace(/\s+/g, ' ').slice(0, 200)})` : '';
  if (status === 401 || status === 403) {
    return new ImageGenError(
      `${providerLabel}: API anahtarı geçersiz veya yetkisiz. Anahtarı kontrol edin.${d}`,
      false,
      status,
    );
  }
  if (status === 429) {
    return new ImageGenError(
      `${providerLabel}: istek limiti aşıldı, biraz bekleyip tekrar deneyin.${d}`,
      true,
      status,
    );
  }
  if (status >= 500) {
    return new ImageGenError(`${providerLabel}: servis geçici olarak yanıt vermiyor (HTTP ${status}).${d}`, true, status);
  }
  return new ImageGenError(`${providerLabel}: istek reddedildi (HTTP ${status}).${d}`, false, status);
}

/** Zaman aşımlı fetch. Aşımda / ağ hatasında ImageGenError(retryable) fırlatır. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  providerLabel = 'Görsel servisi',
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof ImageGenError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ImageGenError(`${providerLabel}: istek zaman aşımına uğradı (${Math.round(timeoutMs / 1000)} sn).`, true);
    }
    throw new ImageGenError(`${providerLabel}: ağ hatası, bağlantı kurulamadı.`, true);
  } finally {
    clearTimeout(timer);
  }
}

/** Yanıt başarısızsa ImageGenError fırlatır; gövdeden kısa ayrıntı ekler (anahtar içermez). */
export async function assertOk(res: Response, providerLabel: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    /* yoksay */
  }
  throw mapHttpError(res.status, providerLabel, detail);
}

export function guessMime(url: string): string {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** URL'den görsel indirir: {bytes, mimeType}. 15MB sınırı + zaman aşımı. */
export async function fetchImage(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; label?: string } = {},
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const label = opts.label ?? 'Görsel indirme';
  const max = opts.maxBytes ?? MAX_IMAGE_BYTES;
  const res = await fetchWithTimeout(url, {}, opts.timeoutMs ?? 30_000, label);
  if (!res.ok) throw mapHttpError(res.status, label);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > max) throw new ImageGenError(`${label}: görsel çok büyük (en fazla 15MB).`, false);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > max) throw new ImageGenError(`${label}: görsel çok büyük (en fazla 15MB).`, false);
  const header = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const mimeType = header.startsWith('image/') ? header : guessMime(url);
  return { bytes: new Uint8Array(buf), mimeType };
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}
