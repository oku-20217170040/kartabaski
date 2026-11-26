import { waNumber } from '@/lib/cart';
import { OrderRequest, trackingMessage } from '@/lib/siparis-types';

/** Müşterinin numarasına, takip bağlantısı yazılı WhatsApp mesajı açar. */
export const trackingLink = (o: Pick<OrderRequest, 'token' | 'code' | 'name' | 'phone'>) =>
  `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(trackingMessage(o))}`;
