import { composeRootMetadata, lengthStatus, categorySeoFor, SEO_TITLE_MAX, SEO_DESC_MAX } from '@/lib/seo-meta';
import { DEFAULT_SEO, normalizeSeoSettings, cleanVerification } from '@/lib/seo-settings';

describe('varsayılan SEO metinleri', () => {
  it('başlık ve açıklama arama sonucu sınırlarına sığar', () => {
    expect(DEFAULT_SEO.siteTitle.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect(DEFAULT_SEO.description.length).toBeLessThanOrEqual(SEO_DESC_MAX);
  });
  it('lengthStatus', () => {
    expect(lengthStatus('', 60)).toBe('empty');
    expect(lengthStatus('a'.repeat(61), 60)).toBe('long');
    expect(lengthStatus('merhaba', 60)).toBe('ok');
  });
});

describe('composeRootMetadata', () => {
  it('doğrulama kodu yokken verification eklenmez', () => {
    const m = composeRootMetadata(DEFAULT_SEO);
    expect(m.verification).toBeUndefined();
    expect(m.keywords).toEqual(DEFAULT_SEO.keywords);
  });
  it('Google ve Bing kodlarını ekler, OG görseli Cloudinary adresi olur', () => {
    const s = normalizeSeoSettings({ googleVerification: 'abcDEF12345', bingVerification: 'BING1234567', ogImage: 'karta-baski/urunler/og1' });
    const m = composeRootMetadata(s);
    expect(m.verification).toEqual({ google: 'abcDEF12345', other: { 'msvalidate.01': 'BING1234567' } });
    const og = (m.openGraph?.images as { url: string }[])[0].url;
    expect(og).toContain('res.cloudinary.com');
    expect(og).toContain('karta-baski/urunler/og1');
  });
  it('OG görseli yoksa logoya düşer', () => {
    const og = (composeRootMetadata(DEFAULT_SEO).openGraph?.images as { url: string }[])[0].url;
    expect(og).toBe('/logo.png');
  });
});

describe('normalizeSeoSettings', () => {
  it('boş/bozuk girdi varsayılana döner', () => {
    expect(normalizeSeoSettings(null)).toEqual(DEFAULT_SEO);
    expect(normalizeSeoSettings({ siteTitle: 5, keywords: 'x' })).toEqual(DEFAULT_SEO);
  });
  it('listeleri kırpar ve tekilleştirir', () => {
    const s = normalizeSeoSettings({ keywordTargets: [' Kupa baskı ', 'kupa BASKI', '', 'sihirli kupa'], targetCities: [] });
    expect(s.keywordTargets).toEqual(['Kupa baskı', 'sihirli kupa']);
    expect(s.targetCities).toEqual([]); // açıkça boşaltılabilir
  });
  it('geçersiz OG kimliğini atar', () => {
    expect(normalizeSeoSettings({ ogImage: 'baska-klasor/x' }).ogImage).toBe('');
  });
  it('kategori metinlerini temizler', () => {
    const s = normalizeSeoSettings({ categorySeo: { 'Lüks Kupa': { title: ' Lüks ', intro: '' }, Bos: {} } });
    expect(categorySeoFor(s, 'Lüks Kupa')).toEqual({ title: 'Lüks' });
    expect(s.categorySeo.Bos).toBeUndefined();
  });
  it('doğrulama kodunu tam meta etiketinden ayıklar', () => {
    expect(cleanVerification('<meta name="google-site-verification" content="abc123XYZ_-9" />')).toBe('abc123XYZ_-9');
    expect(cleanVerification('<script>')).toBe('');
  });
});
