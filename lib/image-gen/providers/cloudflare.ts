import 'server-only';
import type { GeneratedImage, GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { assertOk, base64ToBytes, extForMime, fetchImage, fetchWithTimeout } from '../fetch-utils';

const DEFAULT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const LABEL = 'Cloudflare Workers AI';
const MAX_REFERENCE_IMAGES = 4;

// Tüm boyutlar 64'ün katı, [256..1024] aralığında ve birebir hedef en-boy oranında seçildi (düşük neuron tüketimi).
const SIZES: Record<GenerateRequest['aspectRatio'], { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 768, height: 960 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1024, height: 576 },
};

interface CloudflareAiError {
  code?: unknown;
  message?: unknown;
}

interface CloudflareAiJsonResponse {
  success?: unknown;
  errors?: CloudflareAiError[];
  result?: { image?: unknown } | string | null;
}

function getMissingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) missing.push('CLOUDFLARE_API_TOKEN');
  return missing;
}

function resolveModel(explicit?: string): string {
  const raw = (explicit || process.env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_MODEL).trim().replace(/^\/+/, '');
  return raw || DEFAULT_MODEL;
}

function detectImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/png';
}

function decodeBase64Payload(raw: string): { bytes: Uint8Array; mimeType: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let explicitMime: string | undefined;
  let base64Part = trimmed;
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/i.exec(trimmed);
  if (dataUrlMatch) {
    explicitMime = dataUrlMatch[1].trim().toLowerCase();
    base64Part = dataUrlMatch[2].trim();
  }
  if (!base64Part) return null;

  const bytes = base64ToBytes(base64Part);
  if (!bytes.byteLength) return null;

  return { bytes, mimeType: explicitMime || detectImageMime(bytes) };
}

function extractErrorDetail(errors: unknown): string {
  if (!Array.isArray(errors) || !errors.length) return '';
  const first = errors[0] as CloudflareAiError | undefined;
  if (typeof first?.message === 'string' && first.message.trim()) {
    return first.message.replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  return '';
}

async function parseResponse(res: Response): Promise<GeneratedImage> {
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

  if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength) {
      throw new ImageGenError(`${LABEL} boş görsel yanıtı döndürdü.`, true);
    }
    const mimeType = contentType.startsWith('image/') ? contentType : detectImageMime(bytes);
    return { data: bytes, mimeType };
  }

  let json: CloudflareAiJsonResponse;
  try {
    json = (await res.json()) as CloudflareAiJsonResponse;
  } catch {
    throw new ImageGenError(`${LABEL} geçersiz JSON yanıtı döndürdü.`, true);
  }

  if (json.success === false) {
    const detail = extractErrorDetail(json.errors);
    throw new ImageGenError(
      detail ? `${LABEL} görsel üretemedi: ${detail}` : `${LABEL} isteği başarısız oldu.`,
      true,
    );
  }

  const rawImage = typeof json.result === 'string' ? json.result : json.result?.image;
  const decoded = typeof rawImage === 'string' ? decodeBase64Payload(rawImage) : null;
  if (!decoded) {
    throw new ImageGenError(`${LABEL} görsel döndürmedi.`, true);
  }
  return { data: decoded.bytes, mimeType: decoded.mimeType };
}

export const cloudflareProvider: ImageProvider = {
  id: 'cloudflare',
  label: 'Cloudflare Workers AI (ücretsiz günlük kota)',
  defaultModel: DEFAULT_MODEL,
  free: true,
  configured: () => getMissingEnv().length === 0,
  missingEnv: getMissingEnv,
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const missing = getMissingEnv();
    if (missing.length) {
      throw new ImageGenError(`${LABEL} için ${missing.join(' ve ')} tanımlı değil.`, false);
    }
    if (!req.referenceUrls.length) {
      throw new ImageGenError(`${LABEL} için en az 1 referans görsel gerekli.`, false);
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN!.trim();
    const model = resolveModel(req.model);

    const refs = await Promise.all(
      req.referenceUrls.slice(0, MAX_REFERENCE_IMAGES).map((u) => fetchImage(u, { label: 'Referans görsel' })),
    );

    const { width, height } = SIZES[req.aspectRatio];
    const form = new FormData();
    form.append('prompt', req.prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    // flux-2-klein-* modelleri sabit 4 adımlı distilled mimari kullandığından steps alanı gönderilmez.
    if (req.seed !== undefined && Number.isFinite(req.seed)) {
      form.append('seed', String(Math.trunc(req.seed)));
    }
    refs.forEach((r, i) => {
      form.append(
        `input_image_${i}`,
        new Blob([r.bytes as BlobPart], { type: r.mimeType }),
        `ref-${i}.${extForMime(r.mimeType)}`,
      );
    });

    // Model kimliğindeki '@cf/...' yolu URL path segmenti olduğu için encodeURIComponent ile bozulmamalıdır.
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
      120_000,
      LABEL,
    );
    await assertOk(res, LABEL);

    const image = await parseResponse(res);
    return { images: [image], model };
  },
};
