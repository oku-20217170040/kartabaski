import { DEFAULT_PLACEMENT, MAX_SCALE, MIN_SCALE, clampPlacement, photoRect } from '@/lib/photo-layout';
import { DesignInputSchema, canCustomerEdit, designMessage } from '@/lib/design-types';
import { toAlpha, toModelInput } from '@/lib/remove-background';
import { classifyPath } from '@/lib/analytics-utils';

describe('fotoğraf yerleşimi', () => {
  it('sınır dışındaki değerleri kırpar', () => {
    expect(clampPlacement({ x: 5, y: -5, scale: 99, rotate: 195 }))
      .toEqual({ x: 0.6, y: -0.6, scale: MAX_SCALE, rotate: -165 });
    expect(clampPlacement({ x: NaN, y: 0, scale: 0.01, rotate: 0 }).scale).toBe(MIN_SCALE);
  });

  it('ölçek 1 iken fotoğrafı baskı alanının ortasına sığdırır', () => {
    const r = photoRect({ width: 600, height: 400 }, { width: 1000, height: 1000 }, DEFAULT_PLACEMENT);
    expect(r).toMatchObject({ cx: 300, cy: 200, width: 396, height: 396 });
  });

  it('yazı varsa fotoğraf üstteki alanda kalır', () => {
    const r = photoRect({ width: 600, height: 400 }, { width: 1000, height: 1000 }, DEFAULT_PLACEMENT, 0.32);
    expect(r.cy + r.height / 2).toBeLessThanOrEqual(400 * 0.68 + 0.001);
  });
});

describe('tasarım siparişi', () => {
  it('WhatsApp mesajında yalnızca bağlantı vardır', () => {
    expect(designMessage('a'.repeat(32), 'https://www.kartabaski.com'))
      .toBe(`Sipariş tasarımım: https://www.kartabaski.com/tasarim/${'a'.repeat(32)}`);
  });

  it('işleme alınan siparişi müşteri değiştiremez', () => {
    expect(canCustomerEdit('taslak')).toBe(true);
    expect(canCustomerEdit('yeni')).toBe(true);
    expect(canCustomerEdit('siparis')).toBe(false);
    expect(canCustomerEdit('iptal')).toBe(false);
  });

  it('geçersiz girdiyi reddeder', () => {
    expect(DesignInputSchema.safeParse({ productSlug: 'luks-kupa', color: 'Mavi' }).success).toBe(true);
    expect(DesignInputSchema.safeParse({ productSlug: '../x' }).success).toBe(false);
    expect(DesignInputSchema.safeParse({ productSlug: 'a', text: 'x'.repeat(41) }).success).toBe(false);
  });

  it('sipariş bağlantısı istatistiğe yazılmaz', () => {
    expect(classifyPath(`/tasarim/${'a'.repeat(32)}`).kind).toBe('skip');
  });
});

describe('arka plan silme yardımcıları', () => {
  it('pikselleri kanal sırasıyla normalleştirir', () => {
    const input = toModelInput(new Uint8ClampedArray([255, 0, 0, 255]), 1);
    expect(input).toHaveLength(3);
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229, 4);
    expect(input[1]).toBeCloseTo((0 - 0.456) / 0.224, 4);
  });

  it('maskeyi 0–255 aralığına yayar', () => {
    expect(Array.from(toAlpha(new Float32Array([0, 0.5, 1])))).toEqual([0, 128, 255]);
  });
});
