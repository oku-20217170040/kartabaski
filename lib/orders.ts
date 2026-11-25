import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { parseProduct } from './product-utils';
import { stripUndefined, createSaleOnce } from './finance';
import { SALE_CHANNELS, type SaleChannel, type SaleInput } from './finance-types';
import {
  ACTIVE_STATUSES, ORDER_STATUSES, computeDueAt, emptyStatusCounts, isDueToday, isLate,
  type Order, type OrderItem, type OrderStatus,
} from './orders-utils';

const COL = 'orders';

function fromDoc(id: string, x: FirebaseFirestore.DocumentData): Order {
  const status = ORDER_STATUSES.includes(x.status) ? (x.status as OrderStatus) : 'yeni';
  const channel = SALE_CHANNELS.includes(x.channel) ? (x.channel as SaleChannel) : 'WhatsApp';
  const items: OrderItem[] = Array.isArray(x.items)
    ? x.items.map((i: Record<string, unknown>) => ({
        title: String(i.title ?? 'Ürün'),
        qty: Number(i.qty) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        ...(i.productId ? { productId: String(i.productId) } : {}),
        ...(i.category ? { category: String(i.category) } : {}),
        ...(typeof i.unitCost === 'number' ? { unitCost: i.unitCost } : {}),
        ...(i.color ? { color: String(i.color) } : {}),
        ...(i.note ? { note: String(i.note) } : {}),
      }))
    : [];
  const createdAt = Number(x.createdAt) || 0;
  return {
    id,
    status,
    items,
    channel,
    createdAt,
    dueAt: Number(x.dueAt) || computeDueAt(createdAt, []),
    ...(x.customerName ? { customerName: String(x.customerName) } : {}),
    ...(x.phone ? { phone: String(x.phone) } : {}),
    ...(x.note ? { note: String(x.note) } : {}),
    ...(typeof x.extraCost === 'number' && x.extraCost > 0 ? { extraCost: x.extraCost } : {}),
    ...(x.sepetTalebiId ? { sepetTalebiId: String(x.sepetTalebiId) } : {}),
    ...(x.deliveredAt ? { deliveredAt: Number(x.deliveredAt) } : {}),
    ...(x.stageAt && typeof x.stageAt === 'object' ? { stageAt: x.stageAt as Order['stageAt'] } : {}),
    ...(x.settled ? { settled: true } : {}),
  };
}

/** En yeni `max` iş (varsayılan 600): panel ve günlük özet için yeterli, kotayı korur. */
export async function listOrders(max = 600): Promise<Order[]> {
  const snap = await adminDb.collection(COL).orderBy('createdAt', 'desc').limit(max).get();
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function getOrder(id: string): Promise<Order | null> {
  const d = await adminDb.collection(COL).doc(id).get();
  return d.exists ? fromDoc(d.id, d.data() ?? {}) : null;
}

type ProductInfo = { category: string; deliveryDays: number };

/** Ürün belgelerinden kategori ve hazırlık süresini okur (yalnızca sipariş kalemlerindeki ürünler). */
async function productInfo(ids: string[]): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>();
  await Promise.all(
    Array.from(new Set(ids)).map(async (id) => {
      try {
        const d = await adminDb.collection('products').doc(id).get();
        if (!d.exists) return;
        const p = parseProduct(d.id, d.data() as Record<string, unknown>, 'orders');
        if (p) out.set(id, { category: p.category, deliveryDays: Number(p.deliveryDays) || 3 });
      } catch {
        /* ürün okunamadı: varsayılanlarla devam */
      }
    }),
  );
  return out;
}

const deliveryDaysOf = (items: { productId?: string }[], info: Map<string, ProductInfo>): number[] =>
  items.flatMap((i) => {
    const p = i.productId ? info.get(i.productId) : undefined;
    return p ? [p.deliveryDays] : [];
  });

export interface CartOrderInput {
  sepetTalebiId: string;
  customerName?: string;
  phone?: string;
  items: { productId?: string; title: string; qty: number; unitPrice: number; color?: string; note?: string }[];
  note?: string;
}

/**
 * Sepet talebinden üretim hattına yeni iş açar; iş id'si döner.
 * Kimlik sepet talebinden türetilir: aynı talep tekrar gelirse mevcut iş döner (çift kayıt olmaz).
 */
export async function createOrderFromCart(input: CartOrderInput): Promise<string> {
  const id = `sepet_${input.sepetTalebiId}`.replace(/[/\s]/g, '_').slice(0, 150);
  const info = await productInfo(input.items.flatMap((i) => (i.productId ? [i.productId] : [])));
  const now = Date.now();
  const items: OrderItem[] = input.items.map((i) => ({
    title: i.title,
    qty: Math.max(1, Math.round(i.qty) || 1),
    unitPrice: Math.max(0, Number(i.unitPrice) || 0),
    category: (i.productId && info.get(i.productId)?.category) || 'Özel Tasarım',
    ...(i.productId ? { productId: i.productId } : {}),
    ...(i.color ? { color: i.color } : {}),
    ...(i.note ? { note: i.note } : {}),
  }));
  const doc = stripUndefined({
    status: 'yeni' as OrderStatus,
    items,
    channel: 'WhatsApp' as SaleChannel,
    customerName: input.customerName,
    phone: input.phone,
    note: input.note,
    sepetTalebiId: input.sepetTalebiId,
    createdAt: now,
    dueAt: computeDueAt(now, deliveryDaysOf(input.items, info)),
    stageAt: { yeni: now },
  });
  try {
    await adminDb.collection(COL).doc(id).create(doc);
  } catch {
    // zaten var: mevcut işi döndür
  }
  return id;
}

