/**
 * Konfigüratör bardakları ayrı bir koleksiyonda durur; sepete ürünmüş gibi girerler.
 * İstemci ve sunucu ortak kullanır.
 */
import type { ConfiguratorCup, Product } from '@/types';

export const CUP_ID_PREFIX = 'cfg_';
export const CUP_SLUG_PREFIX = 'konfig-';

export const isCupId = (productId: string) => productId.startsWith(CUP_ID_PREFIX);

/** Sepet/sipariş satırının tanıtım sayfası. */
export const lineHref = (slug: string) => (slug.startsWith(CUP_SLUG_PREFIX) ? '/konfigurator' : `/urun/${slug}`);

export function cupToProduct(cup: ConfiguratorCup): Product {
  const colors = (cup.colors ?? []).filter((c) => c.images?.[0]);
  return {
    id: `${CUP_ID_PREFIX}${cup.id}`,
    slug: `${CUP_SLUG_PREFIX}${cup.id}`,
    title: cup.name,
    category: 'Özel Tasarım',
    priceMin: cup.price || 0,
    priceMax: cup.price || 0,
    active: cup.active,
    shortDesc: '',
    description: '',
    images: cup.imagePublicId ? [cup.imagePublicId] : [],
    colors,
    deliveryDays: 3,
  } as unknown as Product;
}
