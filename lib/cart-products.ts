import type { Product } from '@/types';
import type { CartDesign, CartItem } from './cart-types';
import { lineKey, clampQty, NOTE_MAX } from './cart';
import { cloudinaryThumb, displayTitle } from './format';
import { getCategory, getPriceMin, getSlug, getTitle } from './product-utils';
import { newId } from './cart-files';

// Ürün tipine bağımlı sepet yardımcıları (saf mantık lib/cart.ts'te).

export interface AddOptions { qty?: number; color?: string; note?: string; design?: CartDesign; key?: string }

export function productToCartItem(p: Product, opts: AddOptions = {}): CartItem {
  const color = opts.color?.trim() || undefined;
  const colorImg = color ? p.colors?.find((c) => c.name === color)?.images?.[0] : undefined;
  const note = opts.note?.trim().slice(0, NOTE_MAX) || undefined;
  return {
    key: opts.key ?? (opts.design ? `d:${newId()}` : lineKey(p.id, color)),
    productId: p.id,
    slug: getSlug(p),
    title: displayTitle(getTitle(p)),
    unitPrice: getPriceMin(p) || 0,
    image: colorImg ?? p.images?.[0] ?? null,
    category: getCategory(p),
    qty: clampQty(opts.qty ?? 1),
    color,
    note,
    design: opts.design,
  };
}

/** Sepet satırı görseli: Cloudinary public_id ya da tam URL. */
export function cartImageSrc(image: string | null | undefined): string | null {
  if (!image) return null;
  return image.startsWith('http') ? image : cloudinaryThumb(image);
}
