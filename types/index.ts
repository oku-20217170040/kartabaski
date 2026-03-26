export interface Product {
  id: string;
  title: string;
  slug: string;
  priceTRY: number;
  category: Category;
  condition: 'Sıfır' | '2. El';
  inStock: boolean;
  featured?: boolean;
  tags: string[];
  shortDesc: string;
  description: string;
  images: string[]; // Cloudinary public_ids
  specs: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export type Category =
  | 'Mobilya'
  | 'Beyaz Eşya'
  | 'Elektronik'
  | 'Ofis'
  | 'Yatak'
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
  'Dekorasyon',
  'Aydınlatma',
  'Bahçe',
  'Ev Eşyaları',
  'Diğer',
];

export const CONDITIONS = ['Sıfır', '2. El'] as const;

export interface FilterState {
  search: string;
  category: Category | '';
  condition: 'Sıfır' | '2. El' | '';
  inStock: boolean | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
}
