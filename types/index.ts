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

export interface FilterState {
  search: string;
  category: Category | '';
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
}
