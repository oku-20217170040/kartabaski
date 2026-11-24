import { MetadataRoute } from 'next';
import { getProductsServer } from '@/lib/products-server';
import { SITE_URL } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const now = new Date();

  let products: MetadataRoute.Sitemap = [];
  try {
    const items = await getProductsServer();
    products = items
      .filter((p) => p.active !== false)
      .map((p) => {
        const ts = p.updatedAt || p.createdAt;
        return {
          url: `${base}/urun/${p.slug || p.id}`,
          ...(ts ? { lastModified: new Date(ts) } : {}),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        };
      });
  } catch (err) {
    console.error('[sitemap] ürünler alınamadı:', err);
  }

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/kategoriler`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/kurumsal`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/nasil-siparis-verilir`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/hakkimizda`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    ...products,
  ];
}
