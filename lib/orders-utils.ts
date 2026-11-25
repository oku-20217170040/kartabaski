import { DAY_MS, trDayKey, trTime, trWeekday } from './tr-time';
import type { SaleChannel } from './finance-types';

// Üretim hattı ("işler"): yeni → tasarım → baskı → paketleme → kargoda → teslim (+ iptal).

export const ORDER_STATUSES = ['yeni', 'tasarim', 'baski', 'paketleme', 'kargoda', 'teslim', 'iptal'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  yeni: 'Yeni',
  tasarim: 'Tasarım',
  baski: 'Baskı',
  paketleme: 'Paketleme',
  kargoda: 'Kargoda',
  teslim: 'Teslim edildi',
  iptal: 'İptal',
};

/** Akış sırası (iptal hariç). */
export const FLOW: OrderStatus[] = ['yeni', 'tasarim', 'baski', 'paketleme', 'kargoda', 'teslim'];
export const ACTIVE_STATUSES: OrderStatus[] = ['yeni', 'tasarim', 'baski', 'paketleme', 'kargoda'];
/** Kupa henüz basılmamış aşamalar: malzeme ihtiyacı bunlardan hesaplanır. */
export const PRE_PRINT_STATUSES: OrderStatus[] = ['yeni', 'tasarim', 'baski'];

export interface OrderItem {
  productId?: string;
  title: string;
  category?: string;
  qty: number;
  unitPrice: number;
  unitCost?: number | null;
  color?: string;
  note?: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  customerName?: string;
  phone?: string;
  channel: SaleChannel;
  note?: string;
  extraCost?: number;        // kargo / ek maliyet (TL)
  sepetTalebiId?: string;
  createdAt: number;
  dueAt: number;             // sözlü teslim tarihi (ürün deliveryDays'ten)
  deliveredAt?: number;
  stageAt?: Partial<Record<OrderStatus, number>>;
  settled?: boolean;         // muhasebeye işlendi mi
}

export const isActiveStatus = (s: OrderStatus): boolean => ACTIVE_STATUSES.includes(s);

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}

export const orderTotal = (o: Pick<Order, 'items'>): number => o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
export const orderUnits = (o: Pick<Order, 'items'>): number => o.items.reduce((s, i) => s + i.qty, 0);

/** TSİ'ye göre `n` iş günü sonrası (cumartesi/pazar atlanır); gün içi saat 18:00 TSİ. */
export function addBusinessDays(ts: number, n: number): number {
  let cur = ts;
  let left = Math.max(0, Math.round(n));
  while (left > 0) {
    cur += DAY_MS;
    const wd = trWeekday(cur);
    if (wd !== 0 && wd !== 6) left--;
  }
  return trTime(trDayKey(cur), 18);
}

/** Teslim tarihi: siparişteki en uzun hazırlık süresi (iş günü). */
export function computeDueAt(createdAt: number, deliveryDays: number[]): number {
  const days = deliveryDays.length ? Math.max(...deliveryDays) : 3;
  return addBusinessDays(createdAt, days);
}

/** Açık bir iş, sözlü teslim gününü geçtiyse gecikmiştir. */
export function isLate(o: Pick<Order, 'status' | 'dueAt'>, now: number): boolean {
  return isActiveStatus(o.status) && trDayKey(now) > trDayKey(o.dueAt);
}

export function isDueToday(o: Pick<Order, 'status' | 'dueAt'>, now: number): boolean {
  return isActiveStatus(o.status) && trDayKey(now) === trDayKey(o.dueAt);
}

export function lateDays(o: Pick<Order, 'dueAt'>, now: number): number {
  const a = Date.parse(trDayKey(now));
  const b = Date.parse(trDayKey(o.dueAt));
  return Math.max(0, Math.round((a - b) / DAY_MS));
}

export function orderTitle(o: Pick<Order, 'items'>): string {
  const first = o.items[0]?.title ?? 'Sipariş';
  return o.items.length > 1 ? `${first} +${o.items.length - 1}` : first;
}

export function emptyStatusCounts(): Record<OrderStatus, number> {
  return { yeni: 0, tasarim: 0, baski: 0, paketleme: 0, kargoda: 0, teslim: 0, iptal: 0 };
}
