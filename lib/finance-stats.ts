import type { SaleRecord } from './finance-types';
import type { ExpenseRecord } from './expense-types';
import { TR_OFFSET_MS, trMonthKey } from './tr-time';

// Tüm ay/dönem hesapları Türkiye saatine (UTC+3) göre yapılır: sunucu ve tarayıcı aynı sonucu verir.

export interface MonthBucket { key: string; label: string; revenue: number; profit: number; expenses: number; count: number }
export interface GroupRow { name: string; revenue: number; profit: number; units: number; count: number }

export interface SalesStats {
  count: number;        // satır sayısı
  orders: number;       // tekil sipariş sayısı (aynı işin satırları tek sayılır)
  units: number;        // toplam adet
  revenue: number;
  cost: number;         // yalnızca maliyeti bilinen satırların maliyeti (ek maliyet dahil)
  profit: number;       // yalnızca maliyeti bilinen satırların kârı
  margin: number;       // kâr / ciro (maliyeti bilinenler üzerinden), 0-1
  avgOrder: number;     // ortalama sipariş tutarı
  missingCost: number;  // birim maliyeti girilmemiş satır sayısı
  months: MonthBucket[];
  byCategory: GroupRow[];
  byChannel: GroupRow[];
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAY = 86400000;

export const saleRevenue = (r: SaleRecord): number => r.qty * r.unitPrice;
export const saleHasCost = (r: SaleRecord): boolean => typeof r.unitCost === 'number';
/** Maliyeti bilinmiyorsa null. */
export const saleProfit = (r: SaleRecord): number | null =>
  typeof r.unitCost === 'number' ? saleRevenue(r) - r.qty * r.unitCost - (r.extraCost ?? 0) : null;

export const monthKey = (ts: number): string => trMonthKey(ts);

/** TSİ ay başlangıcı (ms). month0: 0-11, taşan değerler yıla yansır. */
export function trMonthStart(year: number, month0: number): number {
  return Date.UTC(year, month0, 1) - TR_OFFSET_MS;
}

function trYearMonth(ts: number): [number, number] {
  const [y, m] = trMonthKey(ts).split('-').map(Number);
  return [y, m - 1];
}

/** Son `count` ayın anahtarları (eskiden yeniye), `end` anının ayı dahil. */
export function lastMonthKeys(end: number, count: number): { key: string; label: string }[] {
  const [y, m] = trYearMonth(end);
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = trMonthStart(y, m - i);
    out.push({ key: trMonthKey(start), label: MONTHS[Number(trMonthKey(start).slice(5)) - 1] });
  }
  return out;
}

export type PeriodKind = 'month' | 'last3' | 'year' | 'all';

export function periodRange(kind: PeriodKind, now = Date.now()): [number, number] {
  const [y, m] = trYearMonth(now);
  const end = now + DAY; // bugünü kapsa
  if (kind === 'month') return [trMonthStart(y, m), end];
  if (kind === 'last3') return [trMonthStart(y, m - 2), end];
  if (kind === 'year') return [trMonthStart(y, 0), end];
  return [0, end];
}

function group(rows: SaleRecord[], by: (r: SaleRecord) => string): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const r of rows) {
    const k = by(r);
    const g = map.get(k) ?? { name: k, revenue: 0, profit: 0, units: 0, count: 0 };
    g.revenue += saleRevenue(r);
    g.units += r.qty;
    g.count++;
    g.profit += saleProfit(r) ?? 0;
    map.set(k, g);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export const orderKey = (r: SaleRecord): string => r.orderId ?? r.sepetTalebiId ?? r.id;

/** [from, to) aralığındaki satışlardan istatistik üretir; grafik için son `monthCount` ayı da döner. */
export function computeSalesStats(
  records: SaleRecord[],
  from: number,
  to: number,
  monthCount = 6,
  now = Date.now(),
  expenses: ExpenseRecord[] = [],
): SalesStats {
  const rows = records.filter((r) => r.date >= from && r.date < to);

  let revenue = 0, cost = 0, profit = 0, costRevenue = 0, missingCost = 0, units = 0;
  const orderIds = new Set<string>();
  for (const r of rows) {
    const rev = saleRevenue(r);
    revenue += rev;
    units += r.qty;
    orderIds.add(orderKey(r));
    const p = saleProfit(r);
    if (p !== null) {
      cost += rev - p;
      profit += p;
      costRevenue += rev;
    } else {
      missingCost++;
    }
  }

  const endTs = Math.min(to, now + DAY) - 1;
  const buckets: MonthBucket[] = lastMonthKeys(endTs, monthCount).map((b) => ({ ...b, revenue: 0, profit: 0, expenses: 0, count: 0 }));
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of records) {
    const i = idx.get(monthKey(r.date));
    if (i === undefined) continue;
    buckets[i].revenue += saleRevenue(r);
    buckets[i].count++;
    buckets[i].profit += saleProfit(r) ?? 0;
  }
  for (const e of expenses) {
    const i = idx.get(monthKey(e.date));
    if (i !== undefined) buckets[i].expenses += e.amountTRY;
  }

  return {
    count: rows.length,
    orders: orderIds.size,
    units,
    revenue,
    cost,
    profit,
    margin: costRevenue > 0 ? profit / costRevenue : 0,
    avgOrder: orderIds.size > 0 ? revenue / orderIds.size : 0,
    missingCost,
    months: buckets,
    byCategory: group(rows, (r) => r.category),
    byChannel: group(rows, (r) => r.channel),
  };
}

export interface ExpenseStats {
  count: number;
  total: number;
  byCategory: [string, number][];
}

/** [from, to) aralığındaki giderlerin toplamı ve kategori dökümü. */
export function computeExpenseStats(expenses: ExpenseRecord[], from: number, to: number): ExpenseStats {
  const inRange = expenses.filter((e) => e.date >= from && e.date < to);
  const map = new Map<string, number>();
  let total = 0;
  for (const e of inRange) {
    total += e.amountTRY;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amountTRY);
  }
  return {
    count: inRange.length,
    total,
    byCategory: Array.from(map.entries()).sort((a, b) => b[1] - a[1]),
  };
}

/** Net kâr = brüt kâr (ciro − maliyet) − giderler. */
export const netProfit = (grossProfit: number, expenseTotal: number): number => grossProfit - expenseTotal;

export interface FinanceSummary {
  revenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  orders: number;
  units: number;
  months: { month: string; revenue: number; profit: number; expenses: number }[];
}

/** Son 12 ayın özeti (Genel Bakış için). */
export function computeFinanceSummary(sales: SaleRecord[], expenses: ExpenseRecord[], now = Date.now()): FinanceSummary {
  const keys = lastMonthKeys(now, 12);
  const [cy, cm] = trYearMonth(now);
  const from = trMonthStart(cy, cm - 11);
  const to = now + DAY;
  const s = computeSalesStats(sales, from, to, 12, now, expenses);
  const exp = computeExpenseStats(expenses, from, to);
  return {
    revenue: s.revenue,
    grossProfit: s.profit,
    expenses: exp.total,
    netProfit: netProfit(s.profit, exp.total),
    orders: s.orders,
    units: s.units,
    months: s.months.map((b, i) => ({ month: keys[i].key, revenue: b.revenue, profit: b.profit, expenses: b.expenses })),
  };
}