export interface OrderEditInput {
  items: OrderItem[];
  customerName?: string;
  phone?: string;
  channel: SaleChannel;
  note?: string;
  extraCost?: number;
  dueAt?: number;
}

/** Elle iş oluşturur (WhatsApp/Instagram/elden siparişler) veya düzenler. */
export async function saveOrder(data: OrderEditInput, id?: string): Promise<string> {
  const now = Date.now();
  const items = data.items.map((i) => stripUndefined({ ...i }));
  if (id) {
    const clean = stripUndefined({ ...data });
    // Düzenlemede formdan çıkarılan isteğe bağlı alanlar belgeden de silinir
    const cleared = Object.fromEntries(
      (['customerName', 'phone', 'note', 'extraCost'] as const).filter((k) => !(k in clean)).map((k) => [k, FieldValue.delete()]),
    );
    await adminDb.collection(COL).doc(id).set({ ...clean, ...cleared, items, updatedAt: now }, { merge: true });
    return id;
  }
  const info = await productInfo(data.items.flatMap((i) => (i.productId ? [i.productId] : [])));
  const withCat = items.map((i) => ({ ...i, category: i.category || (i.productId && info.get(i.productId)?.category) || 'Özel Tasarım' }));
  const ref = await adminDb.collection(COL).add({
    ...stripUndefined({ ...data }),
    items: withCat,
    status: 'yeni',
    createdAt: now,
    dueAt: data.dueAt ?? computeDueAt(now, deliveryDaysOf(data.items, info)),
    stageAt: { yeni: now },
  });
  return ref.id;
}

export async function deleteOrder(id: string): Promise<void> {
  await adminDb.collection(COL).doc(id).delete();
}

/** Teslim edilen işi muhasebeye işler (kalem başına bir satış satırı). Yeni yazılan satır sayısını döner. */
export async function settleOrder(id: string): Promise<number> {
  const o = await getOrder(id);
  if (!o || o.status !== 'teslim') return 0;
  const date = o.deliveredAt ?? Date.now();
  let created = 0;
  for (let i = 0; i < o.items.length; i++) {
    const it = o.items[i];
    const sale: SaleInput = stripUndefined({
      date,
      title: it.title,
      category: it.category ?? 'Özel Tasarım',
      qty: it.qty,
      unitPrice: it.unitPrice,
      unitCost: typeof it.unitCost === 'number' ? it.unitCost : undefined,
      // kargo/ek maliyet siparişte tek kez: ilk satıra yazılır
      extraCost: i === 0 && o.extraCost ? o.extraCost : undefined,
      channel: o.channel,
      productId: it.productId,
      customerName: o.customerName,
      note: it.note,
      orderId: id,
      sepetTalebiId: o.sepetTalebiId,
    });
    if (await createSaleOnce(`ord_${id}_${i}`, sale)) created++;
  }
  await adminDb.collection(COL).doc(id).set({ settled: true }, { merge: true });
  return created;
}

/** Durumu değiştirir; zaman damgası tutar. Teslim edilince otomatik muhasebeye işlenir. Güncel işi döner. */
export async function setOrderStatus(id: string, status: OrderStatus, now = Date.now()): Promise<Order> {
  const o = await getOrder(id);
  if (!o) throw new Error('İş bulunamadı.');
  await adminDb.collection(COL).doc(id).set(
    {
      status,
      updatedAt: now,
      stageAt: { ...(o.stageAt ?? {}), [status]: now },
      ...(status === 'teslim' ? { deliveredAt: now } : {}),
    },
    { merge: true },
  );
  if (status === 'teslim') {
    try { await settleOrder(id); } catch (e) { console.warn('[orders] muhasebeye işlenemedi', id, e); }
  }
  return (await getOrder(id)) as Order;
}

export interface OrdersOverview { byStatus: Record<string, number>; late: number; dueToday: number }

/** Genel Bakış kartı: açık işler tek sorgu, teslim/iptal yalnızca sayım (aggregate) ile okunur. */
export async function getOrdersOverview(now = Date.now()): Promise<OrdersOverview> {
  const byStatus = emptyStatusCounts();
  const [active, delivered, cancelled] = await Promise.all([
    adminDb.collection(COL).where('status', 'in', ACTIVE_STATUSES).get(),
    adminDb.collection(COL).where('status', '==', 'teslim').count().get(),
    adminDb.collection(COL).where('status', '==', 'iptal').count().get(),
  ]);
  let late = 0, dueToday = 0;
  for (const d of active.docs) {
    const o = fromDoc(d.id, d.data());
    byStatus[o.status]++;
    if (isLate(o, now)) late++;
    else if (isDueToday(o, now)) dueToday++;
  }
  byStatus.teslim = delivered.data().count;
  byStatus.iptal = cancelled.data().count;
  return { byStatus, late, dueToday };
}
