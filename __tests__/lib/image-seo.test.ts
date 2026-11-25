import { productImageAlt, buildImageSitemapXml, ALT_MAX } from '@/lib/image-seo';

describe('productImageAlt', () => {
  it('ilk veya tek fotoğrafta kategori, renk ve kişiye özel baskı içerir', () => {
    expect(productImageAlt({ title: 'Sihirli Kupa', category: 'Sihirli Kupa', color: 'Siyah', index: 0, total: 4 }))
      .toBe('Sihirli Kupa – Sihirli Kupa, Siyah, kişiye özel baskı');
    expect(productImageAlt({ title: 'Latte Fincanı', category: 'Latte Fincanı' })).toBe('Latte Fincanı – Latte Fincanı, kişiye özel baskı');
  });
  it('sonraki fotoğraflarda sıra bilgisi verir', () => {
    expect(productImageAlt({ title: 'Pro Kupa', category: 'Pro Kupa', index: 2, total: 4 })).toBe('Pro Kupa – Pro Kupa, fotoğraf 3/4');
  });
  it('kategori ve renk yoksa yalnızca ad ve ek', () => {
    expect(productImageAlt({ title: 'Kupa' })).toBe('Kupa – kişiye özel baskı');
  });
  it('çok uzun adı kısaltır ama eki korur ve 125 karakteri geçmez', () => {
    const alt = productImageAlt({ title: 'A'.repeat(400), category: 'Büyük Kupa', color: 'Beyaz', index: 1, total: 3 });
    expect(alt.length).toBeLessThanOrEqual(ALT_MAX);
    expect(alt.endsWith('fotoğraf 2/3')).toBe(true);
  });
});

describe('buildImageSitemapXml', () => {
  it('görselleri image:image olarak yazar ve XML özel karakterlerini kaçırır', () => {
    const xml = buildImageSitemapXml([{ loc: 'https://x.com/urun/a', images: ['https://c.com/i.jpg?a=1&b=2', 'https://c.com/j.jpg'] }]);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain('<loc>https://x.com/urun/a</loc>');
    expect(xml).toContain('<image:loc>https://c.com/i.jpg?a=1&amp;b=2</image:loc>');
    expect(xml.match(/<image:image>/g)).toHaveLength(2);
  });
  it('görseli olmayan sayfayı atlar', () => {
    const xml = buildImageSitemapXml([{ loc: 'https://x.com/a', images: [] }, { loc: 'https://x.com/b', images: ['https://c.com/i.jpg'] }]);
    expect(xml).not.toContain('https://x.com/a<');
    expect(xml).toContain('https://x.com/b');
  });
  it('sayfa başına en fazla 1000 görsel yazar', () => {
    const images = Array.from({ length: 1200 }, (_, i) => `https://c.com/${i}.jpg`);
    const xml = buildImageSitemapXml([{ loc: 'https://x.com/a', images }]);
    expect(xml.match(/<image:image>/g)).toHaveLength(1000);
  });
});
