import {
  MAX_CART_ITEMS,
  MAX_QTY,
  addToCart,
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
  upsertLine,
  designFileIds,
  waNumber,
} from '@/lib/cart';
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

describe('tasarımlı satırlar', () => {
  const designed = item('a', { key: 'd:1', design: { photos: ['f1', 'f2'], preview: 'p1', text: 'Elif' } });

  it('düzenlenen satır yerinde değişir, yeni tasarım ayrı satır olur', () => {
    let items = upsertLine([designed], { ...designed, qty: 3 });
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
    items = upsertLine(items, item('a', { key: 'd:2', design: { photos: [] } }));
    expect(items).toHaveLength(2);
  });

  it('cihazdaki dosya kimliklerini listeler', () => {
    expect(designFileIds([designed, item('b')])).toEqual(['f1', 'f2', 'p1']);
  });

  it('kayıttan okurken anahtar ve tasarım korunur, geçersiz dosya kimliği atılır', () => {
    const raw = JSON.stringify([designed, { ...designed, key: 'd:2', design: { photos: ['../x', 'ok'] } }]);
    const out = parseStoredCart(raw);
    expect(out.map((i) => i.key)).toEqual(['d:1', 'd:2']);
    expect(out[0].design).toMatchObject({ photos: ['f1', 'f2'], preview: 'p1', text: 'Elif' });
    expect(out[1].design?.photos).toEqual(['ok']);
  });

  it('tasarımlı satırda katalogda olmayan renk korunur', () => {
    const { available } = reconcileCart([{ ...designed, color: 'Mavi' }], [info('a', { colors: ['Sarı'] })]);
    expect(available[0].color).toBe('Mavi');
  });
});

describe('isTalepStatus', () => {
  it('bilinen durumları tanır', () => {
    expect(isTalepStatus('siparis')).toBe(true);
    expect(isTalepStatus('arandi')).toBe(false);
  });
});
