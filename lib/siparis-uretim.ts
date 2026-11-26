import 'server-only';

import { createOrderFromCart } from './orders';
import { isCupId } from './configurator-lines';
import { lineNote, orderUrl } from './siparis-types';
import { getOrderRequest, setOrderAdmin } from './siparis';

/** Siparişi üretim hattına ("Makine") aktarır; zaten aktarıldıysa mevcut işin kimliği döner. Yetki denetimi çağırana aittir. */
export async function sendToMachine(token: string): Promise<string> {
  const order = await getOrderRequest(token);
  if (!order) throw new Error('Sipariş bulunamadı');
  if (order.orderId) return order.orderId;

  const orderId = await createOrderFromCart({
    sepetTalebiId: token,
    customerName: order.name || undefined,
    phone: order.phone || undefined,
    items: order.items.map((i) => ({
      // Konfigüratör bardağı ürün kataloğunda yok.
      productId: isCupId(i.productId) ? undefined : i.productId,
      title: i.title,
      qty: i.qty,
      unitPrice: i.unitPrice,
      color: i.color,
      note: lineNote(i) || undefined,
    })),
    note: [
      order.note,
      // Yeni siparişte il ve ilçe adres satırının içindedir.
      order.neighborhood ? '' : [order.district, order.city].filter(Boolean).join(' / '),
      order.address,
      order.directions ? `Tarif: ${order.directions}` : '',
      order.recipient ? `Alıcı: ${order.recipient.name} ${order.recipient.phone}` : '',
      order.invoice ? `Fatura: ${order.invoice.company}, ${order.invoice.taxOffice} VD ${order.invoice.taxNo}` : '',
      orderUrl(token),
    ].filter(Boolean).join(' · '),
  });
  await setOrderAdmin(token, { status: 'siparis', orderId });
  return orderId;
}
