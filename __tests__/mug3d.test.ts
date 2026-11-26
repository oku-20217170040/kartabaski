import { MUG_MODELS, mugModelFor, mugPalette, printSize } from '@/lib/mug3d';
import { contentBounds } from '@/lib/trim';

describe('mugModelFor', () => {
  it.each([
    ['Lüks Kupa — Kişiye Özel Baskı', 'luks'],
    ['Luks Kupa', 'luks'],
    ['Pro Kupa — Kişiye Özel Baskı', 'pro'],
    ['Seramik Kahve Fincanı - Kişiye Özel Baskı', 'seramik'],
    ['Sihirli Kupa', 'sihirli'],
    ['TABAKLI KAHVE FİNCANI ', 'tabakli'],
    ['PORSELEN KAHVE FİNCANI ', 'porselen'],
    ['PORSELEN MOTTO FİNCAN', 'motto'],
    ['AFİLLİ PORSELEN KUPA', 'afilli'],
    ['Büyük Beyaz Kupa — Kişiye Özel Baskı', 'buyuk'],
    ['Latte Fincanı — Kişiye Özel Baskı', 'latte'],
    ['Kahve Fincanı — Kişiye Özel Baskı', 'kahve'],
  ])('%s → %s', (title, id) => {
    expect(mugModelFor(title)?.id).toBe(id);
  });

  it('modeli olmayan kupada null döner', () => {
    expect(mugModelFor('Termos Bardak')).toBeNull();
  });
});

describe('modeller', () => {
  it.each(Object.values(MUG_MODELS))('$id: baskı alanı gövdenin içinde, kulp ağzın altında', (m) => {
    const { centerY, height } = m.print;
    expect(centerY - height / 2).toBeGreaterThanOrEqual((m.band ?? m.base.rise));
    expect(centerY + height / 2).toBeLessThan(m.height - 0.05);
    for (const tube of m.tubes) {
      for (const [x, y] of tube.path) {
        expect(x).toBeGreaterThan(0.4);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(m.height);
      }
    }
  });
});

describe('mugPalette', () => {
  const { luks, pro, afilli, tabakli, kahve, sihirli } = MUG_MODELS;

  it('kulplu modelde gövde krem, kulp seçilen renktedir', () => {
    const red = mugPalette(luks, 'Kırmızı');
    expect(red.handle).not.toBe(red.body);
    expect(mugPalette(luks, 'KIRMIZI')).toEqual(red);
  });

  it('Beyaz ve bilinmeyen renkte her yer aynıdır', () => {
    const white = mugPalette(luks, 'Beyaz');
    expect(new Set([white.body, white.handle, white.band, white.saucer]).size).toBe(1);
    expect(mugPalette(luks, undefined)).toEqual(white);
  });

  it('renk modele göre doğru yere gider', () => {
    const band = mugPalette(pro, 'Mavi');
    expect(band.band).not.toBe(band.body);
    expect(band.handle).toBe(band.body);
    const accent = mugPalette(afilli, 'Mor');
    expect(accent.inner).toBe(accent.handle);
    expect(accent.handle).not.toBe(accent.body);
    const saucer = mugPalette(tabakli, 'Lacivert');
    expect(saucer.saucer).not.toBe(saucer.body);
    expect(saucer.handle).toBe(saucer.body);
  });

  it('pastel renkte kupanın tamamı boyalıdır', () => {
    const pastel = mugPalette(kahve, 'Pastel Mavi');
    expect(pastel.body).toBe(pastel.handle);
    expect(pastel.body).not.toBe(mugPalette(kahve, 'Beyaz').body);
  });

  it('Sihirli Kupa sıcakken beyazdır', () => {
    expect(mugPalette(sihirli, 'Siyah').body).toBe(mugPalette(luks, 'Beyaz').body);
  });
});

describe('printSize', () => {
  it('yay uzunluğu ile yükseklik oranını korur', () => {
    const model = MUG_MODELS.luks;
    const { width, height } = printSize(model, 1000);
    expect(width / height).toBeCloseTo((model.radius * model.print.angle) / model.print.height, 2);
  });
});

describe('contentBounds', () => {
  const image = (width: number, height: number, ink: [number, number][]) => {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    ink.forEach(([x, y]) => data.set([200, 80, 0, 255], (y * width + x) * 4));
    return data;
  };

  it('beyaz kenar payını atar', () => {
    expect(contentBounds(image(6, 5, [[2, 1], [4, 3]]), 6, 5)).toEqual({ x: 2, y: 1, width: 3, height: 3 });
  });

  it('boş görselde null döner', () => {
    expect(contentBounds(image(3, 3, []), 3, 3)).toBeNull();
    expect(contentBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});
