export interface ProductColor {
  name: string;
  images: string[]; // Cloudinary public_ids
}

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
  images: string[]; // Cloudinary public_ids (kapak/varsayılan)
  colors?: ProductColor[]; // Renk varyantları
  deliveryDays: number; // varsayılan: 3
  seoTags?: string[]; // Gizli SEO etiketleri — müşteri görmez, JSON-LD'ye gömülür
  productCode?: string; // Sadece admin panelinde görünür, ürün yönetimi için
  createdAt: number;
  updatedAt: number;
}

export type Category =
  | 'Seramik Nescafe Fincanı'
  | 'Lüks Kupa'
  | 'Nescafe Fincanı'
  | 'Latte Fincanı'
  | 'Pro Kupa'
  | 'Büyük Kupa'
  | 'Sihirli Kupa'
  | 'Özel Tasarım'
  | 'Kurumsal';

export const CATEGORIES: Category[] = [
  'Seramik Nescafe Fincanı',
  'Lüks Kupa',
  'Nescafe Fincanı',
  'Latte Fincanı',
  'Pro Kupa',
  'Büyük Kupa',
  'Sihirli Kupa',
  'Özel Tasarım',
  'Kurumsal',
];

// ── Konfiguratör ─────────────────────────────────────────────────────────────

export interface ConfiguratorCup {
  id: string;
  code: string;
  name: string;
  price: number;
  imagePublicId?: string;
  colors?: ProductColor[];
  gradient?: string;
  textColor?: string;
  active: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConfiguratorDesign {
  id: string;
  code: string;
  name: string;
  imagePublicId?: string;
  gradient?: string;
  textColor?: string;
  category?: string;
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
