import { sanitizePublicIds } from '@/lib/cloudinary-ids';

describe('sanitizePublicIds', () => {
  it('geçerli public_id değerlerini korur', () => {
    expect(sanitizePublicIds(['karta-baski/urunler/abc_123'])).toEqual(['karta-baski/urunler/abc_123']);
  });

  it('URL, yol kaçışı ve string olmayanları eler', () => {
    expect(
      sanitizePublicIds(['https://evil.com/x', '../etc', '/abs', 42, null, 'ok/id'])
    ).toEqual(['ok/id']);
  });

  it('dizi değilse boş döner ve üst sınırı uygular', () => {
    expect(sanitizePublicIds('x')).toEqual([]);
    expect(sanitizePublicIds(Array.from({ length: 50 }, (_, i) => `a${i}`), 5)).toHaveLength(5);
  });
});
