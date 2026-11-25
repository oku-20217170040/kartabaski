jest.mock('server-only', () => ({}));

import { STUDIO_SCENES, DEFAULT_SCENE_IDS, PRESERVE_RULES, buildPrompt } from '@/lib/image-gen/prompts';
import { PROVIDERS, getProvider, listProviders, pickProvider } from '@/lib/image-gen/registry';
import { fetchImage, mapHttpError } from '@/lib/image-gen/fetch-utils';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_IMAGE_MODEL',
  'HF_TOKEN',
  'HF_FREE_ANON',
  'HF_IMAGE_SPACE',
  'GEMINI_API_KEY',
  'GEMINI_IMAGE_MODEL',
  'FAL_KEY',
  'FAL_IMAGE_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_IMAGE_MODEL',
  'REPLICATE_API_TOKEN',
  'REPLICATE_IMAGE_MODEL',
  'IMAGE_GEN_MOCK',
];
const savedEnv: Record<string, string | undefined> = {};
const realFetch = global.fetch;

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = realFetch;
});

const REF_BYTES = [1, 2, 3, 4];

function imgRes(contentType = 'image/png') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => new Uint8Array(REF_BYTES).buffer,
  };
}
function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** İlk çağrılar referans indirme (image/*), kalanlar sırayla verilen yanıtlar. */
function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const baseReq: GenerateRequest = {
  referenceUrls: ['https://res.cloudinary.com/x/a.png', 'https://res.cloudinary.com/x/b.jpg'],
  prompt: 'PROMPT',
  aspectRatio: '4:5',
};

describe('prompts', () => {
  it('en az 8 sahne, benzersiz id, Türkçe etiket + İngilizce prompt', () => {
    expect(STUDIO_SCENES.length).toBeGreaterThanOrEqual(8);
    const ids = STUDIO_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STUDIO_SCENES) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.prompt.length).toBeGreaterThan(30);
      expect(['1:1', '4:5', '3:4', '16:9']).toContain(s.aspectRatio);
    }
  });
  it('DEFAULT_SCENE_IDS 4 geçerli sahne', () => {
    expect(DEFAULT_SCENE_IDS).toHaveLength(4);
    for (const id of DEFAULT_SCENE_IDS) expect(ids().includes(id)).toBe(true);
  });
  it('buildPrompt sahne, nesne/renk ipucu, extra ve koruma kurallarını birleştirir; Türkçe başlığı sızdırmaz', () => {
    const p = buildPrompt(STUDIO_SCENES[0], { title: 'Seramik Kahve Fincanı - Kişiye Özel Baskı', category: 'Seramik Kahve Fincanı', color: 'red', extra: 'EXTRA_NOTE' });
    expect(p).toContain(STUDIO_SCENES[0].prompt);
    expect(p).toContain('ceramic coffee cup');
    expect(p).toContain('red');
    expect(p).toContain('EXTRA_NOTE');
    expect(p).toContain(PRESERVE_RULES);
    expect(p).not.toContain('Kişiye Özel Baskı');
    expect(buildPrompt(STUDIO_SCENES[0], { title: 'A' })).not.toContain('undefined');
  });
});
function ids() {
  return STUDIO_SCENES.map((s) => s.id);
}

