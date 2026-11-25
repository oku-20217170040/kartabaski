import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { assertOk, fetchWithTimeout } from '../fetch-utils';

const DEFAULT_MODEL = 'fal-ai/bytedance/seedream/v4/edit';
const LABEL = 'fal.ai';
const SEEDREAM_MAX_IMAGES = 10;

// Seedream v4 edit min toplam alan >= 921.600 px, her eksen <= 4096 px kuralına uygun boyutlar.
const SEEDREAM_SIZES: Record<GenerateRequest['aspectRatio'], { width: number; height: number }> = {
  '1:1': { width: 2048, height: 2048 },
  '4:5': { width: 1638, height: 2048 },
  '3:4': { width: 1536, height: 2048 },
  '16:9': { width: 2048, height: 1152 },
};

// FLUX.1 Kontext enum'u ('21:9'|'16:9'|'4:3'|'3:2'|'1:1'|'2:3'|'3:4'|'9:16'|'9:21') 4:5 içermez.
const KONTEXT_ASPECT_RATIOS: Record<GenerateRequest['aspectRatio'], string> = {
  '1:1': '1:1',
  '4:5': '3:4',
  '3:4': '3:4',
  '16:9': '16:9',
};

interface FalImageOutput {
  url?: unknown;
  content_type?: unknown;
}

interface FalResponse {
  images?: FalImageOutput[];
  image?: FalImageOutput;
}

function resolveModel(explicit?: string): string {
  const raw = (explicit || process.env.FAL_IMAGE_MODEL || DEFAULT_MODEL).trim().replace(/^\/+/, '');
  return raw || DEFAULT_MODEL;
}

function buildRequestBody(model: string, req: GenerateRequest): Record<string, unknown> {
  const isSeedream = /seedream/i.test(model);
  const isKontext = /kontext/i.test(model);
  const isMultiImage = isSeedream || /\/multi(?:\/|$)/i.test(model);

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    num_images: 1,
  };

  if (isMultiImage) {
    body.image_urls = req.referenceUrls.slice(0, SEEDREAM_MAX_IMAGES);
  } else {
    body.image_url = req.referenceUrls[0];
  }

  if (isSeedream) {
    body.image_size = SEEDREAM_SIZES[req.aspectRatio];
  } else if (isKontext) {
    body.aspect_ratio = KONTEXT_ASPECT_RATIOS[req.aspectRatio];
  } else {
    body.aspect_ratio = req.aspectRatio;
  }

  if (req.seed !== undefined) {
    body.seed = req.seed;
  }

  return body;
}

export const falProvider: ImageProvider = {
  id: 'fal',
  label: 'fal.ai (Seedream / Flux Kontext)',
  defaultModel: DEFAULT_MODEL,
  free: false,
  configured: () => !!process.env.FAL_KEY?.trim(),
  missingEnv: () => (process.env.FAL_KEY?.trim() ? [] : ['FAL_KEY']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = process.env.FAL_KEY?.trim();
    if (!key) throw new ImageGenError('fal.ai için FAL_KEY tanımlı değil.', false);
    if (!req.referenceUrls.length) {
      throw new ImageGenError('fal.ai için en az bir referans görsel URL\'si gerekli.', false);
    }

    const model = resolveModel(req.model);
    const body = buildRequestBody(model, req);

    const res = await fetchWithTimeout(
      `https://fal.run/${model}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
        body: JSON.stringify(body),
      },
      120_000,
      LABEL,
    );
    await assertOk(res, LABEL);

    let json: FalResponse;
    try {
      json = (await res.json()) as FalResponse;
    } catch {
      throw new ImageGenError('fal.ai geçersiz JSON yanıtı döndürdü.', true);
    }

    const list = Array.isArray(json.images) && json.images.length ? json.images : json.image ? [json.image] : [];
    const images = list
      .filter((i): i is { url: string; content_type?: string } => typeof i?.url === 'string' && i.url.length > 0)
      .map((i) => ({
        url: i.url,
        mimeType: typeof i.content_type === 'string' ? i.content_type : undefined,
      }));
    if (!images.length) throw new ImageGenError('fal.ai görsel döndürmedi.', true);
    return { images, model };
  },
};
