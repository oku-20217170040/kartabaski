jest.mock('server-only', () => ({}));

import { huggingfaceProvider } from '@/lib/image-gen/providers/huggingface';
import { ImageGenError } from '@/lib/image-gen/types';
import type { GenerateRequest } from '@/lib/image-gen/types';

const ENV_KEYS = ['HF_TOKEN', 'HF_FREE_ANON', 'HF_IMAGE_SPACE'];
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

const REF_BYTES = [10, 20, 30, 40];
const OUT_BYTES = [99, 88, 77, 66];

const baseReq: GenerateRequest = {
  referenceUrls: [
    'https://res.cloudinary.com/demo/image/upload/product-a.png',
    'https://res.cloudinary.com/demo/image/upload/product-b.jpg',
  ],
  prompt: 'Luxury studio product photography on marble table',
  aspectRatio: '4:5',
  seed: 1234,
};

function imgRes(bytes: number[], contentType = 'image/png') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  };
}

function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textRes(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'text/plain' },
    text: async () => body,
  };
}

function sseStreamRes(chunks: string[]) {
  let idx = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: {
      getReader: () => ({
        read: async () => {
          if (idx >= chunks.length) {
            return { done: true, value: undefined };
          }
          const chunk = chunks[idx++];
          return { done: false, value: new Uint8Array(Buffer.from(chunk, 'utf8')) };
        },
        releaseLock: () => undefined,
      }),
    },
  };
}

function sseTextRes(body: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: null,
    text: async () => body,
  };
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const qwenInfoPayload = {
  named_endpoints: {
    '/infer': {
      parameters: [
        { parameter_name: 'images', component: 'Gallery' },
        { parameter_name: 'prompt', component: 'Textbox', python_type: { type: 'str' } },
        { parameter_name: 'seed', component: 'Slider', parameter_has_default: true, parameter_default: 0 },
        { parameter_name: 'randomize_seed', component: 'Checkbox', parameter_has_default: true, parameter_default: true },
        { parameter_name: 'true_guidance_scale', component: 'Slider', parameter_has_default: true, parameter_default: 1.0 },
        { parameter_name: 'num_inference_steps', component: 'Slider', parameter_has_default: true, parameter_default: 40 },
        { parameter_name: 'height', component: 'Slider', parameter_has_default: true, parameter_default: 1024, type: { minimum: 256, maximum: 2048 } },
        { parameter_name: 'width', component: 'Slider', parameter_has_default: true, parameter_default: 1024, type: { minimum: 256, maximum: 2048 } },
        { parameter_name: 'rewrite_prompt', component: 'Checkbox', parameter_has_default: true, parameter_default: true },
      ],
    },
  },
};

