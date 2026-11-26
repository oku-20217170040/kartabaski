import { MUG_MODELS, mugModelFor, mugPalette, printSize } from '@/lib/mug3d';
import { contentBounds } from '@/lib/trim';

describe('mugModelFor', () => {
  it('Lüks Kupa ürününü ve konfigüratör bardağını tanır', () => {
    expect(mugModelFor('luks-kupa', 'Lüks Kupa')?.id).toBe('luks');
    expect(mugModelFor('konfig-abc', 'Luks Kupa')?.id).toBe('luks');
    expect(mugModelFor('konfig-abc', 'LÜKS KUPA')?.id).toBe('luks');
  });

  it('modeli olmayan kupada null döner', () => {
    expect(mugModelFor('sihirli-kupa', 'Sihirli Kupa')).toBeNull();
  });
});

describe('mugPalette', () => {
  it('renkli kupada gövde krem, kulp seçilen renktedir', () => {
    const red = mugPalette('Kırmızı');
    expect(red.handle).not.toBe(red.body);
    expect(mugPalette('KIRMIZI')).toEqual(red);
  });

  it('Beyaz ve bilinmeyen renkte kulp gövdeyle aynıdır', () => {
    const white = mugPalette('Beyaz');
    expect(white.handle).toBe(white.body);
    expect(mugPalette(undefined)).toEqual(white);
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
