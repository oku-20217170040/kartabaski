import { Product } from '@/types';
import { cloudinaryThumb } from './products';

// Firestore belgelerinden gelebilecek tüm alias'ları kapsayan tip
type RawProduct = Product & Record<string, unknown>;

export function getTitle(p: Product): string {
  const r = p as RawProduct;
  return (r.title || r.baslik || r.isim || r.name || '—') as string;
}

export function getPrice(p: Product): number {
  const r = p as RawProduct;
  return (r.priceTRY ?? r.price ?? r.fiyat ?? r.Price ?? 0) as number;
}

export function getCategory(p: Product): string {
  const r = p as RawProduct;
  return (r.category || r.kategori || r.Category || '') as string;
}

export function getCondition(p: Product): string {
  const r = p as RawProduct;
  return (r.condition || r.durum || r.kondisyon || '') as string;
}

export function getInStock(p: Product): boolean {
  const r = p as RawProduct;
  return (r.inStock ?? r.stok ?? r.stock ?? true) as boolean;
}

export function getTags(p: Product): string[] {
  const r = p as RawProduct;
  return (r.tags || r.etiketler || []) as string[];
}

export function getSlug(p: Product): string {
  const r = p as RawProduct;
  return (r.slug || r.id || p.id) as string;
}

export function getImageSrc(p: Product): string | null {
  const r = p as RawProduct;
  const imageField = (r.images as string[] | undefined)?.[0] || r.image || r.foto || r.img || null;
  if (!imageField || typeof imageField !== 'string') return null;
  return imageField.startsWith('http') ? imageField : cloudinaryThumb(imageField);
}

export function getFeatured(p: Product): boolean {
  const r = p as RawProduct;
  return (r.featured ?? false) as boolean;
}

export function getHasDelivery(p: Product): boolean {
  const r = p as RawProduct;
  return (r.nakliye ?? r.delivery ?? false) as boolean;
}
