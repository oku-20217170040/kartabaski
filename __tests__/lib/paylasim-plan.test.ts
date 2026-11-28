import { durumHesapla, planla } from '@/lib/paylasim/plan';
import { isDue, slotTimes } from '@/lib/paylasim/zaman';
import { VARSAYILAN_AYAR, type Paylasim, type PaylasimUrun } from '@/lib/paylasim/types';
import { trTime } from '@/lib/tr-time';

const NOW = trTime('2026-11-28', 12);
const u: PaylasimUrun = {
  id: 'a', title: 'A', slug: 'a', category: 'Lüks Kupa', shortDesc: '', deliveryDays: 3, createdAt: 1, images: ['i1'],
  colors: [{ name: 'Siyah', images: ['s1'] }], tiers: [{ label: '1 adet', price: '250 ₺' }],
};
const base = { products: [u], items: [] as Paylasim[], ayar: VARSAYILAN_AYAR, imageUsedAt: {}, white: {}, now: NOW };
const item = (over: Partial<Paylasim>): Paylasim => ({
  key: 'k|a|mix', kind: 'karusel', productId: 'a', color: '', imageIds: ['i1'], at: NOW, status: 'bekliyor', caption: '', targets: {}, createdAt: 1, ...over,
});

describe('zaman', () => {
  it('yalnız gelecek saatleri verir', () => {
    expect(slotTimes(['11:00', '18:00'], NOW, 2)).toEqual([trTime('2026-11-28', 18), trTime('2026-11-29', 11), trTime('2026-11-29', 18)]);
  });
  it('vakti geçen paylaşım yalnız aynı gün içinde yayınlanır', () => {
    expect(isDue(trTime('2026-11-28', 11), NOW)).toBe(true);
    expect(isDue(trTime('2026-11-27', 18), NOW)).toBe(false);
  });
});

describe('planla', () => {
  it('karuselleri sırayla boş saatlere, hikâyeleri her saate koyar', () => {
    const r = planla(base);
    const k = r.create.filter((p) => p.kind === 'karusel');
    expect(k.map((p) => p.key)).toEqual(['k|a|mix', 'k|a|r|Siyah']);
    expect(k[0].at).toBe(trTime('2026-11-28', 18));
    expect(r.create.filter((p) => p.kind === 'hikaye')[0].key).toBe('h|2026-11-28 14:00');
  });
  it('önceki günden kalan karusel yeni saate taşınır, hikâye iptal edilir', () => {
    const old = trTime('2026-11-27', 18);
    const r = planla({ ...base, items: [item({ at: old }), item({ key: 'h|eski', kind: 'hikaye', at: old })] });
    expect(r.move).toEqual([{ key: 'k|a|mix', at: trTime('2026-11-28', 18) }]);
    expect(r.cancel).toEqual(['h|eski']);
  });
  it('yarım kalıp günü geçen paylaşım sonucuyla kapanır', () => {
    const old = item({ at: trTime('2026-11-27', 18), targets: { instagram: { status: 'tamam', attempts: 1 } } });
    expect(planla({ ...base, items: [old] }).close).toEqual([{ key: 'k|a|mix', status: 'kismi' }]);
  });
  it('uygunluğunu yitiren ürünün bekleyen paylaşımı kaldırılır', () => {
    expect(planla({ ...base, products: [], items: [item({ at: trTime('2026-11-28', 18) })] }).remove).toEqual(['k|a|mix']);
  });
  it('yayınlanmış ya da iptal edilmiş karusel yeniden üretilmez', () => {
    const r = planla({ ...base, items: [item({ status: 'yayinlandi' }), item({ key: 'k|a|r|Siyah', color: 'Siyah', status: 'iptal' })] });
    expect(r.create.filter((p) => p.kind === 'karusel')).toEqual([]);
  });
});

describe('durumHesapla', () => {
  const ok = { status: 'tamam' as const, attempts: 1 };
  const bad = { status: 'hata' as const, attempts: 3 };
  it('hepsi bittiyse sonuca göre', () => {
    expect(durumHesapla({ instagram: ok, facebook: { status: 'atlandi', attempts: 0 } }, ['instagram', 'facebook'])).toBe('yayinlandi');
    expect(durumHesapla({ instagram: ok, facebook: bad }, ['instagram', 'facebook'])).toBe('kismi');
    expect(durumHesapla({ instagram: bad }, ['instagram'])).toBe('hata');
  });
  it('denenecek hedef kaldıysa bekliyor', () => {
    expect(durumHesapla({ instagram: ok }, ['instagram', 'facebook'])).toBe('bekliyor');
  });
});
