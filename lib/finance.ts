import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { SaleRecord, SaleInput, SaleChannel } from './finance-types';
import { SALE_CHANNELS } from './finance-types';

const COL = 'sales';

/** Firestore undefined alanları reddeder: gönderilmeden önce temizlenir. */
export function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function fromDoc(id: string, x: FirebaseFirestore.DocumentData): SaleRecord {
  const channel = SALE_CHANNELS.includes(x.channel) ? (x.channel as SaleChannel) : 'Diğer';
  return {
    id,
    date: Number(x.date) || 0,
    title: String(x.title ?? 'Ürün'),
    category: String(x.category ?? 'Diğer'),
    qty: Number(x.qty) || 1,
    unitPrice: Number(x.unitPrice) || 0,
    channel,
    ...(x.productId ? { productId: String(x.productId) } : {}),
    ...(typeof x.unitCost === 'number' ? { unitCost: x.unitCost } : {}),
    ...(typeof x.extraCost === 'number' && x.extraCost > 0 ? { extraCost: x.extraCost } : {}),
    ...(x.customerName ? { customerName: String(x.customerName) } : {}),
    ...(x.note ? { note: String(x.note) } : {}),
    ...(x.orderId ? { orderId: String(x.orderId) } : {}),
    ...(x.sepetTalebiId ? { sepetTalebiId: String(x.sepetTalebiId) } : {}),
  };
}

export async function listSales(): Promise<SaleRecord[]> {
  const snap = await adminDb.collection(COL).get();
  return snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.date - a.date);
}

export async function saveSale(data: SaleInput, id?: string): Promise<string> {
  const payload = { ...stripUndefined({ ...data }), updatedAt: Date.now() };
  if (id) {
    // Düzenlemede formdan çıkarılan isteğe bağlı alanlar belgeden de silinir
    const cleared = Object.fromEntries(
      (['productId', 'customerName', 'note', 'extraCost'] as const).filter((k) => !(k in payload)).map((k) => [k, FieldValue.delete()]),
    );
    await adminDb.collection(COL).doc(id).set({ ...payload, ...cleared }, { merge: true });
    return id;
  }
  const ref = await adminDb.collection(COL).add({ ...payload, createdAt: Date.now() });
  return ref.id;
}

export async function deleteSale(id: string): Promise<void> {
  await adminDb.collection(COL).doc(id).delete();
}

/** Sabit kimlikle bir kez yazar (create): aynı iş iki kez muhasebeye işlenmez. Yeni yazıldıysa true. */
export async function createSaleOnce(id: string, data: SaleInput): Promise<boolean> {
  try {
    await adminDb.collection(COL).doc(id).create({ ...stripUndefined({ ...data }), createdAt: Date.now() });
    return true;
  } catch {
    return false; // ALREADY_EXISTS
  }
}
