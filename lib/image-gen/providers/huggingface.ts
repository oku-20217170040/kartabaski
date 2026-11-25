import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import {
  MAX_IMAGE_BYTES,
  base64ToBytes,
  extForMime,
  fetchImage,
  fetchWithTimeout,
  guessMime,
  mapHttpError,
} from '../fetch-utils';

const DEFAULT_SPACE = 'black-forest-labs/FLUX.1-Kontext-Dev';
const LABEL = 'Hugging Face ZeroGPU';
const TOTAL_TIMEOUT_MS = 120_000;
const INFO_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_MULTI_REFS = 3;

const PREFERRED_ENDPOINTS = ['/infer', '/edit', '/predict', '/generate', '/run'];

const ASPECT_DIMENSIONS: Record<GenerateRequest['aspectRatio'], { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 896, height: 1120 },
  '3:4': { width: 896, height: 1152 },
  '16:9': { width: 1280, height: 720 },
};

interface GradioFileData {
  path: string;
  orig_name?: string;
  mime_type?: string;
  meta: { _type: 'gradio.FileData' };
}

interface GradioParameterInfo {
  label?: string;
  parameter_name?: string;
  parameter_has_default?: boolean;
  parameter_default?: unknown;
  component?: string;
  type?: { type?: string; minimum?: number; maximum?: number; $defs?: Record<string, unknown> };
  python_type?: { type?: string };
}

interface GradioEndpointInfo {
  parameters?: GradioParameterInfo[];
  api_visibility?: string;
  show_api?: boolean;
}

interface GradioInfoResponse {
  named_endpoints?: Record<string, GradioEndpointInfo>;
}

interface CallPlan {
  apiName: string;
  maxRefs: number;
  buildData: (files: GradioFileData[]) => unknown[];
}

interface ExtractedOutput {
  url?: string;
  path?: string;
  mimeType?: string;
}

function getToken(): string | undefined {
  const raw = process.env.HF_TOKEN?.trim();
  return raw || undefined;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function redactSecret(text: string, token?: string): string {
  if (!token) return text;
  return text.split(token).join('[GİZLİ]');
}

async function assertOkRedacted(res: Response, token?: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try {
    detail = redactSecret((await res.text()).slice(0, 300), token);
  } catch {
    /* yoksay */
  }
  throw mapHttpError(res.status, LABEL, detail);
}

function isConfigured(): boolean {
  return !!getToken() || process.env.HF_FREE_ANON === '1';
}

function resolveSpaceIdentifier(explicit?: string): string {
  const raw = (explicit || process.env.HF_IMAGE_SPACE || DEFAULT_SPACE).trim();
  return raw || DEFAULT_SPACE;
}

/**
 * Space kimliğinden (`owner/space-name`) veya tam URL'den `.hf.space` temel adresini üretir.
 * Alt alan adı 63 karakteri aşarsa Hugging Face Spaces metadata API'sine danışır.
 */
async function resolveSpaceHost(space: string, token?: string): Promise<string> {
  let owner = '';
  let name = '';

  if (/^https?:\/\//i.test(space)) {
    let parsed: URL;
    try {
      parsed = new URL(space);
    } catch {
      throw new ImageGenError('Hugging Face Space URL adresi geçersiz.', false);
    }
    if (parsed.hostname === 'huggingface.co' || parsed.hostname === 'www.huggingface.co') {
      const m = parsed.pathname.match(/^\/spaces\/([^/]+)\/([^/]+)/i);
      if (!m) {
        throw new ImageGenError('Hugging Face Space URL adresi `/spaces/sahip/ad` biçiminde olmalıdır.', false);
      }
      owner = decodeURIComponent(m[1]);
      name = decodeURIComponent(m[2]);
    } else {
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    }
  } else {
    const parts = space.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) {
      throw new ImageGenError(
        'Hugging Face Space kimliği `sahip/space-adi` veya tam `https://...hf.space` URL biçiminde olmalıdır.',
        false,
      );
    }
    [owner, name] = parts;
  }

  const slug = `${owner}-${name}`.toLowerCase().replace(/[/_.\s]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new ImageGenError('Hugging Face Space kimliği geçersiz.', false);
  }

  if (slug.length <= 63) {
    return `https://${slug}.hf.space`;
  }

  try {
    const metaRes = await fetchWithTimeout(
      `https://huggingface.co/api/spaces/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      { headers: authHeaders(token) },
      INFO_TIMEOUT_MS,
      LABEL,
    );
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { host?: unknown; subdomain?: unknown };
      if (typeof meta.host === 'string' && meta.host.startsWith('http')) {
        return meta.host.replace(/\/+$/, '');
      }
      if (typeof meta.subdomain === 'string' && meta.subdomain) {
        return `https://${meta.subdomain}.hf.space`;
      }
    }
  } catch {
    /* deterministik alt alan adına geri dön */
  }

  return `https://${slug.slice(0, 63)}.hf.space`;
}

