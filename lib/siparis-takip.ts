// Müşterinin gördüğü sipariş çizelgesi: sipariş kaydı + üretim hattındaki iş (saf, testli).
import { ORDER_STATUS_LABELS, OrderStatus, nextStatus } from './orders-utils';
import { searchKey } from './address';
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

export type NextAction = 'machine' | 'advance' | 'proof' | 'remind' | 'shipping' | 'none';
export interface NextStep { title: string; hint: string; action: NextAction; label?: string }

/** Yöneticinin bu siparişte şimdi yapması gereken iş. */
export function nextStep(order: Pick<OrderRequest, 'status' | 'proof' | 'shipping' | 'orderId'>, production: Production | null): NextStep {
  const done = (title: string, hint: string): NextStep => ({ title, hint, action: 'none' });
  if (order.status === 'iptal' || production?.status === 'iptal') return done('İptal edildi', 'Bu siparişte yapılacak iş yok.');
  if (order.status === 'tamamlandi' || production?.status === 'teslim') return done('Tamamlandı', 'Sipariş teslim edildi.');
  if (order.proof?.state === 'duzeltme') return { title: 'Müşteri düzeltme istedi', hint: 'İstenen değişikliği yapıp yeni önizleme gönderin.', action: 'proof', label: 'Yeni önizleme gönder' };
  if (order.proof?.state === 'bekliyor') return { title: 'Müşteri onayı bekleniyor', hint: 'Önizleme gönderildi. Cevap gelmediyse hatırlatın.', action: 'remind', label: 'Müşteriye hatırlat' };
  if (!order.orderId) {
    return {
      title: order.proof ? 'Müşteri onayladı' : 'Yeni sipariş',
      hint: order.proof ? 'Siparişi üretim hattına alın.' : 'Baskı bilgilerini kontrol edin; isterseniz önce önizleme gönderin.',
      action: 'machine', label: 'Üretime aktar',
    };
  }
  if (!production) return done('Üretim işi bulunamadı', 'Bağlı iş üretim hattından silinmiş olabilir.');
  const stage = production.status;
  if (!order.shipping && (stage === 'paketleme' || stage === 'kargoda')) {
    return { title: ORDER_STATUS_LABELS[stage], hint: 'Kargo firmasını ve takip numarasını girin.', action: 'shipping', label: 'Kargo bilgisi gir' };
  }
  const next = nextStatus(stage);
  return next
    ? { title: ORDER_STATUS_LABELS[stage], hint: 'İş bittiğinde sonraki aşamaya geçirin; müşteri takip sayfasında görür.', action: 'advance', label: `Sonraki aşama: ${ORDER_STATUS_LABELS[next]}` }
    : done(ORDER_STATUS_LABELS[stage], 'Yapılacak iş yok.');
}

/** İndirilen baskı dosyasının adı: kod, kalem sırası, ürün ve yüz. */
export function printFileName(code: string, index: number, title: string, side: string, mirrored: boolean): string {
  const slug = (value: string) => searchKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${[code, index + 1, slug(title), slug(side), mirrored ? 'aynali' : ''].filter(Boolean).join('-')}.png`;
}

