export interface Product {
  id: string;
  title: string;
  slug: string;
  priceMin: number;
  priceMax: number;
  category: Category;
  active: boolean;
  featured?: boolean;
  shortDesc: string;
  description: string;
  images: string[]; // Cloudinary public_ids
  deliveryDays: number; // varsayılan: 3
  seoTags?: string[]; // Gizli SEO etiketleri — müşteri görmez, JSON-LD'ye gömülür
  productCode?: string; // Sadece admin panelinde görünür, ürün yönetimi için
  createdAt: number;
  updatedAt: number;
}

export type Category =
  | 'Sihirli Mat Kupa'
  | 'Sihirli Konik Kupa'
  | 'Seramik Nescafe Fincanı'
  | 'Sihirli Renkli Kupa'
  | 'Özel Tasarım';

export const CATEGORIES: Category[] = [
  'Sihirli Mat Kupa',
  'Sihirli Konik Kupa',
  'Seramik Nescafe Fincanı',
  'Sihirli Renkli Kupa',
  'Özel Tasarım',
];

// ── Konfiguratör ─────────────────────────────────────────────────────────────

export interface ConfiguratorCup {
  id: string;
  code: string;       // B1, B2 ...
  name: string;
  price: number;
  gradient: string;   // CSS gradient — ör. "linear-gradient(135deg,#6366F1,#8B5CF6)"
  textColor: string;  // Görsel üzerindeki metin rengi — ör. "rgba(255,255,255,0.92)"
  active: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConfiguratorDesign {
  id: string;
  code: string;       // T1, T2 ...
  name: string;
  gradient: string;
  textColor: string;
  active: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface FilterState {
  search: string;
  category: Category | '';
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
}
