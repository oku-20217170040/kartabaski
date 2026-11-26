import { DEFAULT_PLACEMENT, MAX_SCALE, MIN_SCALE, clampPlacement, photoRect } from '@/lib/photo-layout';
import { parseOrderInput, OrderInputSchema, customerView, maskPhone, orderMessage, shortName, OrderRequest } from '@/lib/siparis-types';
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

describe('sipariş', () => {
  const token = 'a'.repeat(32);
  const input = {
    items: [{ productId: 'abc_1', qty: 2, photoCount: 1, hasPreview: false, text: 'Elif' }],
    name: 'Ayşe Yılmaz', phone: '0555 111 22 33', city: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik Mahallesi', street: '372. Sokak', buildingNo: '12', postalCode: '35100', kvkk: true,
  };

  it('WhatsApp mesajında yalnızca bağlantı vardır', () => {
    expect(orderMessage(token, 'https://www.kartabaski.com')).toBe(`Siparişim: https://www.kartabaski.com/siparis/${token}`);
  });

  it('ad ve telefon yeterli; onaysız, boş ya da bozuk sipariş reddedilir', () => {
    expect(OrderInputSchema.safeParse(input).success).toBe(true);
    expect(OrderInputSchema.safeParse({ ...input, kvkk: false }).success).toBe(false);
    expect(OrderInputSchema.safeParse({ ...input, items: [] }).success).toBe(false);
    expect(OrderInputSchema.safeParse({ ...input, phone: '123' }).success).toBe(false);
    expect(OrderInputSchema.safeParse({ ...input, website: 'bot' }).success).toBe(false);
    expect(OrderInputSchema.safeParse({ ...input, items: [{ productId: 'a/b', qty: 1, photoCount: 0, hasPreview: false }] }).success).toBe(false);
    expect(OrderInputSchema.safeParse({ ...input, items: [{ productId: 'a', qty: 1, photoCount: 9, hasPreview: false }] }).success).toBe(false);
  });

  it('hata mesajları Türkçedir', () => {
    const message = (data: unknown) => parseOrderInput(data).error?.issues[0]?.message ?? '';
    expect(message({ ...input, website: 'bot' })).toBe('Sipariş gönderilemedi. Sayfayı yenileyip tekrar deneyin.');
    expect(message(null)).toContain('Sipariş bilgileri geçersiz');
    expect(message({ ...input, items: [{ ...input.items[0], qty: 9999 }] })).toContain('Sipariş bilgileri geçersiz');
    expect(message({ ...input, phone: '1' })).toBe('Geçerli bir telefon numarası girin');
  });

  it('müşteri görünümünde iletişim bilgisi maskelenir, adres ve iç not gitmez', () => {
    const view = customerView({
      token, createdAt: 1, updatedAt: 1, status: 'yeni', items: [], total: 0,
      name: 'Ayşe Yılmaz', phone: '0545 826 65 08', address: 'Gizli sokak', adminNote: 'iç',
    } as OrderRequest);
    expect(view.phone).toBe('0545 *** ** 08');
    expect(view.name).toBe('Ayşe Y.');
    expect(JSON.stringify(view)).not.toContain('Gizli');
    expect(view).not.toHaveProperty('adminNote');
    expect(maskPhone('123')).toBe('***');
    expect(shortName('Ali')).toBe('Ali');
  });

  it('sipariş bağlantısı istatistiğe yazılmaz', () => {
    expect(classifyPath(`/siparis/${token}`).kind).toBe('skip');
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
