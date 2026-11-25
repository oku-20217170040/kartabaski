import 'server-only';

import { unstable_cache } from 'next/cache';
import { getProductsServer } from './products-server';
import type { Product } from '@/types';

/** Blog sayfaları için ürünler: önbellekli (etiket 'products' ürün değişince temizlenir). */
export const getCachedProductsForBlog = unstable_cache(() => getProductsServer(), ['blog-products'], {
  tags: ['products'],
  revalidate: 3600,
});

/** Yazıdaki productIds sırasıyla, yalnızca aktif ürünler. */
export async function getProductsByIds(ids: string[] | undefined): Promise<Product[]> {
  if (!ids?.length) return [];
  const all = await getCachedProductsForBlog().catch(() => [] as Product[]);
  const map = new Map(all.map((p) => [p.id, p]));
  return ids.map((id) => map.get(id)).filter((p): p is Product => !!p && p.active !== false);
}
