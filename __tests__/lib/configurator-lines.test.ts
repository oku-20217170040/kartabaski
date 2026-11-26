import { cupToProduct, isCupId, lineHref } from '@/lib/configurator-lines';
import { parseStoredCart } from '@/lib/cart';
import { OrderInputSchema } from '@/lib/siparis-types';
import type { ConfiguratorCup } from '@/types';

const cup = {
  id: 'abc123', code: 'LK', name: 'Luks Kupa', price: 250, imagePublicId: 'img', active: true, order: 1,
  colors: [{ name: 'Mavi', images: ['m'] }, { name: 'Boş', images: [] }], createdAt: 0, updatedAt: 0,
} as ConfiguratorCup;

describe('konfigüratör satırları', () => {
  it('bardak sepete ürün olarak girer; görselsiz renk atılır', () => {
    const p = cupToProduct(cup);
    expect(p.id).toBe('cfg_abc123');
    expect(p.slug).toBe('konfig-abc123');
    expect(p.priceMin).toBe(250);
    expect(p.colors?.map((c) => c.name)).toEqual(['Mavi']);
    expect(isCupId(p.id)).toBe(true);
    expect(isCupId('abc123')).toBe(false);
  });

  it('satır bağlantısı konfigüratöre ya da ürün sayfasına gider', () => {
    expect(lineHref('konfig-abc123')).toBe('/konfigurator');
    expect(lineHref('luks-kupa')).toBe('/urun/luks-kupa');
  });

  it('hazır tasarım sepet kaydından okunur, bozuk kimlik atılır', () => {
    const line = (ready: unknown) => JSON.stringify([{ key: 'd:1', productId: 'cfg_abc123', title: 'K', qty: 1, design: { photos: [], ready } }]);
    expect(parseStoredCart(line({ id: 'des1', name: 'Serçe', image: 'x' }))[0].design?.ready).toEqual({ id: 'des1', name: 'Serçe', image: 'x' });
    expect(parseStoredCart(line({ id: '../x', name: 'Serçe' }))[0].design?.ready).toBeUndefined();
  });

  it('sipariş girdisi bardak ve hazır tasarım kimliğini kabul eder', () => {
    const input = (readyId: string) => ({
      items: [{ productId: 'cfg_abc123', qty: 1, photoCount: 0, hasPreview: false, readyId }],
      name: 'Ali Veli', phone: '0555 111 22 33', city: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik Mahallesi', street: '372. Sokak', buildingNo: '12', postalCode: '35100', kvkk: true,
    });
    expect(OrderInputSchema.safeParse(input('des1')).success).toBe(true);
    expect(OrderInputSchema.safeParse(input('a/b')).success).toBe(false);
  });
});
