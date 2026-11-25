import { buildMetaFeedXml, formatPrice, isFeedEligible, xmlEscape, imageUrlFor, imageUrlsFor, META_FEED_BRAND } from '@/lib/meta-feed';
import type { Product } from '@/types';

const SITE = 'https://www.kartabaski.com';

function makeProduct(over: Partial<Product & Record<string, unknown>> = {}): Product {
  return {
    id: 'abc123',
    title: 'Sihirli Kupa Kalp — Kişiye Özel Baskı',
    slug: 'sihirli-kupa-kalp',
    priceMin: 150,
    priceMax: 250,
    category: 'Sihirli Kupa',
    active: true,
    shortDesc: 'Isınınca tasarım ortaya çıkar',
    description: 'Isınınca fotoğrafınız ortaya çıkan sihirli kupa.',
    images: ['karta-baski/urunler/kupa1', 'karta-baski/urunler/kupa2'],
    deliveryDays: 3,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  } as unknown as Product;
}

describe('görseller', () => {
  it('imageUrlFor ilk görseli JPG Cloudinary adresine çevirir', () => {
    const u = imageUrlFor(makeProduct())!;
    expect(u).toContain('f_jpg');
    expect(u).toContain('karta-baski/urunler/kupa1');
  });
  it('görsel yoksa null, http adresi olduğu gibi kalır', () => {
    expect(imageUrlFor(makeProduct({ images: [] }))).toBeNull();
    expect(imageUrlFor(makeProduct({ images: ['https://x.com/a.png'] }))).toBe('https://x.com/a.png');
  });
  it('imageUrlsFor sınırı uygular', () => {
    expect(imageUrlsFor(makeProduct(), 1)).toHaveLength(1);
    expect(imageUrlsFor(makeProduct())).toHaveLength(2);
  });
});

describe('isFeedEligible', () => {
  it('aktif, fiyatlı ve görselli ürün uygun', () => {
    expect(isFeedEligible(makeProduct())).toBe(true);
  });
  it('pasif, fiyatsız ya da görselsiz ürün uygun değil', () => {
    expect(isFeedEligible(makeProduct({ active: false }))).toBe(false);
    expect(isFeedEligible(makeProduct({ priceMin: 0, priceMax: 0 }))).toBe(false);
    expect(isFeedEligible(makeProduct({ images: [] }))).toBe(false);
  });
});

describe('formatPrice / xmlEscape', () => {
  it('Meta fiyat biçimi', () => {
    expect(formatPrice(150)).toBe('150.00 TRY');
  });
  it('XML özel karakterlerini kaçırır', () => {
    expect(xmlEscape(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  });
});

describe('buildMetaFeedXml', () => {
  it('uygun ürünü KAR-TA BASKI markasıyla, başlangıç fiyatıyla yazar', () => {
    const xml = buildMetaFeedXml([makeProduct()], SITE);
    expect(xml).toContain('<g:id>abc123</g:id>');
    expect(xml).toContain('<g:price>150.00 TRY</g:price>');
    expect(xml).toContain(`<g:brand>${META_FEED_BRAND}</g:brand>`);
    expect(xml).toContain('<g:condition>new</g:condition>');
    expect(xml).toContain(`<link>${SITE}/urun/sihirli-kupa-kalp</link>`);
    expect(xml).toContain('<title>Sihirli Kupa Kalp</title>'); // "— Kişiye Özel Baskı" eki atılır
  });
  it('uygun olmayan ürünleri atlar ve eski dükkân izi taşımaz', () => {
    const xml = buildMetaFeedXml([makeProduct({ id: 'x', active: false }), makeProduct({ id: 'y' })], SITE);
    expect(xml).not.toContain('<g:id>x</g:id>');
    expect(xml).toContain('<g:id>y</g:id>');
    expect(xml).not.toMatch(/Ümit|ikinci el|2\. El/i);
  });
  it('boş listede geçerli boş kanal üretir', () => {
    const xml = buildMetaFeedXml([], SITE);
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });
});
