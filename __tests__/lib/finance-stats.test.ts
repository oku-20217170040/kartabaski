import { computeFinanceSummary, computeSalesStats, computeExpenseStats, periodRange, saleProfit, netProfit } from '@/lib/finance-stats';
import type { SaleRecord } from '@/lib/finance-types';
import type { ExpenseRecord } from '@/lib/expense-types';

const D = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 9); // 12:00 TSİ
const NOW = D(2026, 11, 15);

const sale = (over: Partial<SaleRecord>): SaleRecord => ({
  id: Math.random().toString(36).slice(2), date: D(2026, 11, 3), title: 'Kupa', category: 'Lüks Kupa',
  qty: 1, unitPrice: 100, channel: 'WhatsApp', ...over,
});
const exp = (over: Partial<ExpenseRecord>): ExpenseRecord => ({ id: 'e' + Math.random(), date: D(2026, 11, 5), category: 'Kira', amountTRY: 500, ...over });

describe('saleProfit', () => {
  it('adet, birim maliyet ve kargo/ek maliyeti hesaba katar', () => {
    expect(saleProfit(sale({ qty: 10, unitPrice: 120, unitCost: 45, extraCost: 80 }))).toBe(1200 - 450 - 80);
  });
  it('birim maliyet yoksa null döner', () => {
    expect(saleProfit(sale({}))).toBeNull();
  });
});

describe('computeSalesStats', () => {
  const records = [
    sale({ qty: 10, unitPrice: 100, unitCost: 40, orderId: 'o1' }),
    sale({ qty: 5, unitPrice: 200, unitCost: 80, extraCost: 50, orderId: 'o1', channel: 'Instagram', category: 'Sihirli Kupa' }),
    sale({ qty: 2, unitPrice: 150, date: D(2026, 11, 10) }), // maliyet yok
    sale({ qty: 1, unitPrice: 300, unitCost: 100, date: D(2026, 9, 5) }), // önceki ay
  ];
  const [from, to] = periodRange('month', NOW);
  const s = computeSalesStats(records, from, to, 6, NOW, [exp({}), exp({ date: D(2026, 10, 2), amountTRY: 200 })]);

  it('yalnızca seçili dönemi toplar', () => {
    expect(s.count).toBe(3);
    expect(s.revenue).toBe(1000 + 1000 + 300);
    expect(s.units).toBe(17);
  });
  it('aynı işin satırları tek sipariş sayılır', () => {
    expect(s.orders).toBe(2);
    expect(s.avgOrder).toBeCloseTo(2300 / 2);
  });
  it('kâr yalnızca maliyeti bilinen satırlardan gelir', () => {
    expect(s.profit).toBe(600 + (1000 - 400 - 50));
    expect(s.missingCost).toBe(1);
  });
  it('kategori ve kanal dökümü ciroya göre sıralanır', () => {
    expect(s.byChannel.map((g) => g.name)).toEqual(['WhatsApp', 'Instagram']);
    expect(s.byCategory.find((g) => g.name === 'Sihirli Kupa')?.revenue).toBe(1000);
  });
  it('aylık grafik 6 ay döner ve gider ekler', () => {
    expect(s.months).toHaveLength(6);
    const last = s.months[5];
    expect(last.key).toBe('2026-11');
    expect(last.expenses).toBe(500);
    expect(s.months[4].expenses).toBe(200);
    expect(s.months[3].revenue).toBe(300); // eylül
  });
});

describe('giderler ve net kâr', () => {
  it('kategori dökümü ve toplam', () => {
    const s = computeExpenseStats([exp({}), exp({ category: 'Mürekkep', amountTRY: 900 })], 0, NOW + 1e9);
    expect(s.total).toBe(1400);
    expect(s.byCategory[0]).toEqual(['Mürekkep', 900]);
  });
  it('net kâr = brüt kâr - gider', () => expect(netProfit(1000, 400)).toBe(600));
});

describe('computeFinanceSummary', () => {
  it('son 12 ayı döner ve toplamlar aylarla tutarlıdır', () => {
    const r = computeFinanceSummary(
      [sale({ qty: 2, unitPrice: 100, unitCost: 30 }), sale({ date: D(2025, 12, 20), unitPrice: 50, unitCost: 10 })],
      [exp({ amountTRY: 100 })],
      NOW,
    );
    expect(r.months).toHaveLength(12);
    expect(r.months[0].month).toBe('2025-12');
    expect(r.months[11].month).toBe('2026-11');
    expect(r.revenue).toBe(250);
    expect(r.grossProfit).toBe(140 + 40);
    expect(r.expenses).toBe(100);
    expect(r.netProfit).toBe(80);
    expect(r.months.reduce((s, m) => s + m.revenue, 0)).toBe(r.revenue);
  });
});
