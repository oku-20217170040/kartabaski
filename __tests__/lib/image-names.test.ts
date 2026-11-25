import { canRenameImage, slugPart, seoImageName, PRODUCT_IMAGE_FOLDER } from '@/lib/image-names';

describe('canRenameImage', () => {
  it('ürün klasöründeki rastgele adlı görseli yeniden adlandırılabilir sayar', () => {
    expect(canRenameImage('karta-baski/urunler/xk3j9a2b')).toBe(true);
  });
  it('zaten adlandırılmış, başka klasördeki veya tam adres olan görseli atlar', () => {
    expect(canRenameImage('karta-baski/urunler/karta-baski-sihirli-kupa-1-xk3j')).toBe(false);
    expect(canRenameImage('karta-baski/studio/abc123')).toBe(false);
    expect(canRenameImage('https://example.com/a.jpg')).toBe(false);
    expect(canRenameImage('karta-baski/urunler/')).toBe(false);
  });
});

describe('slugPart', () => {
  it('Türkçe karakterleri sadeleştirir ve tire ile birleştirir', () => {
    expect(slugPart('Kişiye Özel Sihirli Kupa')).toBe('kisiye-ozel-sihirli-kupa');
    expect(slugPart('Çiçekli Latte Fincanı (Büyük) Hediye')).toBe('cicekli-latte-fincani-buyuk-hediye');
  });
  it('boş girdide boş döner ve 60 karakteri geçmez', () => {
    expect(slugPart('---')).toBe('');
    const long = slugPart('a '.repeat(100));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('seoImageName', () => {
  it('marka adı, ürün adı, sıra ve kısa kodla ad üretir', () => {
    expect(seoImageName('sihirli-kupa-kalp', 2, 'karta-baski/urunler/Xk3J9a2b')).toBe(`${PRODUCT_IMAGE_FOLDER}/karta-baski-sihirli-kupa-kalp-2-xk3j`);
  });
  it('slug boşsa "urun" kullanır, kısa eski adı doldurur', () => {
    expect(seoImageName('', 1, 'karta-baski/urunler/ab')).toBe(`${PRODUCT_IMAGE_FOLDER}/karta-baski-urun-1-abxx`);
  });
  it('aynı slug ve sırada farklı eski adlar farklı sonuç verir', () => {
    expect(seoImageName('kupa', 1, 'karta-baski/urunler/aaaa1111')).not.toBe(seoImageName('kupa', 1, 'karta-baski/urunler/bbbb2222'));
  });
  it('üretilen ad yeniden adlandırma için uygun olmaz (tekrar yeniden adlandırılmaz)', () => {
    expect(canRenameImage(seoImageName('kupa', 1, 'karta-baski/urunler/aaaa1111'))).toBe(false);
  });
});
