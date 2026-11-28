/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }));
jest.mock('@/lib/require-admin', () => ({ requireAdmin: jest.fn().mockResolvedValue({ uid: 't' }) }));
jest.mock('@/lib/products-server', () => ({ getProductsServer: jest.fn().mockResolvedValue([{ id: 'a', slug: 'a', description: '• 1 adet: 300 ₺' }]) }));
jest.mock('@/lib/products-admin', () => ({ updateProduct: jest.fn() }));
jest.mock('@/lib/paylasim/depo', () => ({
  getAyar: jest.fn(), clearPending: jest.fn(), clearTarget: jest.fn(), getGorsel: jest.fn(), getItem: jest.fn(), listItems: jest.fn(), patchItem: jest.fn(), saveAyar: jest.fn(),
}));
jest.mock('@/lib/paylasim/tur', () => ({ runPaylasimStep: jest.fn(), hemenYayinla: jest.fn(), urunSatiri: jest.fn() }));

import { kademeOnayAction, yenileAction } from '@/lib/actions-paylasim';
import { clearPending, getAyar } from '@/lib/paylasim/depo';
import { runPaylasimStep } from '@/lib/paylasim/tur';

const mode = (m: 'onizleme' | 'canli') => (getAyar as jest.Mock).mockResolvedValue({ mode: m });
beforeEach(() => jest.clearAllMocks());

describe('önizlemede sıra yenileme', () => {
  it('fiyat onayında bekleyen sıra silinip yeniden kurulur', async () => {
    mode('onizleme');
    await expect(kademeOnayAction('a', [{ label: '1 adet', price: '300 ₺' }])).resolves.toEqual({});
    expect(clearPending).toHaveBeenCalled();
    expect(runPaylasimStep).toHaveBeenCalled();
    expect((clearPending as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((runPaylasimStep as jest.Mock).mock.invocationCallOrder[0]);
  });
  it('canlıda sıraya dokunulmaz', async () => {
    mode('canli');
    await kademeOnayAction('a', [{ label: '1 adet', price: '300 ₺' }]);
    await expect(yenileAction()).resolves.toEqual({ error: 'Sıra yalnız önizleme modunda yeniden kurulur.' });
    expect(clearPending).not.toHaveBeenCalled();
    expect(runPaylasimStep).not.toHaveBeenCalled();
  });
});