async function fetchSpaceInfo(host: string, token?: string): Promise<GradioInfoResponse | null> {
  const res = await fetchWithTimeout(
    `${host}/gradio_api/info`,
    { headers: authHeaders(token) },
    INFO_TIMEOUT_MS,
    LABEL,
  );
  if (res.status === 404 || res.status === 405) {
    return null;
  }
  await assertOkRedacted(res, token);
  try {
    const json = (await res.json()) as GradioInfoResponse;
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

function paramKey(param: GradioParameterInfo): string {
  return (param.parameter_name || param.label || '').toLowerCase();
}

function isGalleryParam(param: GradioParameterInfo): boolean {
  if (param.component === 'Gallery') return true;
  if (param.type?.$defs && 'GalleryData' in param.type.$defs) return true;
  const py = param.python_type?.type ?? '';
  return /GalleryData|list\[.*FileData/i.test(py);
}

function isImageParam(param: GradioParameterInfo): boolean {
  if (param.component === 'Image' || param.component === 'File' || param.component === 'ImageEditor') {
    return true;
  }
  if (param.type?.$defs && 'FileData' in param.type.$defs) return true;
  const py = param.python_type?.type ?? '';
  return /FileData/i.test(py);
}

function isPromptParam(param: GradioParameterInfo): boolean {
  const key = paramKey(param);
  if (/negative|system|rewrite|history/.test(key)) return false;
  if (/prompt|instruction|caption|query/.test(key)) return true;
  return param.component === 'Textbox' && (param.python_type?.type === 'str' || param.type?.type === 'string');
}

function clampNumeric(value: number, param: GradioParameterInfo): number {
  let out = value;
  if (typeof param.type?.minimum === 'number') out = Math.max(param.type.minimum, out);
  if (typeof param.type?.maximum === 'number') out = Math.min(param.type.maximum, out);
  return out;
}

function selectEndpoint(info: GradioInfoResponse | null): [string, GradioEndpointInfo] | null {
  const endpoints = info?.named_endpoints;
  if (!endpoints || typeof endpoints !== 'object') return null;

  for (const preferred of PREFERRED_ENDPOINTS) {
    const candidate = endpoints[preferred];
    if (candidate && candidate.api_visibility !== 'private' && candidate.show_api !== false) {
      return [preferred, candidate];
    }
  }

  for (const [name, ep] of Object.entries(endpoints)) {
    if (!ep || ep.api_visibility === 'private' || ep.show_api === false) continue;
    const params = ep.parameters ?? [];
    if (params.some((p) => isGalleryParam(p) || isImageParam(p)) && params.some(isPromptParam)) {
      return [name, ep];
    }
  }
  return null;
}

function buildCallPlan(space: string, info: GradioInfoResponse | null, req: GenerateRequest): CallPlan {
  const dims = ASPECT_DIMENSIONS[req.aspectRatio];
  const hasSeed = req.seed !== undefined && Number.isFinite(req.seed);
  const seedValue = hasSeed ? Math.trunc(req.seed as number) : 42;
  const randomizeSeed = !hasSeed;

  const selected = selectEndpoint(info);
  if (selected && Array.isArray(selected[1].parameters) && selected[1].parameters.length > 0) {
    const [rawApiName, endpoint] = selected;
    const params = endpoint.parameters ?? [];
    const usesGallery = params.some(isGalleryParam);
    const imageParamCount = params.filter((p) => !isGalleryParam(p) && isImageParam(p)).length;
    const maxRefs = usesGallery ? MAX_MULTI_REFS : Math.max(1, Math.min(MAX_MULTI_REFS, imageParamCount));

    return {
      apiName: rawApiName.replace(/^\/+/, ''),
      maxRefs,
      buildData: (files) => {
        let imageIndex = 0;
        let promptAssigned = false;

        return params.map((param) => {
          const key = paramKey(param);

          if (isGalleryParam(param)) {
            return files.map((f) => ({ image: f, caption: null }));
          }
          if (param.component === 'ImageEditor') {
            const f = files[0];
            return { background: f, layers: [], composite: f };
          }
          if (isImageParam(param)) {
            const f = files[imageIndex] ?? (param.parameter_has_default ? param.parameter_default : files[0]);
            imageIndex += 1;
            return f;
          }
          if (!promptAssigned && isPromptParam(param)) {
            promptAssigned = true;
            return req.prompt;
          }
          if (key === 'seed') {
            if (hasSeed) return seedValue;
            return typeof param.parameter_default === 'number' ? param.parameter_default : seedValue;
          }
          if (key === 'randomize_seed' || key === 'random_seed') {
            return randomizeSeed;
          }
          if (key === 'rewrite_prompt' || key === 'enhance_prompt') {
            return false;
          }
          if (key === 'aspect_ratio' || key === 'aspect') {
            return req.aspectRatio;
          }
          if (key === 'width') {
            return clampNumeric(dims.width, param);
          }
          if (key === 'height') {
            return clampNumeric(dims.height, param);
          }
          return param.parameter_has_default ? param.parameter_default : null;
        });
      },
    };
  }

  // `/gradio_api/info` olmadığında bilinen resmi Space şemalarına düş
  if (/kontext/i.test(space)) {
    return {
      apiName: 'infer',
      maxRefs: 1,
      buildData: (files) => [files[0], req.prompt, seedValue, randomizeSeed, 2.5, 28],
    };
  }

  if (/2509|2511/i.test(space)) {
    return {
      apiName: 'infer',
      maxRefs: MAX_MULTI_REFS,
      buildData: (files) => [
        files.map((f) => ({ image: f, caption: null })),
        req.prompt,
        seedValue,
        randomizeSeed,
        1.0,
        40,
        dims.height,
        dims.width,
        false,
      ],
    };
  }

  return {
    apiName: 'infer',
    maxRefs: 1,
    buildData: (files) => [files[0], req.prompt, seedValue, randomizeSeed, 1.0, 40, false],
  };
}

async function uploadFiles(
  host: string,
  refs: { bytes: Uint8Array; mimeType: string }[],
  token?: string,
): Promise<GradioFileData[]> {
  const form = new FormData();
  const names = refs.map((r, i) => `ref-${i}.${extForMime(r.mimeType)}`);
  refs.forEach((r, i) => {
    form.append('files', new Blob([r.bytes as BlobPart], { type: r.mimeType }), names[i]);
  });

  const res = await fetchWithTimeout(
    `${host}/gradio_api/upload`,
    { method: 'POST', headers: authHeaders(token), body: form },
    UPLOAD_TIMEOUT_MS,
    LABEL,
  );
  await assertOkRedacted(res, token);

  let uploaded: unknown;
  try {
    uploaded = await res.json();
  } catch {
    throw new ImageGenError(`${LABEL}: dosya yükleme yanıtı okunamadı.`, true);
  }

  if (!Array.isArray(uploaded) || !uploaded.length) {
    throw new ImageGenError(`${LABEL}: referans görsel yüklenemedi.`, true);
  }

  return uploaded.map((item, i) => {
    const path =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string'
          ? (item as { path: string }).path
          : '';
    if (!path) {
      throw new ImageGenError(`${LABEL}: yüklenen dosya yolu geçersiz.`, true);
    }
    return {
      path,
      orig_name: names[i] ?? 'ref.png',
      mime_type: refs[i]?.mimeType ?? 'image/png',
      meta: { _type: 'gradio.FileData' },
    };
  });
}

function buildSseError(rawData: string, token?: string): ImageGenError {
  let detail = rawData.trim();
  if (detail) {
    try {
      const parsed = JSON.parse(detail) as unknown;
      if (parsed == null) {
        detail = '';
      } else if (typeof parsed === 'string') {
        detail = parsed;
      } else if (typeof parsed === 'object') {
        const obj = parsed as { message?: unknown; error?: unknown };
        if (typeof obj.message === 'string') detail = obj.message;
        else if (typeof obj.error === 'string') detail = obj.error;
      }
    } catch {
      /* ham metni kullan */
    }
  }

  const normalized = detail.trim().toLowerCase() === 'null' ? '' : detail.replace(/\s+/g, ' ').trim();
  const safeDetail = redactSecret(normalized.slice(0, 200), token);
  if (!safeDetail) {
    return new ImageGenError(
      `${LABEL}: Space hata ayrıntısı döndürmedi; HF_TOKEN gerekebilir veya servis yoğun olabilir.`,
      true,
    );
  }

  const isQuotaOrQueue = /quota|zerogpu|gpu|busy|queue|capacity|limit|rate|exceeded|timeout/i.test(safeDetail);

  if (isQuotaOrQueue) {
    return new ImageGenError(
      `${LABEL}: ücretsiz ZeroGPU kotası doldu veya kuyruk yoğun, biraz bekleyip tekrar deneyin. (${safeDetail})`,
      true,
    );
  }

  return new ImageGenError(`${LABEL}: görsel üretimi başarısız oldu (${safeDetail}).`, true);
}

function extractImagesFromPayload(payload: unknown): ExtractedOutput[] {
  const results: ExtractedOutput[] = [];
  const seen = new Set<string>();

  function visit(node: unknown): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === 'string') {
      if ((/^https?:\/\//i.test(node) || node.startsWith('data:image/')) && !seen.has(node)) {
        seen.add(node);
        results.push({ url: node });
      }
      return;
    }
    if (typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    if ('image' in obj && obj.image && typeof obj.image === 'object') {
      visit(obj.image);
      return;
    }
    if ('root' in obj) {
      visit(obj.root);
      return;
    }

    const url = typeof obj.url === 'string' && obj.url ? obj.url : undefined;
    const path = typeof obj.path === 'string' && obj.path ? obj.path : undefined;
    const mimeType = typeof obj.mime_type === 'string' && obj.mime_type ? obj.mime_type : undefined;
    if (url || path) {
      const key = url || path || '';
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ url, path, mimeType });
      }
    }
  }

  visit(payload);
  return results;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    const colonIdx = line.indexOf(':');
    const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
    const rawValue = colonIdx === -1 ? '' : line.slice(colonIdx + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (!dataLines.length && event === 'message') return null;
  return { event, data: dataLines.join('\n') };
}

async function readSseResult(res: Response, token?: string): Promise<ExtractedOutput[]> {
  let buffer = '';

  const handleChunkText = (chunk: string): ExtractedOutput[] | null => {
    buffer += chunk;
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (!parsed) continue;
      if (parsed.event === 'error') {
        throw buildSseError(parsed.data, token);
      }
      if (parsed.event === 'complete') {
        let json: unknown;
        try {
          json = JSON.parse(parsed.data);
        } catch {
          throw new ImageGenError(`${LABEL}: tamamlanma verisi çözümlenemedi.`, true);
        }
        return extractImagesFromPayload(json);
      }
    }
    return null;
  };

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = td ? td.decode(value, { stream: true }) : Buffer.from(value).toString('utf8');
        const found = handleChunkText(text);
        if (found) return found;
      }
      const trailing = handleChunkText(`${td ? td.decode() : ''}\n\n`);
      if (trailing) return trailing;
    } finally {
      reader.releaseLock();
    }
  } else {
    const fullText = await res.text();
    const found = handleChunkText(`${fullText}\n\n`);
    if (found) return found;
  }

  throw new ImageGenError(`${LABEL}: akış tamamlanmadan sona erdi.`, true);
}

