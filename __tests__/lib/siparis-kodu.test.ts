/** Sipariş kodu (KB + 11 karakter), kodla sorgu görünümü ve yöneticinin takip mesajı. */
import {
  ORDER_CODE_ALPHABET, ORDER_CODE_RE, OrderRequestSchema, makeOrderCode, normalizeOrderCode, orderNo, trackingMessage,
} from '@/lib/siparis-types';
import { buildTracking, publicOrder } from '@/lib/siparis-takip';

const token = 'ab12cd34'.repeat(4);

describe('sipariş kodu', () => {
  it('KB ile başlar, toplam 13 karakterdir', () => {
    let n = 0;
    const code = makeOrderCode((max) => (n++ * 7) % max);
    expect(code).toHaveLength(13);
    expect(code).toMatch(ORDER_CODE_RE);
  });

  it('karışan harf ve rakamlar kullanılmaz', () => {
    expect(ORDER_CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it('boşluk, tire ve küçük harf kabul edilir', () => {
    expect(normalizeOrderCode(' kb7h3-qmw2 pxz9 ')).toBe('KB7H3QMW2PXZ9');
  });

  it.each(['', 'KB123', 'AB7H3QMW2PXZ9', 'KB7H3QMW2PXZ', 'KB7H3QMW2PXZ9A', 'KB0H3QMW2PXZ9'])('geçersiz kod reddedilir: %s', (value) => {
    expect(normalizeOrderCode(value)).toBeNull();
  });

  it('kodu olmayan eski kayıtta anahtarın başı gösterilir', () => {
    expect(orderNo({ token, code: 'KB7H3QMW2PXZ9' })).toBe('KB7H3QMW2PXZ9');
    expect(orderNo({ token })).toBe('AB12CD');
  });
});

describe('takip mesajı', () => {
  it('müşteriye özel bağlantıyı ve kodu içerir', () => {
    const text = trackingMessage({ token, code: 'KB7H3QMW2PXZ9', name: 'Ayşe' }, 'https://ornek.test');
    expect(text).toContain('Merhaba Ayşe');
    expect(text).toContain(`https://ornek.test/siparis/${token}`);
    expect(text).toContain('KB7H3QMW2PXZ9');
  });
});

describe('kodla sorgu görünümü', () => {
  const order = OrderRequestSchema.parse({
    token, code: 'KB7H3QMW2PXZ9', createdAt: 1, updatedAt: 1, status: 'yeni', total: 600,
    name: 'Ayşe Yılmaz', phone: '05551112233', city: 'İzmir', address: 'Gizli Sokak 5', note: 'gizli not', adminNote: 'iç not',
    items: [{
      productId: 'p1', slug: 'luks-kupa', title: 'Lüks Kupa', unitPrice: 300, qty: 2, color: 'Mavi', text: 'Canım annem', note: 'satır notu',
      photoCount: 1, hasPreview: true, files: ['karta-baski/siparisler/foto'], preview: 'karta-baski/siparisler/onizleme',
      back: { text: 'Arka yazı', photoCount: 0, files: [] },
    }],
    proof: { round: 1, images: ['karta-baski/siparisler/kanit'], sentAt: 2, state: 'bekliyor' },
  });
  const view = publicOrder(order, buildTracking(order));

  it('durum ve ürün özeti verir', () => {
    expect(view.code).toBe('KB7H3QMW2PXZ9');
    expect(view.items).toEqual([{ title: 'Lüks Kupa', qty: 2, color: 'Mavi', twoSided: true }]);
    expect(view.tracking.headline).toBe('Onayınızı bekliyoruz');
  });

  it('kişisel bilgi, fotoğraf, yazı ve bağlantı anahtarı sızdırmaz', () => {
    const dump = JSON.stringify(view);
    for (const secret of ['Ayşe', '0555', 'İzmir', 'Gizli', 'gizli not', 'iç not', 'Canım', 'Arka yazı', 'satır notu', 'siparisler/', token]) {
      expect(dump).not.toContain(secret);
    }
  });
});
