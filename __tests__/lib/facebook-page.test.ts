import { getFacebookConfig, buildPhotoParams, buildFeedParams, buildLinkParams } from '@/lib/facebook-page';

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
