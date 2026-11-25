jest.mock('server-only', () => ({}));

import { cloudflareProvider } from '@/lib/image-gen/providers/cloudflare';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_IMAGE_MODEL'];
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
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

function imgRes(bytes: number[] = REF_BYTES, contentType = 'image/png') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  };
}

function jsonRes(body: unknown, status = 200, contentType = 'application/json; charset=utf-8') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
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
  prompt: 'STUDIO_PROMPT',
  aspectRatio: '4:5',
};

describe('cloudflare adaptörü', () => {
  it('meta verileri, configured ve missingEnv durumları doğru çalışır', () => {
    expect(cloudflareProvider.id).toBe('cloudflare');
    expect(cloudflareProvider.label).toBe('Cloudflare Workers AI (ücretsiz günlük kota)');
    expect(cloudflareProvider.free).toBe(true);
    expect(cloudflareProvider.defaultModel).toBe('@cf/black-forest-labs/flux-2-klein-4b');

    expect(cloudflareProvider.configured()).toBe(false);
    expect(cloudflareProvider.missingEnv()).toEqual(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']);

    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    expect(cloudflareProvider.configured()).toBe(false);
    expect(cloudflareProvider.missingEnv()).toEqual(['CLOUDFLARE_API_TOKEN']);

    process.env.CLOUDFLARE_API_TOKEN = '   ';
    expect(cloudflareProvider.configured()).toBe(false);
    expect(cloudflareProvider.missingEnv()).toEqual(['CLOUDFLARE_API_TOKEN']);

    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';
    expect(cloudflareProvider.configured()).toBe(true);
    expect(cloudflareProvider.missingEnv()).toEqual([]);
  });

  it('unencoded model yolu, multipart input_image_0..1, seed ve JSON base64 yanıt ayrıştırma', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-123';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-xyz';

    const outB64 = Buffer.from(PNG_BYTES).toString('base64');
    const f = mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: true, result: { image: outB64 }, errors: [], messages: [] })
        : imgRes(REF_BYTES, 'image/jpeg'),
    );

    const r = await cloudflareProvider.generate({ ...baseReq, seed: 42.9 });
    const call = f.mock.calls.find((c) => String(c[0]).includes('api.cloudflare.com'))!;

    expect(String(call[0])).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc-123/ai/run/@cf/black-forest-labs/flux-2-klein-4b',
    );
    expect(String(call[0])).not.toContain('%2F');
    expect(call[1]!.method).toBe('POST');

    const headers = call[1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-xyz');
    expect(headers['Content-Type']).toBeUndefined();

    const form = call[1]!.body as FormData;
    expect(form.get('prompt')).toBe('STUDIO_PROMPT');
    expect(form.get('width')).toBe('768');
    expect(form.get('height')).toBe('960');
    expect(form.get('seed')).toBe('42');
    expect(form.get('steps')).toBeNull();
    expect(form.get('input_image_0')).toBeInstanceOf(Blob);
    expect(form.get('input_image_1')).toBeInstanceOf(Blob);
    expect(form.get('input_image_2')).toBeNull();

    expect(r.model).toBe('@cf/black-forest-labs/flux-2-klein-4b');
    expect(Array.from(r.images[0].data!)).toEqual(PNG_BYTES);
    expect(r.images[0].mimeType).toBe('image/png');
  });

  it('JPEG base64 ve data-URL ön ekli JSON yanıtlarını doğru mimeType ile ayrıştırır', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';

    const jpgB64 = Buffer.from(JPEG_BYTES).toString('base64');
    mockFetch((url) =>
      url.includes('api.cloudflare.com') ? jsonRes({ success: true, result: { image: jpgB64 } }) : imgRes(),
    );
    const r1 = await cloudflareProvider.generate(baseReq);
    expect(r1.images[0].mimeType).toBe('image/jpeg');
    expect(Array.from(r1.images[0].data!)).toEqual(JPEG_BYTES);

    mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: true, result: { image: `data:image/webp;base64,${Buffer.from([1, 2]).toString('base64')}` } })
        : imgRes(),
    );
    const r2 = await cloudflareProvider.generate(baseReq);
    expect(r2.images[0].mimeType).toBe('image/webp');
    expect(Array.from(r2.images[0].data!)).toEqual([1, 2]);
  });

  it('doğrudan image/png veya image/jpeg binary stream yanıtını ayrıştırır', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';

    mockFetch((url) =>
      url.includes('api.cloudflare.com') ? imgRes(JPEG_BYTES, 'image/jpeg; charset=binary') : imgRes(),
    );
    const r = await cloudflareProvider.generate(baseReq);
    expect(r.images[0].mimeType).toBe('image/jpeg');
    expect(Array.from(r.images[0].data!)).toEqual(JPEG_BYTES);

    mockFetch((url) => (url.includes('api.cloudflare.com') ? imgRes([], 'image/png') : imgRes()));
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true });
  });

  it('en fazla 4 referans görseli input_image_0..3 olarak ekler', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';

    const urls = Array.from({ length: 6 }, (_, i) => `https://res.cloudinary.com/x/${i}.png`);
    const f = mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: true, result: { image: Buffer.from(PNG_BYTES).toString('base64') } })
        : imgRes(),
    );

    await cloudflareProvider.generate({ ...baseReq, referenceUrls: urls });
    const call = f.mock.calls.find((c) => String(c[0]).includes('api.cloudflare.com'))!;
    const form = call[1]!.body as FormData;

    expect(form.get('input_image_0')).not.toBeNull();
    expect(form.get('input_image_1')).not.toBeNull();
    expect(form.get('input_image_2')).not.toBeNull();
    expect(form.get('input_image_3')).not.toBeNull();
    expect(form.get('input_image_4')).toBeNull();
    // 4 referans fetch + 1 Cloudflare API fetch = 5 toplam fetch çağrısı
    expect(f).toHaveBeenCalledTimes(5);
  });

  it('1:1, 4:5, 3:4 ve 16:9 en-boy oranlarını geçerli width/height değerlerine eşler', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';

    const f = mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: true, result: { image: Buffer.from(PNG_BYTES).toString('base64') } })
        : imgRes(),
    );

    await cloudflareProvider.generate({ ...baseReq, aspectRatio: '1:1' });
    await cloudflareProvider.generate({ ...baseReq, aspectRatio: '4:5' });
    await cloudflareProvider.generate({ ...baseReq, aspectRatio: '3:4' });
    await cloudflareProvider.generate({ ...baseReq, aspectRatio: '16:9' });

    const forms = f.mock.calls
      .filter((c) => String(c[0]).includes('api.cloudflare.com'))
      .map((c) => c[1]!.body as FormData);

    expect(forms.map((x) => `${x.get('width')}x${x.get('height')}`)).toEqual([
      '1024x1024',
      '768x960',
      '768x1024',
      '1024x576',
    ]);
  });

  it('CLOUDFLARE_IMAGE_MODEL ve req.model ile model değiştirilebilir', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';
    process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-dev';

    const f = mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: true, result: { image: Buffer.from(PNG_BYTES).toString('base64') } })
        : imgRes(),
    );

    const r1 = await cloudflareProvider.generate(baseReq);
    expect(r1.model).toBe('@cf/black-forest-labs/flux-2-dev');

    const r2 = await cloudflareProvider.generate({
      ...baseReq,
      model: '/@cf/black-forest-labs/flux-2-klein-9b',
    });
    expect(r2.model).toBe('@cf/black-forest-labs/flux-2-klein-9b');

    const urls = f.mock.calls.filter((c) => String(c[0]).includes('api.cloudflare.com')).map((c) => String(c[0]));
    expect(urls[0]).toMatch(/\/ai\/run\/@cf\/black-forest-labs\/flux-2-dev$/);
    expect(urls[1]).toMatch(/\/ai\/run\/@cf\/black-forest-labs\/flux-2-klein-9b$/);
  });

  it('eksik env, boş referans, success=false, boş görsel ve bozuk JSON durumlarında Türkçe ImageGenError fırlatır', async () => {
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: false,
    });

    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.CLOUDFLARE_API_TOKEN = 'tok-1';

    await expect(cloudflareProvider.generate({ ...baseReq, referenceUrls: [] })).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: false,
    });

    mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? jsonRes({ success: false, errors: [{ code: 1000, message: 'Daily neuron limit reached' }] })
        : imgRes(),
    );
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining('Daily neuron limit reached'),
    });

    mockFetch((url) =>
      url.includes('api.cloudflare.com') ? jsonRes({ success: true, result: { image: '' } }) : imgRes(),
    );
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true });

    mockFetch((url) =>
      url.includes('api.cloudflare.com')
        ? {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => {
              throw new SyntaxError('bad json');
            },
          }
        : imgRes(),
    );
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true });
  });

  it('HTTP 401 ve 429 hatalarında token veya accountId sızdırmaz', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'gizli-hesap-999';
    process.env.CLOUDFLARE_API_TOKEN = 'gizli-token-777';

    mockFetch((url) => (url.includes('api.cloudflare.com') ? jsonRes({ success: false }, 401) : imgRes()));
    try {
      await cloudflareProvider.generate(baseReq);
      throw new Error('hata bekleniyordu');
    } catch (e) {
      expect(e).toBeInstanceOf(ImageGenError);
      expect(e).toMatchObject({ retryable: false, status: 401 });
      expect((e as Error).message).not.toContain('gizli-token-777');
      expect((e as Error).message).not.toContain('gizli-hesap-999');
    }

    mockFetch((url) => (url.includes('api.cloudflare.com') ? jsonRes({ success: false }, 429) : imgRes()));
    await expect(cloudflareProvider.generate(baseReq)).rejects.toMatchObject({ retryable: true, status: 429 });
  });
});
