jest.mock('server-only', () => ({}));

import { geminiProvider } from '@/lib/image-gen/providers/gemini';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL'];
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

describe('gemini adaptörü', () => {
  it('sağlayıcı meta verileri: free=false ve label Google Gemini', () => {
    expect(geminiProvider.id).toBe('gemini');
    expect(geminiProvider.label).toBe('Google Gemini');
    expect(geminiProvider.free).toBe(false);
    expect(geminiProvider.defaultModel).toBe('gemini-2.5-flash-image');
  });

  it('istek gövdesi ve inlineData ayrıştırma', async () => {
    process.env.GEMINI_API_KEY = 'k-gem';
    const out = Buffer.from([9, 8, 7]).toString('base64');
    const f = mockFetch((url) =>
      url.includes('generativelanguage')
        ? jsonRes({ candidates: [{ content: { parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/png', data: out } }] } }] })
        : imgRes('image/jpeg'),
    );
    const r = await geminiProvider.generate({ ...baseReq, seed: 42.9 });
    const call = f.mock.calls.find((c) => String(c[0]).includes('generativelanguage'))!;
    expect(String(call[0])).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent');
    const headers = call[1]!.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('k-gem');
    const body = JSON.parse(call[1]!.body as string);
    expect(body.contents[0].parts[0]).toEqual({ text: 'PROMPT' });
    expect(body.contents[0].parts).toHaveLength(3);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    expect(body.contents[0].parts[1].inlineData.data).toBe(Buffer.from(REF_BYTES).toString('base64'));
    expect(body.generationConfig.responseModalities).toEqual(['TEXT', 'IMAGE']);
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('4:5');
    expect(body.generationConfig.seed).toBe(42);
    expect(r.model).toBe('gemini-2.5-flash-image');
    expect(Array.from(r.images[0].data!)).toEqual([9, 8, 7]);
    expect(r.images[0].mimeType).toBe('image/png');
  });

  it('yanıtta inline_data (snake_case) gelse de ayrıştırır', async () => {
    process.env.GEMINI_API_KEY = 'k-gem';
    const out = Buffer.from([5, 6]).toString('base64');
    mockFetch((url) =>
      url.includes('generativelanguage')
        ? jsonRes({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/webp', data: out } }] } }] })
        : imgRes(),
    );
    const r = await geminiProvider.generate(baseReq);
    expect(Array.from(r.images[0].data!)).toEqual([5, 6]);
    expect(r.images[0].mimeType).toBe('image/webp');
  });

  it('model env ile değişir; boş yanıtta hata', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.GEMINI_IMAGE_MODEL = 'gemini-custom';
    const f = mockFetch((url) =>
      url.includes('generativelanguage') ? jsonRes({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }) : imgRes(),
    );
    await expect(geminiProvider.generate(baseReq)).rejects.toBeInstanceOf(ImageGenError);
    const call = f.mock.calls.find((c) => String(c[0]).includes('generativelanguage'))!;
    expect(String(call[0])).toContain('/models/gemini-custom:generateContent');
  });

  it('promptFeedback.blockReason güvenlik engelinde anlamlı Türkçe hata (retryable=false)', async () => {
    process.env.GEMINI_API_KEY = 'k';
    mockFetch((url) =>
      url.includes('generativelanguage') ? jsonRes({ promptFeedback: { blockReason: 'SAFETY' } }) : imgRes(),
    );
    await expect(geminiProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining('SAFETY'),
    });
  });

  it('candidate finishReason IMAGE_SAFETY olduğunda retryable=false', async () => {
    process.env.GEMINI_API_KEY = 'k';
    mockFetch((url) =>
      url.includes('generativelanguage') ? jsonRes({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }) : imgRes(),
    );
    await expect(geminiProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining('IMAGE_SAFETY'),
    });
  });

  it('candidate finishReason NO_IMAGE olduğunda retryable=true', async () => {
    process.env.GEMINI_API_KEY = 'k';
    mockFetch((url) =>
      url.includes('generativelanguage') ? jsonRes({ candidates: [{ finishReason: 'NO_IMAGE' }] }) : imgRes(),
    );
    await expect(geminiProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining('NO_IMAGE'),
    });
  });

  it('401 retryable=false ve anahtarı sızdırmaz', async () => {
    process.env.GEMINI_API_KEY = 'gizli-anahtar-123';
    mockFetch((url) => (url.includes('generativelanguage') ? jsonRes({ error: 'bad' }, 401) : imgRes()));
    try {
      await geminiProvider.generate(baseReq);
      throw new Error('hata bekleniyordu');
    } catch (e) {
      expect(e).toBeInstanceOf(ImageGenError);
      expect(e).toMatchObject({ retryable: false, status: 401 });
      expect((e as Error).message).not.toContain('gizli-anahtar-123');
    }
  });
});
