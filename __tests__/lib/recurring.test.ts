import { dueMonths } from '@/lib/recurring';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 15, 0, 0);

describe('dueMonths (aylık tekrarlayan gider)', () => {
  it('başlangıç ayından bugüne her ay için bir kayıt üretir', () => {
    const r = dueMonths({ dayOfMonth: 5, startMonth: '2026-07' }, at(2026, 10, 10));
    expect(r.map((x) => x.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
  });

  it('bu ayın günü henüz gelmediyse bu ayı eklemez', () => {
    const r = dueMonths({ dayOfMonth: 20, startMonth: '2026-09' }, at(2026, 10, 10));
    expect(r.map((x) => x.month)).toEqual(['2026-09']);
  });

  it('gün tam bugünse (öğleden sonra) bu ayı ekler', () => {
    const r = dueMonths({ dayOfMonth: 10, startMonth: '2026-10' }, at(2026, 10, 10));
    expect(r.map((x) => x.month)).toEqual(['2026-10']);
  });

  it('31. gün kısa aylarda ayın son gününe iner', () => {
    const r = dueMonths({ dayOfMonth: 31, startMonth: '2026-02' }, at(2026, 4, 30));
    const days = r.map((x) => new Date(x.date).getDate());
    expect(r.map((x) => x.month)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(days).toEqual([28, 31, 30]);
  });

  it('gelecekteki başlangıç ayı için kayıt üretmez', () => {
    expect(dueMonths({ dayOfMonth: 1, startMonth: '2027-01' }, at(2026, 10, 10))).toEqual([]);
  });

  it('yıl geçişini doğru yapar', () => {
    const r = dueMonths({ dayOfMonth: 1, startMonth: '2026-11' }, at(2027, 1, 15));
    expect(r.map((x) => x.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('geçersiz başlangıç ayında boş döner', () => {
    expect(dueMonths({ dayOfMonth: 1, startMonth: 'bozuk' }, at(2026, 10, 10))).toEqual([]);
  });
});
