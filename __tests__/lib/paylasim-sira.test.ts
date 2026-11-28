import { borderWhiteRatio, isPlain } from '@/lib/paylasim/kapak';
import { carouselCandidates, carouselKey, colorImages, mixImages, storyPick } from '@/lib/paylasim/sira';
import type { PaylasimUrun } from '@/lib/paylasim/types';

/** 24 bit BMP üretir: kenar `edge`, iç `inner` gri tonu. */
function bmp(w: number, h: number, edge: number, inner: number): Uint8Array {
  const row = Math.floor((24 * w + 31) / 32) * 4;
  const b = new Uint8Array(54 + row * h);
  const dv = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d;
  dv.setUint32(10, 54, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(28, 24, true);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? edge : inner;
    b.fill(v, 54 + y * row + x * 3, 54 + y * row + x * 3 + 3);
  }
  return b;
}

const urun = (id: string, createdAt: number, colors: [string, string[]][], images: string[] = []): PaylasimUrun => ({
  id, title: id, slug: id, category: 'Lüks Kupa', shortDesc: '', deliveryDays: 3, createdAt, images,
  colors: colors.map(([name, list]) => ({ name, images: list })), tiers: [{ label: '1 adet', price: '250 ₺' }],
});

describe('kapak', () => {
  it('beyaz kenarlı görsel düz zemindir', () => {
    expect(borderWhiteRatio(bmp(8, 8, 250, 20))).toBe(1);
    expect(isPlain(bmp(8, 8, 120, 255))).toBe(false);
  });
  it('BMP olmayan veri hata verir', () => {
    expect(() => borderWhiteRatio(new Uint8Array(60))).toThrow('BMP');
  });
});

describe('görsel seçimi', () => {
  const u = urun('a', 1, [['Siyah', ['s1', 's2', 's3']], ['Mavi', ['m1', 'm2']]], ['ana']);
  it('karışık karusel temalı kapakla başlar, renkleri sırayla dolaşır, tekrar etmez', () => {
    const ids = mixImages(u, undefined, { ana: true, s1: true, s2: false }, 5);
    expect(ids).toEqual(['s2', 's1', 'm1', 'm2', 's3']);
  });
  it('elle seçilen kapak geçerlidir', () => {
    expect(colorImages(u, 'Mavi', 'm2', {})).toEqual(['m2', 'm1']);
  });
});

describe('carouselCandidates', () => {
  const a = urun('a', 1, [['Siyah', ['s1']], ['Mavi', ['m1']]]);
  const b = urun('b', 2, [['Sarı', ['y1']]]);
  it('önce karışık tur (yeni ürün başta), sonra ürünler arası dönüşümlü renk turu', () => {
    expect(carouselCandidates([a, b], new Set()).map((c) => carouselKey(c.productId, c.color))).toEqual([
      'k|b|mix', 'k|a|mix', 'k|b|r|Sarı', 'k|a|r|Siyah', 'k|a|r|Mavi',
    ]);
  });
  it('kullanılmış anahtar yeniden gelmez', () => {
    expect(carouselCandidates([b], new Set(['k|b|mix', 'k|b|r|Sarı']))).toEqual([]);
  });
});

describe('storyPick', () => {
  const a = urun('a', 1, [['Siyah', ['s1', 's2']]]);
  const b = urun('b', 2, [['Sarı', ['y1']]]);
  it('en uzun süredir paylaşılmayan ürün ve görsel', () => {
    expect(storyPick([a, b], { s1: 5 }, { b: 10, a: 1 }, {})).toEqual({ productId: 'a', imageId: 's2' });
  });
});
