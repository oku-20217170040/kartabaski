jest.mock('server-only', () => ({}));

import { openaiProvider } from '@/lib/image-gen/providers/openai';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['OPENAI_API_KEY', 'OPENAI_IMAGE_MODEL'];
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

describe('openai adaptörü', () => {
  it('configured ve missingEnv durumları anahtar sızdırmaz', () => {
    expect(openaiProvider.id).toBe('openai');
    expect(openaiProvider.defaultModel).toBe('gpt-image-1');
    expect(openaiProvider.free).toBe(false);
    expect(openaiProvider.configured()).toBe(false);
    expect(openaiProvider.missingEnv()).toEqual(['OPENAI_API_KEY']);

    process.env.OPENAI_API_KEY = 'sk-secret-key';
    expect(openaiProvider.configured()).toBe(true);
    expect(openaiProvider.missingEnv()).toEqual([]);
  });

  it('multipart image[], input_fidelity=high, output_format=png ve b64_json ayrıştırma (response_format/seed yok)', async () => {
    process.env.OPENAI_API_KEY = 'k-oa';
    const out = Buffer.from([5, 6]).toString('base64');
    const f = mockFetch((url) =>
      url.includes('api.openai.com') ? jsonRes({ output_format: 'png', data: [{ b64_json: out }] }) : imgRes('image/png'),
    );
    const r = await openaiProvider.generate({ ...baseReq, seed: 42 });
    const call = f.mock.calls.find((c) => String(c[0]).includes('api.openai.com'))!;
    expect(String(call[0])).toBe('https://api.openai.com/v1/images/edits');
    expect(call[1]!.method).toBe('POST');
    expect((call[1]!.headers as Record<string, string>).Authorization).toBe('Bearer k-oa');
    const form = call[1]!.body as FormData;
    expect(form.get('model')).toBe('gpt-image-1');
    expect(form.get('prompt')).toBe('PROMPT');
    expect(form.get('size')).toBe('1024x1536');
    expect(form.get('n')).toBe('1');
    expect(form.get('output_format')).toBe('png');
    expect(form.get('input_fidelity')).toBe('high');
    expect(form.get('response_format')).toBeNull();
    expect(form.get('seed')).toBeNull();
    expect(form.getAll('image[]')).toHaveLength(2);
    expect(Array.from(r.images[0].data!)).toEqual([5, 6]);
    expect(r.images[0].mimeType).toBe('image/png');
    expect(r.model).toBe('gpt-image-1');
  });

  it('tekli görselde de image[] alanını kullanır', async () => {
    process.env.OPENAI_API_KEY = 'k-oa';
    const f = mockFetch((url) => (url.includes('api.openai.com') ? jsonRes({ data: [{ b64_json: 'AQ==' }] }) : imgRes()));
    await openaiProvider.generate({ ...baseReq, referenceUrls: ['https://res.cloudinary.com/x/only.png'] });
    const call = f.mock.calls.find((c) => String(c[0]).includes('api.openai.com'))!;
    const form = call[1]!.body as FormData;
    expect(form.getAll('image[]')).toHaveLength(1);
    expect(form.get('image')).toBeNull();
  });

  it('1:1, 4:5, 3:4 ve 16:9 boyut eşlemesi', async () => {
    process.env.OPENAI_API_KEY = 'k';
    const f = mockFetch((url) => (url.includes('api.openai.com') ? jsonRes({ data: [{ b64_json: 'AQ==' }] }) : imgRes()));
    await openaiProvider.generate({ ...baseReq, aspectRatio: '16:9' });
    await openaiProvider.generate({ ...baseReq, aspectRatio: '1:1' });
    await openaiProvider.generate({ ...baseReq, aspectRatio: '3:4' });
    await openaiProvider.generate({ ...baseReq, aspectRatio: '4:5' });
    const forms = f.mock.calls.filter((c) => String(c[0]).includes('api.openai.com')).map((c) => c[1]!.body as FormData);
    expect(forms.map((x) => x.get('size'))).toEqual(['1536x1024', '1024x1024', '1024x1536', '1024x1536']);
  });

  it('OPENAI_IMAGE_MODEL geçersiz kılmasında gpt-image-1.5 input_fidelity gönderir, gpt-image-2.5-sunburst göndermez', async () => {
    process.env.OPENAI_API_KEY = 'k';
    const f = mockFetch((url) => (url.includes('api.openai.com') ? jsonRes({ data: [{ b64_json: 'AQ==' }] }) : imgRes()));
    process.env.OPENAI_IMAGE_MODEL = 'gpt-image-1.5';
    await openaiProvider.generate(baseReq);
    process.env.OPENAI_IMAGE_MODEL = 'gpt-image-2.5-sunburst';
    await openaiProvider.generate(baseReq);
    const forms = f.mock.calls.filter((c) => String(c[0]).includes('api.openai.com')).map((c) => c[1]!.body as FormData);
    expect(forms[0].get('input_fidelity')).toBe('high');
    expect(forms[1].get('input_fidelity')).toBeNull();
    expect(forms[1].get('output_format')).toBe('png');
  });

  it('yanıttaki output_format mimeType olarak eşlenir ve url fallback desteklenir', async () => {
    process.env.OPENAI_API_KEY = 'k';
    mockFetch((url) =>
      url.includes('api.openai.com')
        ? jsonRes({ output_format: 'webp', data: [{ b64_json: 'AQ==' }, { url: 'https://cdn.example/out.webp' }] })
        : imgRes(),
    );
    const r = await openaiProvider.generate(baseReq);
    expect(r.images[0].mimeType).toBe('image/webp');
    expect(r.images[1]).toEqual({ url: 'https://cdn.example/out.webp', mimeType: 'image/webp' });
  });

  it('eksik anahtar, boş referans, >16 referans ve boş yanıt hata fırlatır', async () => {
    await expect(openaiProvider.generate(baseReq)).rejects.toThrow(ImageGenError);

    process.env.OPENAI_API_KEY = 'secret-never-leak';
    await expect(openaiProvider.generate({ ...baseReq, referenceUrls: [] })).rejects.toMatchObject({ retryable: false });
    const tooMany = Array.from({ length: 17 }, (_, i) => `https://res.cloudinary.com/x/${i}.png`);
    await expect(openaiProvider.generate({ ...baseReq, referenceUrls: tooMany })).rejects.toMatchObject({ retryable: false });

    mockFetch((url) => (url.includes('api.openai.com') ? jsonRes({ data: [] }) : imgRes()));
    await expect(openaiProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true });

    mockFetch((url) => (url.includes('api.openai.com') ? jsonRes({ error: { message: 'bad' } }, 401) : imgRes()));
    await expect(openaiProvider.generate(baseReq)).rejects.toMatchObject({ retryable: false, status: 401 });
  });
});
