import { MetadataRoute } from 'next';
import { getProducts } from '@/lib/products';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://kartabaski.com';

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
    { url: `${base}/kategoriler`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/kurumsal`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/nasil-siparis-verilir`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/hakkimizda`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...products,
  ];
}
