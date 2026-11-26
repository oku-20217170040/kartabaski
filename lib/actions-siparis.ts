'use server';

import { headers } from 'next/headers';
import { requireAdmin } from './require-admin';
import { rateLimit } from './rate-limit';
import {
  countNewOrderRequests, countRepliedOrders, deleteOrderRequest, getCartProductInfo, getOrderRequest, getOrderRequestOverview,
  getProduction, listOrderRequests, markOrderSeen, setOrderAdmin, setShipping,
} from './siparis';
import { sendToMachine } from './siparis-uretim';
import { ORDER_TOKEN_RE, OrderRequest, ShippingSchema } from './siparis-types';
import type { Production } from './siparis-takip';
import { isTalepStatus } from './talep-status';
import type { CartOverview, CartProductInfo } from './cart-types';

// ── Herkese açık ─────────────────────────────────────────────────────────────

/** /sepet sayfası: sepetteki ürünlerin güncel fiyat/aktiflik bilgisi. Yalnızca ilgili belgeler okunur. */
export async function getCartProductInfoAction(ids: string[]): Promise<CartProductInfo[]> {
  const safe = (Array.isArray(ids) ? ids : [])
    .filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(x))
    .slice(0, 30);
  if (safe.length === 0) return [];
  const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`sepet-info:${ip}`, 60, 10 * 60 * 1000)) return [];
  try {
    return await getCartProductInfo(safe);
  } catch (e) {
    console.warn('[actions-siparis] ürün bilgisi okunamadı', e);
    return [];
  }
}

// ── Yönetici ─────────────────────────────────────────────────────────────────

function assertToken(token: string) {
  if (!ORDER_TOKEN_RE.test(token)) throw new Error('Geçersiz sipariş');
}

/** Menü rozeti: yeni siparişler + önizlemeye cevap veren müşteriler. */
export async function countNewOrderRequestsAction(): Promise<number> {
  await requireAdmin();
  const [fresh, replied] = await Promise.all([countNewOrderRequests(), countRepliedOrders()]);
  return fresh + replied;
}

export async function getOrderRequestOverviewAction(): Promise<CartOverview> {
  await requireAdmin();
  return getOrderRequestOverview();
}

export async function listOrderRequestsAction(): Promise<OrderRequest[]> {
  await requireAdmin();
  return listOrderRequests();
}

/** Ayrıntı sayfası: sipariş + üretim durumu. Açılınca müşteri cevabı "görüldü" sayılır. */
export async function getOrderRequestAction(token: string): Promise<{ order: OrderRequest; production: Production | null } | null> {
  await requireAdmin();
  const order = await getOrderRequest(token);
  if (!order) return null;
  if (order.attention) await markOrderSeen(token);
  return { order, production: await getProduction(order) };
}

export async function setOrderShippingAction(token: string, data: unknown): Promise<void> {
  await requireAdmin();
  assertToken(token);
  if (data === null) return setShipping(token, null);
  const parsed = ShippingSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Kargo bilgisi geçersiz');
  await setShipping(token, parsed.data);
}

export async function updateOrderRequestStatusAction(token: string, status: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  if (!isTalepStatus(status)) throw new Error('Geçersiz durum');
  await setOrderAdmin(token, { status });
}

export async function updateOrderRequestNoteAction(token: string, note: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  await setOrderAdmin(token, { adminNote: String(note ?? '').slice(0, 1000) });
}

export async function deleteOrderRequestAction(token: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  await deleteOrderRequest(token);
}

/** Siparişi üretim hattına ("Makine") aktarır; zaten aktarıldıysa mevcut işin kimliği döner. */
export async function sendOrderToMachineAction(token: string): Promise<string> {
  await requireAdmin();
  assertToken(token);
  return sendToMachine(token);
}
