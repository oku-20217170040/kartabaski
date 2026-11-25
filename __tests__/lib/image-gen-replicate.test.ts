jest.mock('server-only', () => ({}));

import { replicateProvider } from '@/lib/image-gen/providers/replicate';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['REPLICATE_API_TOKEN', 'REPLICATE_IMAGE_MODEL'];
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

describe('replicate adaptörü', () => {
  it('configured ve missingEnv durumları', async () => {
    expect(replicateProvider.configured()).toBe(false);
    expect(replicateProvider.missingEnv()).toEqual(['REPLICATE_API_TOKEN']);
    await expect(replicateProvider.generate(baseReq)).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: false,
    });
    process.env.REPLICATE_API_TOKEN = 'k-rep';
    expect(replicateProvider.configured()).toBe(true);
    expect(replicateProvider.missingEnv()).toEqual([]);
  });

  it('Prefer: wait, input gövdesi, seed ve output URL + mimeType', async () => {
    process.env.REPLICATE_API_TOKEN = 'k-rep';
    const f = mockFetch(() => jsonRes({ status: 'succeeded', output: 'https://rep/out.png' }));
    const r = await replicateProvider.generate({ ...baseReq, seed: 42.9 });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions');
    const h = init!.headers as Record<string, string>;
    expect(h.Prefer).toBe('wait');
    expect(h.Authorization).toBe('Bearer k-rep');
    const body = JSON.parse(init!.body as string);
    expect(body.input).toEqual({
      prompt: 'PROMPT',
      input_image: baseReq.referenceUrls[0],
      aspect_ratio: '4:5',
      output_format: 'png',
      seed: 42,
    });
    expect(r.images).toEqual([{ url: 'https://rep/out.png', mimeType: 'image/png' }]);
    expect(r.model).toBe('black-forest-labs/flux-kontext-pro');
  });

  it('output dizisi ve başarısız/iptal durumları', async () => {
    process.env.REPLICATE_API_TOKEN = 'super-secret-token';
    mockFetch(() => jsonRes({ status: 'succeeded', output: ['https://r/1.png', 'https://r/2.png'] }));
    const res = await replicateProvider.generate(baseReq);
    expect(res.images).toEqual([
      { url: 'https://r/1.png', mimeType: 'image/png' },
      { url: 'https://r/2.png', mimeType: 'image/png' },
    ]);

    mockFetch(() => jsonRes({ status: 'failed', error: 'boom' }));
    await expect(replicateProvider.generate(baseReq)).rejects.toThrow(/başarısız/);

    mockFetch(() => jsonRes({ status: 'canceled' }));
    await expect(replicateProvider.generate(baseReq)).rejects.toBeInstanceOf(ImageGenError);

    mockFetch(() => jsonRes({ status: 'aborted' }));
    await expect(replicateProvider.generate(baseReq)).rejects.toThrow(/başarısız/);

    mockFetch(() => jsonRes({}, 401));
    let caught: unknown;
    try {
      await replicateProvider.generate(baseReq);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ImageGenError);
    expect((caught as Error).message).not.toContain('super-secret-token');
  });

  it('starting/processing durumunda urls.get ile polling yapar', async () => {
    jest.useFakeTimers();
    try {
      process.env.REPLICATE_API_TOKEN = 'k-poll';
      let step = 0;
      const f = mockFetch(() => {
        step++;
        if (step === 1) {
          return jsonRes({ status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }, 201);
        }
        if (step === 2) {
          return jsonRes({ status: 'processing', urls: { get: 'https://api.replicate.com/v1/predictions/p1' } });
        }
        return jsonRes({ status: 'succeeded', output: 'https://rep/final.png' });
      });

      const promise = replicateProvider.generate(baseReq);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      const r = await promise;

      expect(f).toHaveBeenCalledTimes(3);
      expect(String(f.mock.calls[1][0])).toBe('https://api.replicate.com/v1/predictions/p1');
      expect((f.mock.calls[1][1]!.headers as Record<string, string>).Authorization).toBe('Bearer k-poll');
      expect(r.images).toEqual([{ url: 'https://rep/final.png', mimeType: 'image/png' }]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sürümlü model /v1/predictions kullanır', async () => {
    process.env.REPLICATE_API_TOKEN = 'k';
    process.env.REPLICATE_IMAGE_MODEL = 'owner/model:abc123';
    const f = mockFetch(() => jsonRes({ status: 'succeeded', output: ['https://r/1.png'] }));
    await replicateProvider.generate(baseReq);
    expect(String(f.mock.calls[0][0])).toBe('https://api.replicate.com/v1/predictions');
    expect(JSON.parse(f.mock.calls[0][1]!.body as string).version).toBe('abc123');
  });

  it('çoklu referans destekleyen modellerde uygun girdi alanını gönderir', async () => {
    process.env.REPLICATE_API_TOKEN = 'k';
    const f = mockFetch(() => jsonRes({ status: 'succeeded', output: 'https://r/multi.png' }));

    await replicateProvider.generate({ ...baseReq, model: 'flux-kontext-apps/multi-image-kontext-pro' });
    const multiBody = JSON.parse(f.mock.calls[0][1]!.body as string);
    expect(multiBody.input.input_image_1).toBe(baseReq.referenceUrls[0]);
    expect(multiBody.input.input_image_2).toBe(baseReq.referenceUrls[1]);
    expect(multiBody.input.input_image).toBeUndefined();

    await replicateProvider.generate({ ...baseReq, model: 'black-forest-labs/flux-2-pro' });
    const flux2Body = JSON.parse(f.mock.calls[1][1]!.body as string);
    expect(flux2Body.input.input_images).toEqual(baseReq.referenceUrls);

    await replicateProvider.generate({ ...baseReq, model: 'bytedance/seedream-4' });
    const seedreamBody = JSON.parse(f.mock.calls[2][1]!.body as string);
    expect(seedreamBody.input.image_input).toEqual(baseReq.referenceUrls);
    expect(seedreamBody.input.output_format).toBeUndefined();
  });
});
