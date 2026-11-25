jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(async () => ({ data: () => ({}) })),
        set: jest.fn(async () => {}),
      })),
    })),
  },
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: jest.fn() } }));

import { buildPhotoroomRequestUrl, PHOTOROOM_API_ENDPOINT, getResolvedApiKey, getPhotoroomKeyStatus } from '@/lib/photoroom';

describe('Photoroom API Utility', () => {
  const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

  it('bokeh portre modu parametrelerini üretir', () => {
    const url = new URL(buildPhotoroomRequestUrl(sampleImageUrl, { mode: 'bokeh', blurRadius: 0.02 }));
    expect(url.origin + url.pathname).toBe(PHOTOROOM_API_ENDPOINT);
    expect(url.searchParams.get('imageUrl')).toBe(sampleImageUrl);
    expect(url.searchParams.get('removeBackground')).toBe('false');
    expect(url.searchParams.get('background.blur.mode')).toBe('bokeh');
    expect(url.searchParams.get('background.blur.radius')).toBe('0.02');
    expect(url.searchParams.get('export.format')).toBe('jpeg');
  });

  it('bulanıklık yarıçapını 0.005 - 0.05 arasına sıkıştırır', () => {
    const low = new URL(buildPhotoroomRequestUrl(sampleImageUrl, { mode: 'bokeh', blurRadius: 0.001 }));
    expect(low.searchParams.get('background.blur.radius')).toBe('0.005');
    const high = new URL(buildPhotoroomRequestUrl(sampleImageUrl, { mode: 'bokeh', blurRadius: 0.1 }));
    expect(high.searchParams.get('background.blur.radius')).toBe('0.05');
  });

  it('sahne (studio_staging) modunda prompt ve gölge ekler', () => {
    const url = new URL(
      buildPhotoroomRequestUrl(sampleImageUrl, { mode: 'studio_staging', shadowMode: 'ai.soft', prompt: 'warm wooden table with coffee beans' })
    );
    expect(url.searchParams.get('removeBackground')).toBe('true');
    expect(url.searchParams.get('shadow.mode')).toBe('ai.soft');
    expect(url.searchParams.get('background.prompt')).toBe('warm wooden table with coffee beans');
  });

  it('temiz beyaz arka plan üretir', () => {
    const url = new URL(buildPhotoroomRequestUrl(sampleImageUrl, { mode: 'clean_white' }));
    expect(url.searchParams.get('removeBackground')).toBe('true');
    expect(url.searchParams.get('background.color')).toBe('FFFFFF');
    expect(url.searchParams.get('shadow.mode')).toBe('ai.soft');
  });

  it('anahtarlar yalnızca ortam değişkeninden okunur; yoksa bağlı değil', () => {
    const live = process.env.PHOTOROOM_LIVE_API_KEY;
    const sandbox = process.env.PHOTOROOM_SANDBOX_API_KEY;
    delete process.env.PHOTOROOM_LIVE_API_KEY;
    delete process.env.PHOTOROOM_SANDBOX_API_KEY;
    expect(getResolvedApiKey('live')).toBe('');
    expect(getPhotoroomKeyStatus()).toEqual({ live: false, sandbox: false });
    process.env.PHOTOROOM_SANDBOX_API_KEY = 'x';
    expect(getPhotoroomKeyStatus()).toEqual({ live: false, sandbox: true });
    if (live !== undefined) process.env.PHOTOROOM_LIVE_API_KEY = live; else delete process.env.PHOTOROOM_LIVE_API_KEY;
    if (sandbox !== undefined) process.env.PHOTOROOM_SANDBOX_API_KEY = sandbox; else delete process.env.PHOTOROOM_SANDBOX_API_KEY;
  });
});
