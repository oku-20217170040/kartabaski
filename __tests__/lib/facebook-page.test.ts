import {
  getFacebookConfig, buildPhotoParams, buildFeedParams, buildLinkParams, publishLinkToFacebookPage,
} from '@/lib/facebook-page';

describe('sayfa belirteci', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  const run = async (pageResponse: Record<string, unknown>) => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pageResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    await publishLinkToFacebookPage('Mesaj', 'https://x', { pageId: '123', token: 'sistem' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('fields=access_token');
    return (fetchMock.mock.calls[1][1].body as URLSearchParams).get('access_token');
  };

  it('gönderi, sayfadan alınan belirteçle yazılır', async () => {
    expect(await run({ access_token: 'sayfa', id: '123' })).toBe('sayfa');
  });
  it('sayfa belirteci dönmezse env belirteci kullanılır', async () => {
    expect(await run({ id: '123' })).toBe('sistem');
  });
});

describe('getFacebookConfig', () => {
  it('iki değişken de varsa yapılandırmayı döndürür', () => {
    expect(getFacebookConfig({ FACEBOOK_PAGE_ID: ' 123 ', FACEBOOK_PAGE_ACCESS_TOKEN: ' tok ' })).toEqual({ pageId: '123', token: 'tok' });
  });
  it('biri eksikse null (bağlı değil)', () => {
    expect(getFacebookConfig({ FACEBOOK_PAGE_ID: '123' })).toBeNull();
    expect(getFacebookConfig({ FACEBOOK_PAGE_ACCESS_TOKEN: 'tok' })).toBeNull();
    expect(getFacebookConfig({})).toBeNull();
  });
});

describe('buildPhotoParams', () => {
  it('görsel adresi, açıklama ve yayın durumunu yazar', () => {
    const p = buildPhotoParams('https://img/x.jpg', 'Açıklama', 'tok', true);
    expect(p.get('url')).toBe('https://img/x.jpg');
    expect(p.get('caption')).toBe('Açıklama');
    expect(p.get('published')).toBe('true');
    expect(p.get('access_token')).toBe('tok');
  });
  it('açıklama boşsa caption eklenmez; yayınlanmamış fotoğraf', () => {
    const p = buildPhotoParams('https://img/x.jpg', '', 'tok', false);
    expect(p.has('caption')).toBe(false);
    expect(p.get('published')).toBe('false');
  });
});

describe('buildFeedParams', () => {
  it('fotoğraf kimliklerini sırayla ekler', () => {
    const p = buildFeedParams(['11', '22'], 'Mesaj', 'tok');
    expect(p.get('message')).toBe('Mesaj');
    expect(JSON.parse(p.get('attached_media[0]')!)).toEqual({ media_fbid: '11' });
    expect(JSON.parse(p.get('attached_media[1]')!)).toEqual({ media_fbid: '22' });
  });
});

describe('buildLinkParams', () => {
  it('blog bağlantısı gönderisi için mesaj ve bağlantı yazar', () => {
    const p = buildLinkParams('Yeni yazı', 'https://www.kartabaski.com/blog/x', 'tok');
    expect(p.get('message')).toBe('Yeni yazı');
    expect(p.get('link')).toBe('https://www.kartabaski.com/blog/x');
    expect(p.get('access_token')).toBe('tok');
  });
});
