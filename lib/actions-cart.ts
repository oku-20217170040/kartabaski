'use server';

import { headers } from 'next/headers';
import { requireAdmin } from './require-admin';
import { rateLimit } from './rate-limit';
import { notifyAdmin } from './notify';
import { CartRequestInputSchema } from './cart-schemas';
import { cartTotal, requestNo } from './cart';
import { isTalepStatus } from './talep-status';
import { SITE_URL } from './site';
import {
  countNewCartRequests,
  deleteCartRequest,
  getCartOverview,
  getCartProductInfo,
  getCartRequest,
  getCartRequests,
  markCartRequestOrdered,
  resolveCartLines,
  saveCartRequest,
  updateCartRequestNote,
  updateCartRequestStatus,
} from './cart-requests';
import { createOrderFromCart } from '@/lib/orders';
import type { CartOverview, CartProductInfo, SepetTalebi, SepetTalebiItem } from './cart-types';

const fmtTL = (n: number) => `${new Intl.NumberFormat('tr-TR').format(n)}₺`;

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
    console.warn('[actions-cart] ürün bilgisi okunamadı', e);
    return [];
  }
}

/**
 * Müşteri sepeti gönderir: fiyatlar sunucuda Firestore'dan okunur, talep kaydedilir, admin'e Telegram gider.
 * Dönen bilgiyle istemci WhatsApp mesajını hazırlar.
 */
export async function submitCartRequestAction(data: unknown): Promise<{
  id: string;
  items: SepetTalebiItem[];
  total: number;
}> {
  const parsed = CartRequestInputSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Talep bilgileri geçersiz. Lütfen alanları kontrol edin.');
  }

  const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`sepet:${ip}`, 5, 10 * 60 * 1000)) {
    throw new Error('Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.');
  }

  const { website: _honeypot, items: lines, ...contact } = parsed.data;
  void _honeypot;
  const items = await resolveCartLines(lines);
  if (items.length === 0) throw new Error('Sepetteki ürünler artık satışta değil.');

  const { id, total } = await saveCartRequest({ items, ...contact });

  const body = [
    ...items.map(
      (p, n) =>
        `${n + 1}) ${p.title} x${p.qty}${p.color ? ` (${p.color})` : ''}${p.note ? ` — "${p.note}"` : ''}`
    ),
    total > 0 ? `Tahmini toplam: ${fmtTL(total)}` : '',
    `${contact.name} · ${contact.phone}`,
    `${contact.district} / ${contact.city}`,
    contact.note ? `Not: ${contact.note.slice(0, 300)}` : '',
    `${SITE_URL}/admin/sepet-talepleri`,
  ].filter(Boolean).join('\n');
  await notifyAdmin(`Yeni sepet talebi (No: ${requestNo(id)})`, body).catch(() => false);

  return { id, items, total: total || cartTotal(items) };
}

// ── Yönetici ─────────────────────────────────────────────────────────────────

/** Admin menüsündeki "yeni sepet talebi" rozeti. */
export async function countNewCartRequestsAction(): Promise<number> {
  await requireAdmin();
  return countNewCartRequests();
}

export async function getCartOverviewAction(): Promise<CartOverview> {
  await requireAdmin();
  return getCartOverview();
}

export async function getCartRequestsAction(): Promise<SepetTalebi[]> {
  await requireAdmin();
  return getCartRequests();
}

export async function updateCartRequestStatusAction(id: string, status: string): Promise<void> {
  await requireAdmin();
  if (!id || !isTalepStatus(status)) throw new Error('Geçersiz durum');
  await updateCartRequestStatus(id, status);
}

export async function updateCartRequestNoteAction(id: string, note: string): Promise<void> {
  await requireAdmin();
  if (!id) throw new Error('Geçersiz talep');
  await updateCartRequestNote(id, String(note ?? '').slice(0, 1000));
}

export async function deleteCartRequestAction(id: string): Promise<void> {
  await requireAdmin();
  if (!id) throw new Error('Geçersiz talep');
  await deleteCartRequest(id);
}

/** Talebi "Makine" siparişine çevirir; talebi "siparis" yapıp orderId'yi yazar. Zaten aktarıldıysa mevcut id döner. */
export async function createOrderFromCartRequestAction(id: string): Promise<string> {
  await requireAdmin();
  const t = await getCartRequest(id);
  if (!t) throw new Error('Talep bulunamadı');
  if (t.orderId) return t.orderId;
  if (t.items.length === 0) throw new Error('Talepte ürün yok');

  const orderId = await createOrderFromCart({
    sepetTalebiId: id,
    customerName: t.name || undefined,
    phone: t.phone || undefined,
    items: t.items.map((i) => ({
      productId: i.productId || undefined,
      title: i.title,
      qty: i.qty,
      unitPrice: i.unitPrice,
      color: i.color,
      note: i.note,
    })),
    note: [t.note, [t.district, t.city].filter(Boolean).join(' / '), t.address].filter(Boolean).join(' · ') || undefined,
  });
  await markCartRequestOrdered(id, orderId);
  return orderId;
}