function isTrustedHfUrl(targetUrl: string, host: string): boolean {
  try {
    const target = new URL(targetUrl);
    const spaceHost = new URL(host);
    if (target.origin === spaceHost.origin) return true;
    if (target.protocol !== 'https:') return false;
    return (
      target.hostname.endsWith('.hf.space') ||
      target.hostname === 'huggingface.co' ||
      target.hostname.endsWith('.huggingface.co')
    );
  } catch {
    return false;
  }
}

async function downloadOutputImage(
  out: ExtractedOutput,
  host: string,
  token?: string,
): Promise<{ data: Uint8Array; mimeType: string }> {
  const rawUrl = out.url
    ? out.url.startsWith('/')
      ? `${host}${out.url}`
      : out.url
    : out.path
      ? `${host}/gradio_api/file=${encodeURI(out.path)}`
      : '';

  if (!rawUrl) {
    throw new ImageGenError(`${LABEL}: çıktı görsel adresi bulunamadı.`, true);
  }

  if (rawUrl.startsWith('data:image/')) {
    const commaIdx = rawUrl.indexOf(',');
    const meta = rawUrl.slice(5, commaIdx);
    const mimeType = meta.split(';')[0] || out.mimeType || 'image/png';
    return { data: base64ToBytes(rawUrl.slice(commaIdx + 1)), mimeType };
  }

  const headers = isTrustedHfUrl(rawUrl, host) ? authHeaders(token) : {};
  const res = await fetchWithTimeout(rawUrl, { headers }, DOWNLOAD_TIMEOUT_MS, LABEL);
  await assertOkRedacted(res, token);

  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_IMAGE_BYTES) {
    throw new ImageGenError(`${LABEL}: üretilen görsel çok büyük (en fazla 15MB).`, false);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageGenError(`${LABEL}: üretilen görsel çok büyük (en fazla 15MB).`, false);
  }

  const headerMime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const mimeType = headerMime.startsWith('image/') ? headerMime : out.mimeType || guessMime(rawUrl);
  return { data: new Uint8Array(buf), mimeType };
}

