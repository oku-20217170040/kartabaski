// Sepet / sepet talebi tipleri — istemci ve sunucu ortak kullanır (server-only içermez).

/** Tarayıcıda (localStorage) tutulan sepet satırı. Aynı ürün + renk tek satırdır; adet artar. */
export interface CartItem {
  key: string; // productId::renk — satır kimliği
  productId: string;
  slug: string;
  title: string;
  unitPrice: number; // priceMin ("X₺'den başlayan"); 0 = fiyat sorunuz
  image: string | null; // Cloudinary public_id (ya da tam URL)
  category: string;
  qty: number; // 1–500
  color?: string;
  note?: string; // kişiselleştirme notu (isim / yazı)
}

/** Talep kaydındaki satır anlık görüntüsü: fiyat sunucuda Firestore'dan okunur, istemciye güvenilmez. */
export interface SepetTalebiItem {
  productId: string;
  slug: string;
  title: string;
  unitPrice: number;
  qty: number;
  color?: string;
  note?: string;
  image?: string | null;
}

export type SepetTalebiStatus = 'yeni' | 'incelendi' | 'siparis' | 'tamamlandi' | 'iptal';

export interface SepetTalebi {
  id?: string;
  items: SepetTalebiItem[];
  total: number; // tahmini (priceMin × adet)
  name: string;
  phone: string;
  city: string;
  district: string;
  address?: string;
  note?: string;
  adminNote?: string;
  orderId?: string;
  createdAt: number;
  status: SepetTalebiStatus;
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

export interface CartOverview {
  newCount: number;
  last30: number;
  recent: { id: string; name?: string; total: number; itemCount: number; createdAt: number; status: string }[];
}
