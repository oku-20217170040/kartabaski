jest.mock('server-only', () => ({}));

import { falProvider } from '@/lib/image-gen/providers/fal';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['FAL_KEY', 'FAL_IMAGE_MODEL'];
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

describe('fal adaptörü', () => {
  it('FAL_KEY eksikse configured()=false ve hata fırlatır', async () => {
    expect(falProvider.configured()).toBe(false);
    expect(falProvider.missingEnv()).toEqual(['FAL_KEY']);
    await expect(falProvider.generate(baseReq)).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: false,
    });
  });

  it('referans görsel yoksa istek atmadan hata fırlatır', async () => {
    process.env.FAL_KEY = 'k-fal';
    const f = mockFetch(() => jsonRes({}));
    await expect(falProvider.generate({ ...baseReq, referenceUrls: [] })).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: false,
    });
    expect(f).not.toHaveBeenCalled();
  });

  it('seedream gövdesinde yalnız image_urls, image_size ve images[].url kullanır', async () => {
    process.env.FAL_KEY = 'k-fal';
    const f = mockFetch(() => jsonRes({ images: [{ url: 'https://fal/out.png', content_type: 'image/png' }] }));
    const r = await falProvider.generate({ ...baseReq, seed: 42 });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://fal.run/fal-ai/bytedance/seedream/v4/edit');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Key k-fal');
    const body = JSON.parse(init!.body as string);
    expect(body.prompt).toBe('PROMPT');
    expect(body.image_urls).toEqual(baseReq.referenceUrls);
    expect(body.image_url).toBeUndefined();
    expect(body.image_size).toEqual({ width: 1638, height: 2048 });
    expect(body.aspect_ratio).toBeUndefined();
    expect(body.num_images).toBe(1);
    expect(body.seed).toBe(42);
    expect(r.images).toEqual([{ url: 'https://fal/out.png', mimeType: 'image/png' }]);
  });

  it('seedream en fazla 10 referans görsel gönderir', async () => {
    process.env.FAL_KEY = 'k-fal';
    const refs = Array.from({ length: 12 }, (_, i) => `https://res.cloudinary.com/x/${i}.png`);
    const f = mockFetch(() => jsonRes({ images: [{ url: 'https://fal/out.png' }] }));
    await falProvider.generate({ ...baseReq, referenceUrls: refs });
    const body = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(body.image_urls).toHaveLength(10);
    expect(body.image_urls[0]).toBe('https://res.cloudinary.com/x/0.png');
  });

  it('tekli kontext modelinde yalnız image_url kullanır ve 4:5 oranını 3:4 olarak eşler', async () => {
    process.env.FAL_KEY = 'k';
    process.env.FAL_IMAGE_MODEL = 'fal-ai/flux-pro/kontext';
    const f = mockFetch(() => jsonRes({ images: [{ url: 'https://fal/o.png' }] }));
    const r = await falProvider.generate(baseReq);
    expect(String(f.mock.calls[0][0])).toBe('https://fal.run/fal-ai/flux-pro/kontext');
    const body = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(body.image_url).toBe(baseReq.referenceUrls[0]);
    expect(body.image_urls).toBeUndefined();
    expect(body.aspect_ratio).toBe('3:4');
    expect(body.image_size).toBeUndefined();
    expect(r.model).toBe('fal-ai/flux-pro/kontext');
  });

  it('çoklu kontext/max/multi modelinde yalnız image_urls ve geçerli aspect_ratio kullanır', async () => {
    process.env.FAL_KEY = 'k';
    const f = mockFetch(() => jsonRes({ image: { url: 'https://fal/single.jpg', content_type: 'image/jpeg' } }));
    const r = await falProvider.generate({
      ...baseReq,
      aspectRatio: '16:9',
      model: 'fal-ai/flux-pro/kontext/max/multi',
    });
    expect(String(f.mock.calls[0][0])).toBe('https://fal.run/fal-ai/flux-pro/kontext/max/multi');
    const body = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(body.image_urls).toEqual(baseReq.referenceUrls);
    expect(body.image_url).toBeUndefined();
    expect(body.aspect_ratio).toBe('16:9');
    expect(r.images).toEqual([{ url: 'https://fal/single.jpg', mimeType: 'image/jpeg' }]);
  });

  it('429 retryable, 401 non-retryable ve anahtarı sızdırmaz', async () => {
    process.env.FAL_KEY = 'super-secret-fal-key';
    mockFetch(() => jsonRes({}, 429));
    await expect(falProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true, status: 429 });

    mockFetch(() => jsonRes({ detail: 'Unauthorized' }, 401));
    await expect(falProvider.generate(baseReq)).rejects.toMatchObject({ retryable: false, status: 401 });
    try {
      await falProvider.generate(baseReq);
    } catch (err) {
      expect((err as Error).message).not.toContain('super-secret-fal-key');
    }
  });

  it('görsel dönmezse retryable ImageGenError fırlatır', async () => {
    process.env.FAL_KEY = 'k';
    mockFetch(() => jsonRes({ images: [] }));
    await expect(falProvider.generate(baseReq)).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: true,
    });
  });
});
