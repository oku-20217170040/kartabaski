import { fmtPct, fmtTL } from './finance-format';
import { DAY_MS, trDayKey, trHour, trWeekday } from './tr-time';
import {
  ACTIVE_STATUSES, ORDER_STATUS_LABELS, PRE_PRINT_STATUSES, isDueToday, isLate, lateDays, orderTitle, orderTotal, orderUnits,
  emptyStatusCounts, type Order, type OrderStatus,
} from './orders-utils';

// "Makine": atölyeyi sipariş → tasarım → baskı → paketleme → kargo → teslim hattı olarak ölçen saf hesaplar.

const WINDOW_DAYS = 30;
const FORECAST_DAYS = 14;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface LateRow { id: string; title: string; customer?: string; status: OrderStatus; lateDays: number }
export interface RankRow { name: string; qty: number; revenue: number }
export interface MaterialRow { category: string; needNow: number; forecast: number }

export interface Constraint { key: 'gecikme' | 'yanit' | 'kuyruk' | 'iptal' | 'belirsiz'; label: string; why: string }

export interface MachineView {
  days: number;
  created: number;            // pencerede açılan iş
  delivered: number;          // pencerede teslim edilen
  cancelled: number;
  active: number;             // şu an açık iş
  revenue: number;            // pencerede açılan (iptal hariç) işlerin tutarı
  avgLeadDays: number | null; // açılıştan teslime ortalama gün
  medianLeadDays: number | null;
  onTimePct: number | null;   // zamanında teslim oranı, 0-1
  unsettled: number;          // teslim edilmiş ama muhasebeye işlenmemiş
  byStatus: Record<OrderStatus, number>;
  late: LateRow[];
  dueToday: number;
  topCategories: RankRow[];
  topProducts: RankRow[];
  materials: MaterialRow[];
  totalNeedNow: number;
  totalForecast: number;
  constraint: Constraint;
}