describe('huggingfaceProvider yapılandırma ve sözleşme', () => {
  it('sağlayıcı kimliği, etiketi ve ücretsiz rozeti doğru', () => {
    expect(huggingfaceProvider.id).toBe('huggingface');
    expect(huggingfaceProvider.label).toBe('Hugging Face ZeroGPU (ücretsiz)');
    expect(huggingfaceProvider.free).toBe(true);
    expect(huggingfaceProvider.defaultModel).toBe('black-forest-labs/FLUX.1-Kontext-Dev');
  });

  it('ne HF_TOKEN ne HF_FREE_ANON varsa yapılandırılmamış görünür', async () => {
    expect(huggingfaceProvider.configured()).toBe(false);
    expect(huggingfaceProvider.missingEnv()).toEqual(['HF_TOKEN']);
    await expect(huggingfaceProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('HF_TOKEN tanımlıysa yapılandırılmış olur', () => {
    process.env.HF_TOKEN = 'hf_test_token';
    expect(huggingfaceProvider.configured()).toBe(true);
    expect(huggingfaceProvider.missingEnv()).toEqual([]);
  });

  it('HF_FREE_ANON=1 iken HF_TOKEN olmadan da yapılandırılmış olur', () => {
    process.env.HF_FREE_ANON = '1';
    expect(huggingfaceProvider.configured()).toBe(true);
    expect(huggingfaceProvider.missingEnv()).toEqual([]);
  });

  it('boş referenceUrls ile non-retryable ImageGenError fırlatır', async () => {
    process.env.HF_FREE_ANON = '1';
    await expect(
      huggingfaceProvider.generate({ ...baseReq, referenceUrls: [] }),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe('huggingfaceProvider Gradio REST + SSE akışı', () => {
  it('Qwen-Image-Edit-2509 dinamik /gradio_api/info, upload, call ve akışlı SSE ile görsel üretir', async () => {
    process.env.HF_TOKEN = 'hf_secret_123';
    const calls: { url: string; headers?: HeadersInit; body?: unknown }[] = [];

    mockFetch((url, init) => {
      calls.push({ url, headers: init?.headers, body: init?.body });
      if (url.startsWith('https://res.cloudinary.com/')) {
        return imgRes(REF_BYTES, url.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      }
      if (url === 'https://qwen-qwen-image-edit-2509.hf.space/gradio_api/info') {
        return jsonRes(qwenInfoPayload);
      }
      if (url === 'https://qwen-qwen-image-edit-2509.hf.space/gradio_api/upload') {
        return jsonRes(['/tmp/gradio/abc/ref-0.png', '/tmp/gradio/abc/ref-1.jpg']);
      }
      if (url === 'https://qwen-qwen-image-edit-2509.hf.space/gradio_api/call/infer') {
        return jsonRes({ event_id: 'evt-99' });
      }
      if (url === 'https://qwen-qwen-image-edit-2509.hf.space/gradio_api/call/infer/evt-99') {
        return sseStreamRes([
          'event: heartbeat\ndata: null\n\n',
          'event: generating\ndata: {"progress": 0.5}\n\n',
          'event: complete\n',
          'data: [[{"image":{"url":"https://qwen-qwen-image-edit-2509.hf.space/gradio_api/file=/tmp/gradio/out.webp","mime_type":"image/webp"},"caption":null}], 1234]\n\n',
        ]);
      }
      if (url === 'https://qwen-qwen-image-edit-2509.hf.space/gradio_api/file=/tmp/gradio/out.webp') {
        return imgRes(OUT_BYTES, 'image/webp');
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    const result = await huggingfaceProvider.generate({
      ...baseReq,
      model: 'Qwen/Qwen-Image-Edit-2509',
    });

    expect(result.model).toBe('Qwen/Qwen-Image-Edit-2509');
    expect(result.costUsd).toBe(0);
    expect(result.images).toHaveLength(1);
    expect(Array.from(result.images[0].data!)).toEqual(OUT_BYTES);
    expect(result.images[0].mimeType).toBe('image/webp');

    // Referans görsellerine HF_TOKEN gönderilmemeli
    const cloudinaryCalls = calls.filter((c) => c.url.startsWith('https://res.cloudinary.com/'));
    expect(cloudinaryCalls).toHaveLength(2);
    for (const c of cloudinaryCalls) {
      expect(JSON.stringify(c.headers ?? {})).not.toContain('hf_secret_123');
    }

    // HF Space isteklerinde Bearer token gönderilmeli
    const infoCall = calls.find((c) => c.url.endsWith('/gradio_api/info'));
    expect((infoCall?.headers as Record<string, string>)?.Authorization).toBe('Bearer hf_secret_123');

    // Call payload'ı Gallery FileData (yalnız path, url olmadan) ve rewrite_prompt=false içermeli
    const callReq = calls.find((c) => c.url.endsWith('/gradio_api/call/infer'));
    const parsedBody = JSON.parse(String(callReq?.body)) as { data: unknown[] };
    expect(parsedBody.data).toEqual([
      [
        {
          image: {
            path: '/tmp/gradio/abc/ref-0.png',
            orig_name: 'ref-0.png',
            mime_type: 'image/png',
            meta: { _type: 'gradio.FileData' },
          },
          caption: null,
        },
        {
          image: {
            path: '/tmp/gradio/abc/ref-1.jpg',
            orig_name: 'ref-1.jpg',
            mime_type: 'image/jpeg',
            meta: { _type: 'gradio.FileData' },
          },
          caption: null,
        },
      ],
      baseReq.prompt,
      1234,
      false,
      1.0,
      40,
      1120,
      896,
      false,
    ]);
  });

  it('HF_FREE_ANON=1 iken Authorization başlığı olmadan ve 404 /info fallback ile FLUX.1-Kontext-Dev çalıştırır', async () => {
    process.env.HF_FREE_ANON = '1';
    process.env.HF_IMAGE_SPACE = 'black-forest-labs/FLUX.1-Kontext-Dev';
    const calls: { url: string; headers?: HeadersInit; body?: unknown }[] = [];

    mockFetch((url, init) => {
      calls.push({ url, headers: init?.headers, body: init?.body });
      if (url.startsWith('https://res.cloudinary.com/')) {
        return imgRes(REF_BYTES, url.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      }
      if (url === 'https://black-forest-labs-flux-1-kontext-dev.hf.space/gradio_api/info') {
        return textRes('Not Found', 404);
      }
      if (url === 'https://black-forest-labs-flux-1-kontext-dev.hf.space/gradio_api/upload') {
        return jsonRes(['/tmp/gradio/kontext/ref-0.png']);
      }
      if (url === 'https://black-forest-labs-flux-1-kontext-dev.hf.space/gradio_api/call/infer') {
        return jsonRes({ event_id: 'evt-k1' });
      }
      if (url === 'https://black-forest-labs-flux-1-kontext-dev.hf.space/gradio_api/call/infer/evt-k1') {
        return sseTextRes('event: complete\ndata: [{"path":"/tmp/gradio/kontext/out.png"}, 99]\n\n');
      }
      if (url === 'https://black-forest-labs-flux-1-kontext-dev.hf.space/gradio_api/file=/tmp/gradio/kontext/out.png') {
        return imgRes(OUT_BYTES, 'image/png');
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    const result = await huggingfaceProvider.generate({
      referenceUrls: [baseReq.referenceUrls[0], baseReq.referenceUrls[1]],
      prompt: 'Studio backdrop',
      aspectRatio: '1:1',
    });

    expect(result.model).toBe('black-forest-labs/FLUX.1-Kontext-Dev');
    expect(Array.from(result.images[0].data!)).toEqual(OUT_BYTES);

    // Yalnızca 1 referans indirilmeli (Kontext tek görsel alır)
    expect(calls.filter((c) => c.url.startsWith('https://res.cloudinary.com/'))).toHaveLength(1);
    for (const c of calls) {
      expect((c.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
    }

    const callReq = calls.find((c) => c.url.endsWith('/gradio_api/call/infer'));
    const parsedBody = JSON.parse(String(callReq?.body)) as { data: unknown[] };
    expect(parsedBody.data).toEqual([
      {
        path: '/tmp/gradio/kontext/ref-0.png',
        orig_name: 'ref-0.png',
        mime_type: 'image/png',
        meta: { _type: 'gradio.FileData' },
      },
      'Studio backdrop',
      42,
      true,
      2.5,
      28,
    ]);
  });

  it('alt çizgi, nokta ve tam HF Space URL biçimlerini doğru host adresine çevirir', async () => {
    process.env.HF_FREE_ANON = '1';
    const seenUrls: string[] = [];

    mockFetch((url) => {
      seenUrls.push(url);
      if (url.startsWith('https://res.cloudinary.com/')) return imgRes(REF_BYTES);
      if (url.endsWith('/gradio_api/info')) return textRes('Not Found', 404);
      if (url.endsWith('/gradio_api/upload')) return jsonRes(['/tmp/a.png']);
      if (url.endsWith('/gradio_api/call/infer')) return jsonRes({ event_id: 'e1' });
      if (url.endsWith('/gradio_api/call/infer/e1')) {
        return sseTextRes('event: complete\ndata: [{"path":"/tmp/out.png"}]\n\n');
      }
      if (url.includes('/gradio_api/file=/tmp/out.png')) return imgRes(OUT_BYTES);
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    await huggingfaceProvider.generate({
      ...baseReq,
      model: 'My_Org/Space.Name_v2',
    });
    expect(seenUrls).toContain('https://my-org-space-name-v2.hf.space/gradio_api/upload');

    seenUrls.length = 0;
    await huggingfaceProvider.generate({
      ...baseReq,
      model: 'https://huggingface.co/spaces/Qwen/Qwen-Image-Edit',
    });
    expect(seenUrls).toContain('https://qwen-qwen-image-edit.hf.space/gradio_api/upload');

    seenUrls.length = 0;
    await huggingfaceProvider.generate({
      ...baseReq,
      model: 'https://custom-host.hf.space/',
    });
    expect(seenUrls).toContain('https://custom-host.hf.space/gradio_api/upload');
  });
});

describe('huggingfaceProvider hatalar ve güvenlik', () => {
  it('SSE ZeroGPU kota hatasını retryable=true Türkçe ImageGenError olarak döndürür', async () => {
    process.env.HF_FREE_ANON = '1';
    mockFetch((url) => {
      if (url.startsWith('https://res.cloudinary.com/')) return imgRes(REF_BYTES);
      if (url.endsWith('/gradio_api/info')) return textRes('Not Found', 404);
      if (url.endsWith('/gradio_api/upload')) return jsonRes(['/tmp/a.png']);
      if (url.endsWith('/gradio_api/call/infer')) return jsonRes({ event_id: 'e1' });
      if (url.endsWith('/gradio_api/call/infer/e1')) {
        return sseTextRes('event: error\ndata: "You have exceeded your GPU quota (60s left)"\n\n');
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    await expect(huggingfaceProvider.generate(baseReq)).rejects.toMatchObject({
      name: 'ImageGenError',
      retryable: true,
    });
    await expect(huggingfaceProvider.generate(baseReq)).rejects.toThrow(/ZeroGPU kotası/);
  });

  it('HTTP 401 hatasında retryable=false fırlatır ve HF_TOKEN değerini asla sızdırmaz', async () => {
    process.env.HF_TOKEN = 'hf_super_secret_token_999';
    mockFetch((url) => {
      if (url.endsWith('/gradio_api/info')) {
        return textRes('Unauthorized token hf_super_secret_token_999', 401);
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    let caught: unknown;
    try {
      await huggingfaceProvider.generate(baseReq);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ImageGenError);
    expect((caught as ImageGenError).retryable).toBe(false);
    expect((caught as ImageGenError).status).toBe(401);
    expect((caught as ImageGenError).message).not.toContain('hf_super_secret_token_999');
  });

  it('SSE event: error + data: null durumunda (null) yazmaz, anlamlı Türkçe hata döndürür', async () => {
    process.env.HF_FREE_ANON = '1';
    mockFetch((url) => {
      if (url.startsWith('https://res.cloudinary.com/')) return imgRes(REF_BYTES);
      if (url.endsWith('/gradio_api/info')) return textRes('Not Found', 404);
      if (url.endsWith('/gradio_api/upload')) return jsonRes(['/tmp/a.png']);
      if (url.endsWith('/gradio_api/call/infer')) return jsonRes({ event_id: 'e1' });
      if (url.endsWith('/gradio_api/call/infer/e1')) {
        return sseTextRes('event: error\ndata: null\n\n');
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    let caught: unknown;
    try {
      await huggingfaceProvider.generate(baseReq);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ImageGenError);
    expect((caught as ImageGenError).retryable).toBe(true);
    expect((caught as ImageGenError).message).not.toContain('(null)');
    expect((caught as ImageGenError).message).toContain('HF_TOKEN gerekebilir');
  });

  it('SSE akışı complete olmadan kesilirse retryable=true hata fırlatır', async () => {
    process.env.HF_FREE_ANON = '1';
    mockFetch((url) => {
      if (url.startsWith('https://res.cloudinary.com/')) return imgRes(REF_BYTES);
      if (url.endsWith('/gradio_api/info')) return textRes('Not Found', 404);
      if (url.endsWith('/gradio_api/upload')) return jsonRes(['/tmp/a.png']);
      if (url.endsWith('/gradio_api/call/infer')) return jsonRes({ event_id: 'e1' });
      if (url.endsWith('/gradio_api/call/infer/e1')) {
        return sseStreamRes(['event: heartbeat\ndata: null\n\n']);
      }
      throw new Error(`Beklenmeyen URL: ${url}`);
    });

    await expect(huggingfaceProvider.generate(baseReq)).rejects.toMatchObject({
      retryable: true,
    });
  });
});
