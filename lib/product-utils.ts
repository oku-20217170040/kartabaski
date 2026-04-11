import { Product } from '@/types';
import { cloudinaryThumb } from './products';

// Firestore belgelerinden gelebilecek tüm alias'ları kapsayan tip
type RawProduct = Product & Record<string, unknown>;

export function getTitle(p: Product): string {
  const r = p as RawProduct;
  return (r.title || r.baslik || r.isim || r.name || '—') as string;
}

export function getPriceMin(p: Product): number {
  const r = p as RawProduct;
  return ((r.priceMin as number) || (r.priceTRY as number) || (r.price as number) || (r.fiyat as number) || 0);
}

export function getPriceMax(p: Product): number {
  const r = p as RawProduct;
  return ((r.priceMax as number) || (r.priceMin as number) || (r.priceTRY as number) || (r.price as number) || (r.fiyat as number) || 0);
}

// Eski kodlarla uyumluluk için alias
export function getPrice(p: Product): number {
  return getPriceMin(p);
}

export function getCategory(p: Product): string {
  const r = p as RawProduct;
  return (r.category || r.kategori || r.Category || '') as string;
}

export function getActive(p: Product): boolean {
  const r = p as RawProduct;
  return (r.active ?? r.inStock ?? r.stok ?? r.stock ?? true) as boolean;
}

// Eski kodlarla uyumluluk için alias
export function getInStock(p: Product): boolean {
  return getActive(p);
}

export function getDeliveryDays(p: Product): number {
  const r = p as RawProduct;
  return (r.deliveryDays ?? 3) as number;
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

export function getCreatedAt(p: Product): number {
  return p.createdAt ?? 0;
}

export function getShortDesc(p: Product): string {
  const r = p as RawProduct;
  return (r.shortDesc || r.aciklama || '') as string;
}

export function getDescription(p: Product): string {
  const r = p as RawProduct;
  return (r.description || r.aciklama || '') as string;
}

export function getFirstImageId(p: Product): string | null {
  return p.images?.[0] ?? null;
}
