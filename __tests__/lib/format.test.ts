import { formatPriceRange, whatsappLink, cloudinaryUrl, cloudinaryThumb } from '@/lib/format';

describe('formatPriceRange', () => {
  it('fiyat yoksa yönlendirir', () => expect(formatPriceRange(0, 0)).toBe('Fiyat için yazın'));
  it('tek fiyat', () => {
    expect(formatPriceRange(150, 0)).toContain('150');
    expect(formatPriceRange(150, 150)).toBe(formatPriceRange(150, 0));
  });
  it('aralık', () => {
    const r = formatPriceRange(150, 350);
    expect(r).toContain('150');
    expect(r).toContain('350');
    expect(r).toContain('–');
  });
});

describe('whatsappLink', () => {
  it('genel mesaj', () => {
    const l = whatsappLink();
    expect(l).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });
  it('ürün, renk ve slug içerir', () => {
    const l = decodeURIComponent(whatsappLink('Sihirli Kupa', 'sihirli-kupa', 'Kırmızı'));
    expect(l).toContain('Sihirli Kupa');
    expect(l).toContain('Kırmızı');
    expect(l).toContain('/urun/sihirli-kupa');
  });
});

describe('cloudinary', () => {
  it('cloudinaryUrl varsayılan dönüşüm', () => {
    expect(cloudinaryUrl('karta-baski/urunler/a')).toMatch(
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_auto,q_auto,w_1200,c_limit\/karta-baski\/urunler\/a$/,
    );
  });
  it('özel opts', () => expect(cloudinaryUrl('x', 'w_10')).toContain('/upload/w_10/x'));
  it('thumb w_600', () => expect(cloudinaryThumb('x')).toContain('w_600'));
});

import { displayTitle } from '@/lib/format';

describe('displayTitle', () => {
  it('"Kişiye Özel Baskı" ekini atar', () => {
    expect(displayTitle('Lüks Kupa — Kişiye Özel Baskı')).toBe('Lüks Kupa');
    expect(displayTitle('Seramik Kahve Fincanı - Kişiye Özel Baskı')).toBe('Seramik Kahve Fincanı');
  });
  it('tamamı büyük harf adları Türkçe kurallarla düzeltir', () => {
    expect(displayTitle('TABAKLI KAHVE FİNCANI')).toBe('Tabaklı Kahve Fincanı');
    expect(displayTitle('AFİLLİ PORSELEN KUPA')).toBe('Afilli Porselen Kupa');
  });
  it('normal adlara dokunmaz', () => {
    expect(displayTitle('Sihirli Kupa')).toBe('Sihirli Kupa');
  });
});
