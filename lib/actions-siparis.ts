'use server';

import { headers } from 'next/headers';
import { requireAdmin } from './require-admin';
import { rateLimit } from './rate-limit';
import {
  countNewOrderRequests, deleteOrderRequest, getCartProductInfo, getOrderRequest, getOrderRequestOverview,
  listOrderRequests, setOrderAdmin,
} from './siparis';
import { createOrderFromCart } from './orders';
import { ORDER_TOKEN_RE, OrderRequest, orderUrl } from './siparis-types';
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

export async function countNewOrderRequestsAction(): Promise<number> {
  await requireAdmin();
  return countNewOrderRequests();
}

export async function getOrderRequestOverviewAction(): Promise<CartOverview> {
  await requireAdmin();
  return getOrderRequestOverview();
}

export async function listOrderRequestsAction(): Promise<OrderRequest[]> {
  await requireAdmin();
  return listOrderRequests();
}

export async function getOrderRequestAction(token: string): Promise<OrderRequest | null> {
  await requireAdmin();
  return getOrderRequest(token);
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
  const order = await getOrderRequest(token);
  if (!order) throw new Error('Sipariş bulunamadı');
  if (order.orderId) return order.orderId;

  const orderId = await createOrderFromCart({
    sepetTalebiId: token,
    customerName: order.name || undefined,
    phone: order.phone || undefined,
    items: order.items.map((i) => ({
      productId: i.productId,
      title: i.title,
      qty: i.qty,
      unitPrice: i.unitPrice,
      color: i.color,
      note: [i.text ? `Yazı: ${i.text}` : '', i.needsDesign ? 'Tasarım hazırlanacak' : '', i.note].filter(Boolean).join(' · ') || undefined,
    })),
    note: [order.note, [order.district, order.city].filter(Boolean).join(' / '), order.address, orderUrl(token)]
      .filter(Boolean).join(' · '),
  });
  await setOrderAdmin(token, { status: 'siparis', orderId });
  return orderId;
}
