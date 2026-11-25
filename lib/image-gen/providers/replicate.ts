import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { assertOk, fetchWithTimeout } from '../fetch-utils';

const DEFAULT_MODEL = 'black-forest-labs/flux-kontext-pro';
const LABEL = 'Replicate';
const TOTAL_MS = 120_000;

interface Prediction {
  status?: string;
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
}

function buildInput(model: string, req: GenerateRequest): { input: Record<string, unknown>; requestedPng: boolean } {
  const isSeedream = /seedream/i.test(model);
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    aspect_ratio: req.aspectRatio,
  };
  if (!isSeedream) input.output_format = 'png';

  if (/multi-image-kontext/i.test(model)) {
    if (req.referenceUrls[0]) input.input_image_1 = req.referenceUrls[0];
    const second = req.referenceUrls[1] ?? req.referenceUrls[0];
    if (second) input.input_image_2 = second;
  } else if (/flux-2/i.test(model)) {
    if (req.referenceUrls.length) input.input_images = req.referenceUrls;
  } else if (isSeedream) {
    if (req.referenceUrls.length) input.image_input = req.referenceUrls;
  } else if (req.referenceUrls[0]) {
    // flux-kontext-pro / flux-kontext-max tekil referans alanı
    input.input_image = req.referenceUrls[0];
  }

  if (req.seed !== undefined) input.seed = Math.trunc(req.seed);
  return { input, requestedPng: !isSeedream };
}

function mimeForUrl(url: string, requestedPng: boolean): string {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return requestedPng ? 'image/png' : 'image/jpeg';
}

export const replicateProvider: ImageProvider = {
  id: 'replicate',
  label: 'Replicate (Flux Kontext)',
  defaultModel: DEFAULT_MODEL,
  free: false,
  configured: () => !!process.env.REPLICATE_API_TOKEN,
  missingEnv: () => (process.env.REPLICATE_API_TOKEN ? [] : ['REPLICATE_API_TOKEN']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new ImageGenError('Replicate için REPLICATE_API_TOKEN tanımlı değil.', false);
    const model = (req.model || process.env.REPLICATE_IMAGE_MODEL || DEFAULT_MODEL).trim();
    const started = Date.now();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const { input, requestedPng } = buildInput(model, req);

    // "owner/name:version" veya yalın sürüm hash'i -> /v1/predictions + version; resmi model -> /v1/models/{owner}/{name}/predictions.
    const [name, version] = model.split(':');
    const resolvedVersion = version || (!name.includes('/') ? name : '');
    const url = resolvedVersion
      ? 'https://api.replicate.com/v1/predictions'
      : `https://api.replicate.com/v1/models/${name}/predictions`;
    const body = resolvedVersion ? { version: resolvedVersion, input } : { input };

    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { ...headers, Prefer: 'wait' }, body: JSON.stringify(body) },
      TOTAL_MS,
      LABEL,
    );
    await assertOk(res, LABEL);
    let pred = (await res.json()) as Prediction;

    while (pred.status === 'starting' || pred.status === 'processing') {
      const elapsed = Date.now() - started;
      if (!pred.urls?.get || elapsed >= TOTAL_MS) {
        throw new ImageGenError('Replicate: üretim zaman aşımına uğradı.', true);
      }
      await new Promise((r) => setTimeout(r, 2000));
      const remaining = Math.max(1_000, Math.min(30_000, TOTAL_MS - (Date.now() - started)));
      const poll = await fetchWithTimeout(pred.urls.get, { headers }, remaining, LABEL);
      await assertOk(poll, LABEL);
      pred = (await poll.json()) as Prediction;
    }

    if (pred.status === 'failed' || pred.status === 'canceled' || pred.status === 'aborted') {
      throw new ImageGenError(
        `Replicate: üretim başarısız oldu${pred.error ? ` (${String(pred.error).slice(0, 200)})` : ''}.`,
        true,
      );
    }
    const out = Array.isArray(pred.output) ? pred.output : pred.output ? [pred.output] : [];
    const images = out
      .filter((u): u is string => typeof u === 'string' && !!u)
      .map((u) => ({ url: u, mimeType: mimeForUrl(u, requestedPng) }));
    if (!images.length) throw new ImageGenError('Replicate görsel döndürmedi.', true);
    return { images, model };
  },
};
