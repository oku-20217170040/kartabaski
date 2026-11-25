import {
  MAX_CART_ITEMS,
  MAX_QTY,
  addToCart,
  buildCartWhatsAppMessage,
  cartCount,
  cartTotal,
  clampQty,
  customerWhatsappLink,
  lineKey,
  parseStoredCart,
  reconcileCart,
  removeFromCart,
  setNote,
  setQty,
  waNumber,
} from '@/lib/cart';
import { CartRequestInputSchema } from '@/lib/cart-schemas';
import { isTalepStatus } from '@/lib/talep-status';
import type { CartItem, CartProductInfo } from '@/lib/cart-types';

const item = (id: string, over: Partial<CartItem> = {}): CartItem => ({
  key: lineKey(id, over.color), productId: id, slug: `slug-${id}`, title: `Kupa ${id}`,
  unitPrice: 150, image: null, category: 'Lüks Kupa', qty: 1, ...over,
});
const info = (id: string, over: Partial<CartProductInfo> = {}): CartProductInfo => ({
  id, slug: `slug-${id}`, title: `Kupa ${id}`, unitPrice: 150, image: null, category: 'Lüks Kupa', active: true, colors: [], ...over,
});

describe('clampQty', () => {
  it('1–500 aralığına sıkıştırır', () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-4)).toBe(1);
    expect(clampQty('abc')).toBe(1);
    expect(clampQty(3.9)).toBe(3);
    expect(clampQty(9999)).toBe(MAX_QTY);
  });
});

describe('addToCart / removeFromCart / setQty / setNote', () => {
  it('aynı ürün + renk adedi artırır, farklı renk yeni satır olur', () => {
    let items = addToCart([], item('a', { qty: 2 }));
    items = addToCart(items, item('a', { qty: 3 }));
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(5);
    items = addToCart(items, item('a', { color: 'Kırmızı' }));
    expect(items).toHaveLength(2);
  });

  it('adet MAX_QTY üstüne çıkmaz', () => {
    let items = addToCart([], item('a', { qty: 400 }));
    items = addToCart(items, item('a', { qty: 400 }));
    expect(items[0].qty).toBe(MAX_QTY);
  });

  it('en fazla MAX_CART_ITEMS satır alır', () => {
    let items: CartItem[] = [];
    for (let i = 0; i < MAX_CART_ITEMS + 5; i++) items = addToCart(items, item(String(i)));
    expect(items).toHaveLength(MAX_CART_ITEMS);
  });

  it('anahtarla çıkarır, adet ve not günceller', () => {
    const items = [item('a'), item('b')];
    expect(removeFromCart(items, items[0].key).map((i) => i.productId)).toEqual(['b']);
    expect(setQty(items, items[1].key, 12)[1].qty).toBe(12);
    expect(setQty(items, items[1].key, 0)[1].qty).toBe(1);
    expect(setNote(items, items[0].key, 'Ayşe')[0].note).toBe('Ayşe');
    expect(setNote(items, items[0].key, '')[0].note).toBeUndefined();
  });
});

describe('cartTotal / cartCount', () => {
  it('birim fiyat × adet toplar, fiyatsız satırı katmaz', () => {
    expect(cartTotal([{ unitPrice: 100, qty: 3 }, { unitPrice: 0, qty: 5 }, { unitPrice: 50, qty: 2 }])).toBe(400);
  });
  it('toplam adedi verir', () => {
    expect(cartCount([{ qty: 2 }, { qty: 7 }])).toBe(9);
  });
});

describe('reconcileCart', () => {
  it('yalnızca pasif ürünü unavailable yapar, güncel fiyatı uygular', () => {
    const { available, unavailable } = reconcileCart(
      [item('a'), item('b')],
      [info('a', { unitPrice: 180 }), info('b', { active: false })]
    );
    expect(available).toEqual([expect.objectContaining({ productId: 'a', unitPrice: 180 })]);
    expect(unavailable.map((i) => i.productId)).toEqual(['b']);
  });

  it('bilgisi gelmeyen ürün sepette kalır', () => {
    const { available, unavailable } = reconcileCart([item('a')], []);
    expect(available).toHaveLength(1);
    expect(unavailable).toHaveLength(0);
  });

  it('artık olmayan rengi temizler', () => {
    const { available } = reconcileCart([item('a', { color: 'Mor' })], [info('a', { colors: ['Beyaz'] })]);
    expect(available[0].color).toBeUndefined();
  });
});

