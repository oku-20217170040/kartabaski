// Muhasebe verisi `sales` koleksiyonunda tutulur (satış defteri satırı = sipariş/satış kalemi).
// Bu koleksiyona yalnızca Admin SDK erişir: maliyet bilgisi vitrin verisine asla karışmaz.
export const SALE_CHANNELS = ['WhatsApp', 'Instagram', 'Trendyol', 'Elden', 'Diğer'] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

export interface SaleRecord {
  id: string;
  date: number;              // satış tarihi (ms)
  productId?: string;
  title: string;             // ürün silinse bile okunabilsin diye anlık görüntü
  category: string;
  qty: number;               // adet
  unitPrice: number;         // birim satış fiyatı (TL)
  unitCost?: number | null;  // birim maliyet (TL); bilinmiyorsa kâr hesaplanmaz
  extraCost?: number;        // kargo / ek maliyet (TL, satır toplamı)
  channel: SaleChannel;
  customerName?: string;
  note?: string;
  orderId?: string;          // üretim hattındaki iş
  sepetTalebiId?: string;
}

/** Sunucuya gönderilen satır (id hariç). */
export type SaleInput = Omit<SaleRecord, 'id'>;
