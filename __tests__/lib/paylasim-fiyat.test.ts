import { approvedTiers, parsePriceLines, priceSourceKey } from '@/lib/paylasim/fiyat';

const DESC = [
  'Kişiye özel baskı.',
  '✔ Kurumsal siparişlerde en rekabetçi fiyat (85₺/adet)',
  '• Özel Tasarım: (1 adet) 300 ₺',
  '• 2’li set Tasarımlı: 400 ₺',
  "• 6'lı Set Tasarımlı (1 adet):  295₺",
  '• 6’lı set Tasarımsız: 1.150 ₺',
  '• 45 adet ve üzeri: 130₺/adet',
].join('\n');

describe('parsePriceLines', () => {
  it('kademe satırlarını yazıldığı gibi alır, slogan satırını almaz', () => {
    expect(parsePriceLines(DESC)).toEqual([
      { label: 'Özel Tasarım: (1 adet)', price: '300 ₺' },
      { label: '2’li set Tasarımlı', price: '400 ₺' },
      { label: "6'lı Set Tasarımlı (1 adet)", price: '295 ₺' },
      { label: '6’lı set Tasarımsız', price: '1.150 ₺' },
      { label: '45 adet ve üzeri', price: '130 ₺/adet' },
    ]);
  });
  it('fiyat satırı yoksa boş döner', () => {
    expect(parsePriceLines('Sade bir kupa.')).toEqual([]);
  });
});

describe('approvedTiers', () => {
  const tiers = [{ label: '1 adet', price: '300 ₺' }];
  it('onay anındaki satırlar değişmediyse kademeleri döndürür', () => {
    expect(approvedTiers({ description: DESC, priceTiers: tiers, priceTiersSource: priceSourceKey(DESC) })).toEqual(tiers);
  });
  it('açıklamadaki fiyat değişince onay düşer', () => {
    const changed = DESC.replace('300 ₺', '320 ₺');
    expect(approvedTiers({ description: changed, priceTiers: tiers, priceTiersSource: priceSourceKey(DESC) })).toBeNull();
  });
  it('kademe ya da onay yoksa null', () => {
    expect(approvedTiers({ description: DESC })).toBeNull();
    expect(approvedTiers({ description: DESC, priceTiers: [], priceTiersSource: priceSourceKey(DESC) })).toBeNull();
  });
});
