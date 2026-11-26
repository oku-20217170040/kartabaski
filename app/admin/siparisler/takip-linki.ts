import { waNumber } from '@/lib/cart';
import { OrderRequest, orderUrl, trackingMessage } from '@/lib/siparis-types';

/** Müşterinin numarasına, takip bağlantısı yazılı WhatsApp mesajı açar. */
export const trackingLink = (o: Pick<OrderRequest, 'token' | 'code' | 'name' | 'phone'>) =>
  `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(trackingMessage(o))}`;

/** Müşteriye durum haberi: mesaja yalnız sipariş bağlantısı girer. */
export const notifyLink = (o: Pick<OrderRequest, 'token' | 'phone'>, text: string) =>
  `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(`Merhaba, ${text} ${orderUrl(o.token)}`)}`;

