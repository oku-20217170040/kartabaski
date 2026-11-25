import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { assertOk, base64ToBytes, extForMime, fetchImage, fetchWithTimeout } from '../fetch-utils';

const DEFAULT_MODEL = 'gpt-image-1';
const LABEL = 'OpenAI';
const MAX_REFERENCE_IMAGES = 16;

const SIZES: Record<GenerateRequest['aspectRatio'], string> = {
  '1:1': '1024x1024',
  '4:5': '1024x1536',
  '3:4': '1024x1536',
  '16:9': '1536x1024',
};

interface OpenAIImagesResponse {
  output_format?: string;
  data?: { b64_json?: string; url?: string }[];
}

function mimeForOutputFormat(format?: string): string {
  const f = format?.toLowerCase();
  if (f === 'jpeg' || f === 'jpg') return 'image/jpeg';
  if (f === 'webp') return 'image/webp';
  return 'image/png';
}

export const openaiProvider: ImageProvider = {
  id: 'openai',
  label: 'OpenAI (gpt-image-1)',
  defaultModel: DEFAULT_MODEL,
  free: false,
  configured: () => !!process.env.OPENAI_API_KEY,
  missingEnv: () => (process.env.OPENAI_API_KEY ? [] : ['OPENAI_API_KEY']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ImageGenError('OpenAI için OPENAI_API_KEY tanımlı değil.', false);
    if (!req.referenceUrls.length) {
      throw new ImageGenError('OpenAI için en az 1 referans görsel gerekli.', false);
    }
    if (req.referenceUrls.length > MAX_REFERENCE_IMAGES) {
      throw new ImageGenError(`OpenAI en fazla ${MAX_REFERENCE_IMAGES} referans görsel destekler.`, false);
    }
    const model = req.model || process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;

    const refs = await Promise.all(req.referenceUrls.map((u) => fetchImage(u, { label: 'Referans görsel' })));
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', req.prompt);
    form.append('size', SIZES[req.aspectRatio]);
    form.append('n', '1');
    // gpt-image-* modelleri response_format kabul etmez (her zaman b64_json döner); output_format dosya biçimini belirler.
    if (/^gpt-image-/i.test(model)) {
      form.append('output_format', 'png');
    }
    // Ürün baskısı/logo detaylarını korumak için input_fidelity yalnız destekleyen gpt-image-1 / 1.5 modellerinde gönderilir.
    if (/^gpt-image-1(\.5)?$/i.test(model)) {
      form.append('input_fidelity', 'high');
    }
    refs.forEach((r, i) => {
      form.append('image[]', new Blob([r.bytes as BlobPart], { type: r.mimeType }), `ref-${i}.${extForMime(r.mimeType)}`);
    });

    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/images/edits',
      { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form },
      120_000,
      LABEL,
    );
    await assertOk(res, LABEL);
    const json = (await res.json()) as OpenAIImagesResponse;
    const mimeType = mimeForOutputFormat(json.output_format);
    const images: { data?: Uint8Array; url?: string; mimeType?: string }[] = [];
    for (const d of json.data ?? []) {
      if (d.b64_json) images.push({ data: base64ToBytes(d.b64_json), mimeType });
      else if (d.url) images.push({ url: d.url, ...(json.output_format ? { mimeType } : {}) });
    }
    if (!images.length) throw new ImageGenError('OpenAI görsel döndürmedi.', true);
    return { images, model };
  },
};
