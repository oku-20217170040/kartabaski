export interface Product {
  id: string;
  title: string;
  slug: string;
  priceTRY: number;
  category: Category;
  condition: 'Sıfır' | 'Sıfır Gibi' | 'Az Kullanılmış' | '2. El' | 'İyi Durumda' | 'Normal Durumda' | 'Parasına Göre' | 'Hasarlı/Onarım Gerekli';
  inStock: boolean;
  featured?: boolean;
  tags: string[];
  shortDesc: string;
  description: string;
  images: string[]; // Cloudinary public_ids
  specs: Record<string, string>;
  seoTags?: string[]; // Gizli SEO etiketleri — müşteri görmez, JSON-LD'ye gömülür
  createdAt: number;
  updatedAt: number;
}

export type Category =
  | 'Mobilya'
  | 'Beyaz Eşya'
  | 'Elektronik'
  | 'Ofis'
  | 'Yatak'
  | 'Baza'
  | 'Dekorasyon'
  | 'Aydınlatma'
  | 'Bahçe'
  | 'Ev Eşyaları'
  | 'Diğer';

export const CATEGORIES: Category[] = [
  'Mobilya',
  'Beyaz Eşya',
  'Elektronik',
  'Ofis',
  'Yatak',
  'Baza',
  'Dekorasyon',
  'Aydınlatma',
  'Bahçe',
  'Ev Eşyaları',
  'Diğer',
];

export const CONDITIONS = [
  'Sıfır',
  'Sıfır Gibi',
  'Az Kullanılmış',
  '2. El',
  'İyi Durumda',
  'Normal Durumda',
  'Parasına Göre',
  'Hasarlı/Onarım Gerekli',
] as const;

export interface FilterState {
  search: string;
  category: Category | '';
  condition: 'Sıfır' | 'Sıfır Gibi' | 'Az Kullanılmış' | '2. El' | 'İyi Durumda' | 'Normal Durumda' | 'Parasına Göre' | 'Hasarlı/Onarım Gerekli' | '';
  inStock: boolean | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
}