describe('registry', () => {
  it('sıra: cloudflare, huggingface (ücretsizler önce), ardından gemini, fal, openai, replicate, mock', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual([
      'cloudflare',
      'huggingface',
      'gemini',
      'fal',
      'openai',
      'replicate',
      'mock',
    ]);
    expect(getProvider('cloudflare')?.id).toBe('cloudflare');
    expect(getProvider('huggingface')?.id).toBe('huggingface');
    expect(getProvider('fal')?.id).toBe('fal');
  });
  it('hiçbir env yokken yapılandırılmış sağlayıcı yok; yalnız cloudflare ve huggingface ücretsiz', () => {
    expect(pickProvider()).toBeNull();
    const l = listProviders();
    expect(l.every((p) => !p.configured)).toBe(true);
    expect(l.find((p) => p.id === 'cloudflare')?.missingEnv).toEqual(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']);
    expect(l.find((p) => p.id === 'cloudflare')?.free).toBe(true);
    expect(l.find((p) => p.id === 'huggingface')?.missingEnv).toEqual(['HF_TOKEN']);
    expect(l.find((p) => p.id === 'huggingface')?.free).toBe(true);
    expect(l.find((p) => p.id === 'gemini')?.missingEnv).toEqual(['GEMINI_API_KEY']);
    expect(l.find((p) => p.id === 'gemini')?.free).toBe(false);
  });
  it('pick: tercih yapılandırılmışsa o, değilse ilk yapılandırılmış (ücretsizler öncelikli)', () => {
    process.env.FAL_KEY = 'secret-fal';
    process.env.OPENAI_API_KEY = 'secret-oa';
    expect(pickProvider()?.id).toBe('fal');
    expect(pickProvider('openai')?.id).toBe('openai');
    expect(pickProvider('cloudflare')?.id).toBe('fal');
    process.env.HF_FREE_ANON = '1';
    expect(pickProvider()?.id).toBe('huggingface');
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf-acc';
    process.env.CLOUDFLARE_API_TOKEN = 'cf-tok';
    expect(pickProvider()?.id).toBe('cloudflare');
  });
  it('mock yalnız IMAGE_GEN_MOCK=1 iken yapılandırılmış', () => {
    expect(getProvider('mock')?.configured()).toBe(false);
    process.env.IMAGE_GEN_MOCK = '1';
    expect(getProvider('mock')?.configured()).toBe(true);
  });
  it('listProviders anahtar değerini asla içermez', () => {
    process.env.GEMINI_API_KEY = 'TOP-SECRET-VALUE';
    expect(JSON.stringify(listProviders())).not.toContain('TOP-SECRET-VALUE');
  });
});

describe('fetch-utils', () => {
  it('HTTP hata eşlemesi', () => {
    expect(mapHttpError(401, 'X').retryable).toBe(false);
    expect(mapHttpError(403, 'X').retryable).toBe(false);
    expect(mapHttpError(429, 'X').retryable).toBe(true);
    expect(mapHttpError(503, 'X').retryable).toBe(true);
    expect(mapHttpError(400, 'X').retryable).toBe(false);
    expect(mapHttpError(401, 'X')).toBeInstanceOf(ImageGenError);
  });
  it('fetchImage bayt + mime döndürür', async () => {
    mockFetch(() => imgRes('image/webp; charset=x'));
    const r = await fetchImage('https://a/x');
    expect(Array.from(r.bytes)).toEqual(REF_BYTES);
    expect(r.mimeType).toBe('image/webp');
  });
  it('15MB sınırını aşan görseli reddeder', async () => {
    mockFetch(() => ({ ...imgRes(), headers: { get: (h: string) => (h === 'content-length' ? String(16 * 1024 * 1024) : 'image/png') } }));
    await expect(fetchImage('https://a/x')).rejects.toThrow(/çok büyük/);
  });
  it('HTTP 404/429 hatalarını ImageGenError yapar', async () => {
    mockFetch(() => ({ ok: false, status: 429, headers: { get: () => null } }));
    await expect(fetchImage('https://a/x')).rejects.toMatchObject({ retryable: true, status: 429 });
  });
});

describe('mock adaptörü', () => {
  it('referans görseli aynen döndürür', async () => {
    process.env.IMAGE_GEN_MOCK = '1';
    mockFetch(() => imgRes('image/jpeg'));
    const r = await getProvider('mock')!.generate(baseReq);
    expect(Array.from(r.images[0].data!)).toEqual(REF_BYTES);
    expect(r.images[0].mimeType).toBe('image/jpeg');
  });
});