function rank(rows: { name: string; qty: number; revenue: number }[], limit: number): RankRow[] {
  const map = new Map<string, RankRow>();
  for (const r of rows) {
    const cur = map.get(r.name) ?? { name: r.name, qty: 0, revenue: 0 };
    cur.qty += r.qty;
    cur.revenue += r.revenue;
    map.set(r.name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, limit);
}

export interface ConstraintInput { late: number; waitingOver24h: number; queue: number; created: number; cancelled: number }

/** Sıra önemli: geciken müşteri sözü en pahalı kayıptır. */
export function detectConstraint(i: ConstraintInput): Constraint {
  if (i.late >= 3) return { key: 'gecikme', label: 'Geciken işler', why: `${i.late} iş sözlü teslim tarihini geçti. Önce bunları bitir ve müşteriyi bilgilendir.` };
  if (i.waitingOver24h >= 3) return { key: 'yanit', label: 'Yeni işlere geç dönülüyor', why: `${i.waitingOver24h} yeni iş 24 saatten uzun süredir tasarıma alınmadı.` };
  if (i.queue >= 10) return { key: 'kuyruk', label: 'Tasarım/baskı kuyruğu', why: `${i.queue} iş tasarım ve baskı aşamasında bekliyor. Baskı kapasitesi darboğaz olabilir.` };
  if (i.created >= 5 && i.cancelled / i.created > 0.25) return { key: 'iptal', label: 'İptal oranı yüksek', why: `Son işlerin ${fmtPct(i.cancelled / i.created)} kadarı iptal edildi. İptal nedenlerine bak.` };
  return { key: 'belirsiz', label: 'Belirgin tıkanma yok', why: 'Hat akıyor; veri biriktikçe darboğaz daha net görünür.' };
}

export function computeMachine(input: { orders: Order[]; now: number; days?: number }): MachineView {
  const { orders, now, days = WINDOW_DAYS } = input;
  const from = now - days * DAY_MS;
  const byStatus = emptyStatusCounts();
  for (const o of orders) if (ACTIVE_STATUSES.includes(o.status)) byStatus[o.status]++;

  const inWindow = orders.filter((o) => o.createdAt >= from);
  const live = inWindow.filter((o) => o.status !== 'iptal');
  const deliveredList = orders.filter((o) => o.status === 'teslim' && (o.deliveredAt ?? 0) >= from);
  const leads = deliveredList.map((o) => ((o.deliveredAt as number) - o.createdAt) / DAY_MS);
  const onTime = deliveredList.filter((o) => trDayKey(o.deliveredAt as number) <= trDayKey(o.dueAt)).length;

  const open = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const late: LateRow[] = open
    .filter((o) => isLate(o, now))
    .map((o) => ({ id: o.id, title: orderTitle(o), ...(o.customerName ? { customer: o.customerName } : {}), status: o.status, lateDays: lateDays(o, now) }))
    .sort((a, b) => b.lateDays - a.lateDays);

  const lines = live.flatMap((o) => o.items.map((i) => ({ o, i })));
  const topCategories = rank(lines.map(({ i }) => ({ name: i.category ?? 'Özel Tasarım', qty: i.qty, revenue: i.qty * i.unitPrice })), 6);
  const topProducts = rank(lines.map(({ i }) => ({ name: i.title, qty: i.qty, revenue: i.qty * i.unitPrice })), 6);

  // Malzeme: baskıya girmemiş işlerin kupa adedi + son 30 günlük hızdan 14 günlük tahmin
  const need = new Map<string, number>();
  for (const o of open) {
    if (!PRE_PRINT_STATUSES.includes(o.status)) continue;
    for (const i of o.items) need.set(i.category ?? 'Özel Tasarım', (need.get(i.category ?? 'Özel Tasarım') ?? 0) + i.qty);
  }
  const rate = new Map<string, number>();
  const since30 = now - 30 * DAY_MS;
  for (const o of orders) {
    if (o.status === 'iptal' || o.createdAt < since30) continue;
    for (const i of o.items) rate.set(i.category ?? 'Özel Tasarım', (rate.get(i.category ?? 'Özel Tasarım') ?? 0) + i.qty);
  }
  const cats = new Set(Array.from(need.keys()).concat(Array.from(rate.keys())));
  const materials: MaterialRow[] = Array.from(cats)
    .map((category) => ({ category, needNow: need.get(category) ?? 0, forecast: Math.ceil(((rate.get(category) ?? 0) / 30) * FORECAST_DAYS) }))
    .sort((a, b) => b.needNow + b.forecast - (a.needNow + a.forecast));

  const waitingOver24h = open.filter((o) => o.status === 'yeni' && now - (o.stageAt?.yeni ?? o.createdAt) > DAY_MS).length;
  const cancelled = inWindow.length - live.length;

  return {
    days,
    created: inWindow.length,
    delivered: deliveredList.length,
    cancelled,
    active: open.length,
    revenue: live.reduce((s, o) => s + orderTotal(o), 0),
    avgLeadDays: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null,
    medianLeadDays: median(leads),
    onTimePct: deliveredList.length ? onTime / deliveredList.length : null,
    unsettled: orders.filter((o) => o.status === 'teslim' && !o.settled).length,
    byStatus,
    late,
    dueToday: open.filter((o) => isDueToday(o, now)).length,
    topCategories,
    topProducts,
    materials,
    totalNeedNow: materials.reduce((s, m) => s + m.needNow, 0),
    totalForecast: materials.reduce((s, m) => s + m.forecast, 0),
    constraint: detectConstraint({
      late: late.length,
      waitingOver24h,
      queue: byStatus.tasarim + byStatus.baski,
      created: inWindow.length,
      cancelled,
    }),
  };
}

/** Özet belgeye (machine_stats/main) yazılan küçük görüntü: Genel Bakış ve geçmiş kıyası için. */
export interface MachineSnapshot {
  updatedAt: number;
  lastWeeklyAt?: number;
  days: number;
  created: number;
  delivered: number;
  active: number;
  late: number;
  dueToday: number;
  onTimePct: number | null;
  avgLeadDays: number | null;
  revenue: number;
  totalNeedNow: number;
  totalForecast: number;
  topCategories: RankRow[];
  constraint: string;
}

export function toSnapshotFields(m: MachineView, now: number): Omit<MachineSnapshot, 'lastWeeklyAt'> {
  return {
    updatedAt: now,
    days: m.days,
    created: m.created,
    delivered: m.delivered,
    active: m.active,
    late: m.late.length,
    dueToday: m.dueToday,
    onTimePct: m.onTimePct,
    avgLeadDays: m.avgLeadDays,
    revenue: m.revenue,
    totalNeedNow: m.totalNeedNow,
    totalForecast: m.totalForecast,
    topCategories: m.topCategories,
    constraint: m.constraint.label,
  };
}

/** Pazartesi 09:00 TSİ sonrası, son rapordan en az 6 gün geçtiyse. */
export function weeklyDue(now: number, lastWeeklyAt: number | undefined): boolean {
  return trWeekday(now) === 1 && trHour(now) >= 9 && now - (lastWeeklyAt ?? 0) > 6 * DAY_MS;
}

/** Telegram haftalık raporu (düz metin). */
export function buildMachineReport(m: MachineView, days = m.days): string {
  const lines = [
    `Makine raporu - son ${days} gün`,
    '',
    `Durum: ${m.constraint.label}`,
    m.constraint.why,
    '',
    `${m.created} yeni iş, ${m.delivered} teslim, ${m.cancelled} iptal, ${m.active} açık`,
    `Ciro (açılan işler): ${fmtTL(m.revenue)}`,
    m.avgLeadDays !== null ? `Ortalama teslim süresi: ${m.avgLeadDays.toFixed(1).replace('.', ',')} gün` : '',
    m.onTimePct !== null ? `Zamanında teslim: ${fmtPct(m.onTimePct)}` : '',
    '',
    `Hat: ${(['yeni', 'tasarim', 'baski', 'paketleme', 'kargoda'] as OrderStatus[]).map((s) => `${ORDER_STATUS_LABELS[s]} ${m.byStatus[s]}`).join(' / ')}`,
    m.late.length ? `Geciken ${m.late.length} iş: ${m.late.slice(0, 5).map((l) => `${l.title} (${l.lateDays} gün)`).join(', ')}` : 'Geciken iş yok.',
    m.dueToday ? `Bugün teslim edilecek: ${m.dueToday}` : '',
    '',
    m.topCategories.length ? `En çok satan kategoriler: ${m.topCategories.slice(0, 3).map((c) => `${c.name} (${c.qty})`).join(', ')}` : '',
    m.topProducts.length ? `En çok satan ürünler: ${m.topProducts.slice(0, 3).map((c) => `${c.name} (${c.qty})`).join(', ')}` : '',
    `Malzeme: baskı bekleyen ${m.totalNeedNow} adet, önümüzdeki ${FORECAST_DAYS} gün için tahmini ${m.totalForecast} adet kupa/fincan`,
    m.unsettled ? `${m.unsettled} teslim edilmiş iş muhasebeye işlenmedi.` : '',
  ];
  return lines.filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n').trim();
}

/** Tek satırlık iş özeti (bildirimler için). */
export const orderSummaryLine = (o: Order): string => `${orderTitle(o)} · ${orderUnits(o)} adet · ${fmtTL(orderTotal(o))}`;
