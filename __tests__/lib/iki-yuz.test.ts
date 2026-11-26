/** İki yüze baskı: sepet kaydı, sipariş girdisi ve sipariş satırı kuralları. */
import { designFileIds, parseStoredCart } from '@/lib/cart';
import {
  OrderLineSchema, appendImage, canAddImage, lineNote, lineSides, orderImageIds, parseOrderInput, uploadsComplete,
} from '@/lib/siparis-types';
import { sideSummary } from '@/lib/design-sides';

const cartRaw = (design: unknown) => JSON.stringify([{ key: 'd:1', productId: 'p1', title: 'Kupa', qty: 1, design }]);

const input = (item: Record<string, unknown>) => ({
  items: [{ productId: 'p1', qty: 1, photoCount: 0, hasPreview: false, ...item }],
  name: 'Ali Veli', phone: '0555 111 22 33', city: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik Mahallesi', street: '372. Sokak', buildingNo: '12', postalCode: '35100', kvkk: true,
});

const line = (extra: Record<string, unknown> = {}) =>
  OrderLineSchema.parse({ productId: 'p1', slug: 'kupa', title: 'Kupa', unitPrice: 100, qty: 1, photoCount: 1, files: ['a'], ...extra });

describe('sepet', () => {
  const design = {
    photos: ['on1'], text: 'Ali', font: 'el',
    back: { photos: ['arka1', '../x'], text: 'Veli', removeBg: true, ready: { id: 'des1', name: 'Serçe' } },
  };

  it('arka yüz kayıttan okunur, geçersiz dosya kimliği atılır', () => {
    const d = parseStoredCart(cartRaw(design))[0].design!;
    expect(d.photos).toEqual(['on1']);
    expect(d.back).toEqual({ photos: ['arka1'], text: 'Veli', removeBg: true, ready: { id: 'des1', name: 'Serçe' } });
  });

  it('tek yüzlü eski kayıtta arka yüz yoktur', () => {
    expect(parseStoredCart(cartRaw({ photos: ['on1'] }))[0].design).not.toHaveProperty('back');
  });

  it('arka yüz fotoğrafları cihazdan silinmez', () => {
    expect(designFileIds(parseStoredCart(cartRaw(design)))).toEqual(['on1', 'arka1']);
  });

  it('iki yüz toplamda en fazla 8 fotoğraf tutar', () => {
    const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);
    const d = parseStoredCart(cartRaw({ photos: many(6, 'a'), back: { photos: many(6, 'b') } }))[0].design!;
    expect(d.photos.length + d.back!.photos.length).toBe(8);
  });
});

describe('sipariş girdisi', () => {
  it('arka yüzü kabul eder', () => {
    const r = parseOrderInput(input({ photoCount: 1, back: { photoCount: 2, text: 'Veli', readyId: 'des1' } }));
    expect(r.success).toBe(true);
  });

  it('iki yüzün toplamı sınırı aşamaz', () => {
    const r = parseOrderInput(input({ photoCount: 5, back: { photoCount: 4 } }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain('en fazla 8');
  });
});

describe('sipariş satırı', () => {
  const two = () => line({ text: 'Ali', back: { photoCount: 2, files: ['b'], text: 'Veli' } });

  it('arka yüz görselleri siparişe aittir (görüntüleme ve silme)', () => {
    expect(orderImageIds({ items: [two()] })).toEqual(['a', 'b']);
  });

  it('arka yüz yüklenmeden sipariş tamam sayılmaz', () => {
    expect(uploadsComplete(two())).toBe(false);
    expect(uploadsComplete(line({ back: { photoCount: 1, files: ['b'] } }))).toBe(true);
    expect(uploadsComplete(line())).toBe(true);
  });

  it('her yüz kendi sınırı kadar fotoğraf alır', () => {
    expect(canAddImage(two(), 'back')).toBe(true);
    expect(canAddImage(two(), 'photo')).toBe(false);
    expect(canAddImage(line(), 'back')).toBe(false);
  });

  it('yüklenen dosya doğru yüze yazılır', () => {
    expect(appendImage({ files: ['a'], back: { files: [], photoCount: 1 } }, 'back', 'b')).toEqual({ files: ['a'], back: { files: ['b'], photoCount: 1 } });
    expect(appendImage({ files: [] }, 'photo', 'a')).toEqual({ files: ['a'] });
    expect(appendImage({ files: [] }, 'preview', 'p')).toEqual({ files: [], preview: 'p' });
  });

  it('yüzler adıyla listelenir; tek yüzde ad yoktur', () => {
    expect(lineSides(line()).map((s) => s.label)).toEqual(['']);
    expect(lineSides(two()).map((s) => [s.label, s.text, s.files])).toEqual([['Ön yüz', 'Ali', ['a']], ['Arka yüz', 'Veli', ['b']]]);
  });

  it('üretim notu iki yüzü ayrı yazar', () => {
    expect(lineNote(two())).toBe('İki yüze baskı · Ön yüz: Yazı: Ali · Arka yüz: Yazı: Veli');
    expect(lineNote(line({ text: 'Ali', note: 'acil' }))).toBe('Yazı: Ali · acil');
    expect(lineNote(line())).toBe('');
  });
});

describe('sideSummary', () => {
  it('yüzün içeriğini özetler', () => {
    expect(sideSummary({ ready: { id: 'd', name: 'Serçe' }, text: 'Ali', photos: ['a', 'b'], removeBg: true }))
      .toBe('hazır tasarım: Serçe · yazı: Ali · 2 fotoğraf · arka plan silinecek');
    expect(sideSummary({ photos: [] })).toBe('');
  });
});
