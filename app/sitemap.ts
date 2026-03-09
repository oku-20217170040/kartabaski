import { MetadataRoute } from 'next';
import { getProducts } from '@/lib/products';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://umitspot.com';

  let products: MetadataRoute.Sitemap = [];
  try {
    const items = await getProducts();
    products = items.map((p) => ({
      url: `${base}/urun/${p.slug || p.id}`,
      lastModified: new Date(p.updatedAt || p.createdAt || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {}

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...products,
  ];
}