export const huggingfaceProvider: ImageProvider = {
  id: 'huggingface',
  label: 'Hugging Face ZeroGPU (ücretsiz)',
  defaultModel: DEFAULT_SPACE,
  free: true,
  configured: isConfigured,
  missingEnv: () => (isConfigured() ? [] : ['HF_TOKEN']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (!isConfigured()) {
      throw new ImageGenError(
        `${LABEL} için HF_TOKEN tanımlı değil (anahtarsız denemek için HF_FREE_ANON=1 ayarlayın).`,
        false,
      );
    }
    if (!req.referenceUrls.length) {
      throw new ImageGenError(`${LABEL} için en az bir referans görsel URL'si gerekli.`, false);
    }

    const token = getToken();
    const space = resolveSpaceIdentifier(req.model);
    const started = Date.now();
    const host = await resolveSpaceHost(space, token);

    const info = await fetchSpaceInfo(host, token);
    const plan = buildCallPlan(space, info, req);

    const refs = await Promise.all(
      req.referenceUrls.slice(0, plan.maxRefs).map((u) => fetchImage(u, { label: 'Referans görsel' })),
    );
    const uploadedFiles = await uploadFiles(host, refs, token);
    const data = plan.buildData(uploadedFiles);

    const callUrl = `${host}/gradio_api/call/${encodeURIComponent(plan.apiName)}`;
    const callRes = await fetchWithTimeout(
      callUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ data }),
      },
      Math.max(5_000, TOTAL_TIMEOUT_MS - (Date.now() - started)),
      LABEL,
    );
    await assertOkRedacted(callRes, token);

    let eventId = '';
    try {
      const json = (await callRes.json()) as { event_id?: unknown };
      if (typeof json.event_id === 'string') eventId = json.event_id;
    } catch {
      /* aşağıda hata fırlat */
    }
    if (!eventId) {
      throw new ImageGenError(`${LABEL}: geçerli event_id alınamadı.`, true);
    }

    const sseRes = await fetchWithTimeout(
      `${callUrl}/${encodeURIComponent(eventId)}`,
      { headers: { Accept: 'text/event-stream', ...authHeaders(token) } },
      Math.max(5_000, TOTAL_TIMEOUT_MS - (Date.now() - started)),
      LABEL,
    );
    await assertOkRedacted(sseRes, token);

    const outputs = await readSseResult(sseRes, token);
    if (!outputs.length) {
      throw new ImageGenError(`${LABEL}: görsel döndürmedi.`, true);
    }

    const image = await downloadOutputImage(outputs[0], host, token);
    return {
      images: [image],
      model: space,
      costUsd: 0,
    };
  },
};