describe('parseStoredCart', () => {
  it('bozuk veride boş döner', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('{x')).toEqual([]);
    expect(parseStoredCart('{"a":1}')).toEqual([]);
  });

  it('geçersiz satırları atar, adedi sıkıştırır, tekrarı birleştirmez', () => {
    const raw = JSON.stringify([
      { productId: 'a', title: 'A', unitPrice: 100, qty: 9999, color: ' Beyaz ' },
      { productId: 'a', title: 'A', unitPrice: 100, qty: 2, color: 'Beyaz' },
      { title: 'id yok' },
      null,
    ]);
    const out = parseStoredCart(raw);
    expect(out).toHaveLength(1);
    expect(out[0].qty).toBe(MAX_QTY);
    expect(out[0].color).toBe('Beyaz');
  });
});

describe('buildCartWhatsAppMessage', () => {
  it('talep no, adet, renk, kişiselleştirme ve tahmini toplamı içerir', () => {
    const msg = buildCartWhatsAppMessage({
      ref: 'abc123xyz',
      items: [{ productId: 'a', slug: 'kupa-a', title: 'Kupa A', unitPrice: 150, qty: 4, color: 'Beyaz', note: 'Ayşe' }],
      total: 600,
      name: 'Ali', phone: '0555 111 22 33', city: 'İzmir', district: 'Karşıyaka',
    });
    expect(msg).toContain('No: ABC123');
    expect(msg).toContain('4 adet');
    expect(msg).toContain('Renk: Beyaz');
    expect(msg).toContain('Kişiselleştirme: Ayşe');
    expect(msg).toContain('600₺');
    expect(msg).toContain('Karşıyaka / İzmir');
    expect(msg).toContain('/urun/kupa-a');
  });
});

describe('waNumber / customerWhatsappLink', () => {
  it('Türkiye numarasını wa.me biçimine çevirir', () => {
    expect(waNumber('0555 111 22 33')).toBe('905551112233');
    expect(waNumber('555 111 22 33')).toBe('905551112233');
    expect(waNumber('+90 555 111 22 33')).toBe('905551112233');
  });
  it('müşteri bağlantısı numara ve talep no içerir', () => {
    const url = customerWhatsappLink({ name: 'Ali', phone: '05551112233', id: 'abc123xyz' });
    expect(url.startsWith('https://wa.me/905551112233?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('ABC123');
  });
});

describe('CartRequestInputSchema', () => {
  const valid = {
    items: [{ productId: 'abc_1', qty: 2, color: 'Beyaz', note: 'Ayşe' }],
    name: 'Ali Veli', phone: '0555 111 22 33', city: 'İzmir', district: 'Karşıyaka',
  };
  it('geçerli talebi kabul eder', () => {
    expect(CartRequestInputSchema.safeParse(valid).success).toBe(true);
  });
  it('boş sepeti, 500 üstü adedi, kötü telefonu ve honeypot dolu talebi reddeder', () => {
    expect(CartRequestInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(CartRequestInputSchema.safeParse({ ...valid, items: [{ productId: 'a', qty: 501 }] }).success).toBe(false);
    expect(CartRequestInputSchema.safeParse({ ...valid, phone: '123' }).success).toBe(false);
    expect(CartRequestInputSchema.safeParse({ ...valid, website: 'bot' }).success).toBe(false);
  });
  it('il/ilçe/ad zorunlu, adres opsiyoneldir', () => {
    expect(CartRequestInputSchema.safeParse({ ...valid, city: '' }).success).toBe(false);
    expect(CartRequestInputSchema.safeParse({ ...valid, address: undefined }).success).toBe(true);
  });
  it('yol benzeri ürün id reddedilir', () => {
    expect(CartRequestInputSchema.safeParse({ ...valid, items: [{ productId: 'a/b', qty: 1 }] }).success).toBe(false);
  });
});

describe('isTalepStatus', () => {
  it('bilinen durumları tanır', () => {
    expect(isTalepStatus('siparis')).toBe(true);
    expect(isTalepStatus('arandi')).toBe(false);
  });
});
