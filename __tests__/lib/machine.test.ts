import { buildMachineReport, computeMachine, detectConstraint, median, weeklyDue } from '@/lib/machine';
import { addBusinessDays, computeDueAt, isDueToday, isLate, nextStatus, orderTotal, type Order } from '@/lib/orders-utils';
import { trDayKey, trWeekday } from '@/lib/tr-time';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 9, 12); // Pazartesi 15:00 TSİ

const order = (id: string, over: Partial<Order> = {}): Order => ({
  id, status: 'yeni', channel: 'WhatsApp', createdAt: NOW - 2 * DAY, dueAt: NOW + 2 * DAY,
  items: [{ title: 'Latte Fincanı', category: 'Latte Fincanı', qty: 4, unitPrice: 150 }], ...over,
});

describe('iş günü ve teslim tarihi', () => {
  it('hafta sonunu atlar', () => {
    const fri = Date.UTC(2026, 10, 6, 9); // Cuma
    expect(trWeekday(fri)).toBe(5);
    const due = addBusinessDays(fri, 1);
    expect(trWeekday(due)).toBe(1);
    expect(trDayKey(due)).toBe('2026-11-09');
  });
  it('en uzun hazırlık süresi kullanılır, boşsa 3 iş günü', () => {
    const mon = Date.UTC(2026, 10, 9, 9);
    expect(trDayKey(computeDueAt(mon, [1, 4]))).toBe('2026-11-13');
    expect(trDayKey(computeDueAt(mon, []))).toBe('2026-11-12');
  });
});

describe('gecikme', () => {
  it('teslim günü geçen açık iş gecikmiştir; bugün teslim gecikmiş sayılmaz', () => {
    expect(isLate(order('a', { dueAt: NOW - DAY }), NOW)).toBe(true);
    expect(isLate(order('b', { dueAt: NOW }), NOW)).toBe(false);
    expect(isDueToday(order('b', { dueAt: NOW }), NOW)).toBe(true);
  });
  it('teslim edilmiş veya iptal iş gecikmez', () => {
    expect(isLate(order('c', { status: 'teslim', dueAt: NOW - 5 * DAY }), NOW)).toBe(false);
    expect(isLate(order('d', { status: 'iptal', dueAt: NOW - 5 * DAY }), NOW)).toBe(false);
  });
  it('durum akışı teslime ilerler', () => {
    expect(nextStatus('yeni')).toBe('tasarim');
    expect(nextStatus('kargoda')).toBe('teslim');
    expect(nextStatus('teslim')).toBeNull();
  });
  it('sipariş tutarı kalemlerin toplamıdır', () => expect(orderTotal(order('x'))).toBe(600));
});

describe('computeMachine', () => {
  const orders = [
    order('a', { status: 'baski' }),
    order('b', { status: 'tasarim', dueAt: NOW - 2 * DAY }),
    order('c', { status: 'teslim', createdAt: NOW - 6 * DAY, dueAt: NOW - 3 * DAY, deliveredAt: NOW - 4 * DAY, settled: true }),
    order('d', { status: 'teslim', createdAt: NOW - 8 * DAY, dueAt: NOW - 5 * DAY, deliveredAt: NOW - DAY }),
    order('e', { status: 'iptal' }),
    order('f', { status: 'kargoda', items: [{ title: 'Sihirli Kupa', category: 'Sihirli Kupa', qty: 20, unitPrice: 200 }] }),
  ];
  const m = computeMachine({ orders, now: NOW });

  it('durum, gecikme ve teslim metrikleri', () => {
    expect(m.active).toBe(3);
    expect(m.byStatus.baski).toBe(1);
    expect(m.late.map((l) => l.id)).toEqual(['b']);
    expect(m.delivered).toBe(2);
    expect(m.onTimePct).toBe(0.5); // c zamanında, d geç
    expect(m.avgLeadDays).toBeCloseTo((2 + 7) / 2);
    expect(m.unsettled).toBe(1);
    expect(m.cancelled).toBe(1);
  });
  it('en çok satan kategori adede göre', () => {
    expect(m.topCategories[0].name).toBe('Sihirli Kupa');
    expect(m.topCategories[0].qty).toBe(20);
  });
  it('malzeme: baskıya girmemiş işlerin adedi ve 14 günlük tahmin', () => {
    const latte = m.materials.find((r) => r.category === 'Latte Fincanı')!;
    expect(latte.needNow).toBe(8); // a (baskı) + b (tasarım)
    expect(latte.forecast).toBe(Math.ceil((16 / 30) * 14)); // a, b, c, d: 4 iş x 4 adet (iptal hariç)
  });
  it('rapor metni temel başlıkları içerir', () => {
    const t = buildMachineReport(m);
    expect(t).toContain('Makine raporu');
    expect(t).toContain('Zamanında teslim: %50');
  });
});

describe('kısıt ve zamanlama', () => {
  const base = { late: 0, waitingOver24h: 0, queue: 0, created: 0, cancelled: 0 };
  it('sırayla gecikme, yanıt, kuyruk, iptal', () => {
    expect(detectConstraint({ ...base, late: 3 }).key).toBe('gecikme');
    expect(detectConstraint({ ...base, waitingOver24h: 3 }).key).toBe('yanit');
    expect(detectConstraint({ ...base, queue: 10 }).key).toBe('kuyruk');
    expect(detectConstraint({ ...base, created: 8, cancelled: 3 }).key).toBe('iptal');
    expect(detectConstraint(base).key).toBe('belirsiz');
  });
  it('haftalık rapor yalnızca pazartesi 09:00 sonrası ve 6 günde bir', () => {
    expect(weeklyDue(NOW, undefined)).toBe(true);
    expect(weeklyDue(NOW, NOW - 3 * DAY)).toBe(false);
    expect(weeklyDue(NOW - DAY, undefined)).toBe(false); // pazar
    expect(weeklyDue(Date.UTC(2026, 10, 9, 3), undefined)).toBe(false); // 06:00 TSİ
  });
  it('medyan', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
