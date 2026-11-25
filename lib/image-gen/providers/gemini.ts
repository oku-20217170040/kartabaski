import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { assertOk, base64ToBytes, bytesToBase64, fetchImage, fetchWithTimeout } from '../fetch-utils';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const LABEL = 'Google Gemini';

const NON_RETRYABLE_REASONS = new Set([
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
  'IMAGE_RECITATION',
  'IMAGE_OTHER',
]);

interface InlineData {
  mimeType?: string;
  data?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: InlineData;
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiResponse {
  promptFeedback?: {
    blockReason?: string;
  };
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
}

function buildEmptyImageError(json: GeminiResponse): ImageGenError {
  const blockReason = json.promptFeedback?.blockReason;
  if (blockReason) {
    const isPolicy = NON_RETRYABLE_REASONS.has(blockReason);
    return new ImageGenError(
      isPolicy
        ? `Gemini isteği güvenlik/içerik filtresi tarafından engellendi (${blockReason}).`
        : `Gemini isteği reddetti (${blockReason}).`,
      !isPolicy,
    );
  }

  const finishReason = json.candidates?.find((c) => c.finishReason && c.finishReason !== 'STOP')?.finishReason;
  if (finishReason) {
    if (finishReason === 'NO_IMAGE') {
      return new ImageGenError('Gemini görsel üretemedi (NO_IMAGE). Lütfen tekrar deneyin.', true);
    }
    if (NON_RETRYABLE_REASONS.has(finishReason)) {
      return new ImageGenError(
        `Gemini görsel üretimi içerik/güvenlik filtresi nedeniyle durduruldu (${finishReason}).`,
        false,
      );
    }
    return new ImageGenError(`Gemini görsel döndürmedi (durum: ${finishReason}).`, true);
  }

  return new ImageGenError('Gemini görsel döndürmedi (içerik filtresi veya model yanıtı boş olabilir).', true);
}

export const geminiProvider: ImageProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: DEFAULT_MODEL,
  free: false,
  configured: () => !!process.env.GEMINI_API_KEY,
  missingEnv: () => (process.env.GEMINI_API_KEY ? [] : ['GEMINI_API_KEY']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ImageGenError('Gemini için GEMINI_API_KEY tanımlı değil.', false);
    const model = req.model || process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

    const refs = await Promise.all(req.referenceUrls.map((u) => fetchImage(u, { label: 'Referans görsel' })));
    const parts: Record<string, unknown>[] = [{ text: req.prompt }];
    for (const r of refs) {
      parts.push({ inlineData: { mimeType: r.mimeType, data: bytesToBase64(r.bytes) } });
    }

    // gemini-2.5-flash-image yalnızca ['IMAGE'] ile bazı durumlarda hata/boş yanıt verebildiği için ['TEXT', 'IMAGE'] önerilir.
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: req.aspectRatio },
    };
    if (req.seed !== undefined && Number.isFinite(req.seed)) {
      generationConfig.seed = Math.trunc(req.seed);
    }

    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
      },
      120_000,
      LABEL,
    );
    await assertOk(res, LABEL);
    const json = (await res.json()) as GeminiResponse;

    const images: { data: Uint8Array; mimeType: string }[] = [];
    for (const c of json.candidates ?? []) {
      for (const p of c.content?.parts ?? []) {
        const d: InlineData | undefined =
          p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : undefined);
        if (d?.data) images.push({ data: base64ToBytes(d.data), mimeType: d.mimeType ?? 'image/png' });
      }
    }
    if (!images.length) {
      throw buildEmptyImageError(json);
    }
    return { images, model };
  },
};
