// Müşterinin gördüğü sipariş çizelgesi: sipariş kaydı + üretim hattındaki iş (saf, testli).
import type { OrderStatus } from './orders-utils';
import { OrderRequest, orderNo } from './siparis-types';

export const TRACK_STEPS = ['Sipariş alındı', 'Tasarım ve onay', 'Baskı', 'Paketleme', 'Kargoda', 'Teslim edildi'] as const;

export interface Production {
  status: OrderStatus;
  stageAt?: Partial<Record<OrderStatus, number>>;
}

export interface TrackStep { label: string; state: 'done' | 'current' | 'todo'; at?: number }

export interface Tracking {
  cancelled: boolean;
  headline: string;
  steps: TrackStep[];
}

const STEP_OF: Record<Exclude<OrderStatus, 'iptal'>, number> = {
  yeni: 0, tasarim: 1, baski: 2, paketleme: 3, kargoda: 4, teslim: 5,
};

type Input = Pick<OrderRequest, 'status' | 'createdAt' | 'proof' | 'shipping'>;

export function buildTracking(order: Input, production?: Production | null): Tracking {
  if (order.status === 'iptal' || production?.status === 'iptal') {
    return { cancelled: true, headline: 'Sipariş iptal edildi', steps: [] };
  }

  // İptal yukarıda elendi.
  let current = production ? STEP_OF[production.status as keyof typeof STEP_OF] : 0;
  if (order.proof) current = Math.max(current, 1);
  if (order.shipping) current = Math.max(current, 4);
  if (order.status === 'tamamlandi') current = 5;

  const at = production?.stageAt ?? {};
  const times = [order.createdAt, at.tasarim ?? order.proof?.sentAt, at.baski, at.paketleme, at.kargoda, at.teslim];
  const last = TRACK_STEPS.length - 1;
  const steps = TRACK_STEPS.map((label, i): TrackStep => {
    const state = i < current || (i === current && i === last) ? 'done' : i === current ? 'current' : 'todo';
    return { label, state, ...(state !== 'todo' && times[i] ? { at: times[i] } : {}) };
  });

  let headline: string = current === 0 ? 'Siparişiniz alındı' : TRACK_STEPS[current];
  if (current <= 1 && order.proof?.state === 'bekliyor') headline = 'Onayınızı bekliyoruz';
  else if (current <= 1 && order.proof?.state === 'duzeltme') headline = 'Düzeltme isteğiniz bizde';
  else if (current === 1 && order.proof?.state === 'onaylandi') headline = 'Onayınız alındı';

  return { cancelled: false, headline, steps };
}

/** Yalnız kodu giren herkese açık görünüm: ad, telefon, adres, yazı ve fotoğraf içermez. */
export function publicOrder(order: OrderRequest, tracking: Tracking) {
  return {
    code: orderNo(order),
    tracking,
    shipping: order.shipping,
    items: order.items.map((i) => ({ title: i.title, qty: i.qty, color: i.color, twoSided: Boolean(i.back) })),
  };
}
