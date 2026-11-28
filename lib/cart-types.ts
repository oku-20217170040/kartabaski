// Sepet tipleri — istemci ve sunucu ortak kullanır (server-only içermez).
import type { Placement } from './photo-layout';
import type { Layer } from './tasarim/model';

export interface ReadyDesign { id: string; name: string; image?: string }

/** Kupanın bir yüzüne basılacaklar. Fotoğraflar sipariş oluşturulana kadar cihazda (IndexedDB) durur. */
export interface DesignSide {
  text?: string;
  font?: 'duz' | 'el';
  placement?: Placement;
  removeBg?: boolean;
  /** Tasarım ekranının katmanları. Yoksa eski biçim (yazı + tek fotoğraf) geçerlidir. */
  layers?: Layer[];
  /** Konfigüratörden seçilen hazır tasarım. */
  ready?: ReadyDesign;
  /** lib/cart-files kimlikleri. */
  photos: string[];
}

/** Bir sepet satırının tasarımı; kendi alanları ön yüzdür. */
export interface CartDesign extends DesignSide {
  /** Müşterinin tasarımı yok; atölye hazırlayacak. */
  needsDesign?: boolean;
  preview?: string;
  /** Varsa baskı iki yüzedir. */
  back?: DesignSide;
}

/** Tarayıcıda (localStorage) tutulan sepet satırı. Aynı ürün + renk tek satırdır; adet artar. */
export interface CartItem {
  key: string; // tasarımlı satır: d:<kimlik>; tasarımsız: productId::renk
  productId: string;
  slug: string;
  title: string;
  unitPrice: number; // priceMin ("X₺'den başlayan"); 0 = fiyat sorunuz
  image: string | null; // Cloudinary public_id (ya da tam URL)
  category: string;
  qty: number; // 1–500
  color?: string;
  note?: string; // kişiselleştirme notu (isim / yazı)
  design?: CartDesign;
}

/** /sepet sayfasının sunucudan aldığı güncel ürün bilgisi. */
export interface CartProductInfo {
  id: string;
  slug: string;
  title: string;
  unitPrice: number;
  image: string | null;
  category: string;
  active: boolean;
  colors: string[];
}

/** Yönetim özetindeki sipariş sayıları. */
export interface CartOverview {
  newCount: number;
  last30: number;
  recent: { id: string; name?: string; total: number; itemCount: number; createdAt: number; status: string }[];
}
