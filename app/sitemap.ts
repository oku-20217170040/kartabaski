import { MetadataRoute } from 'next';
import { getProductsServer } from '@/lib/products-server';
import { SITE_URL } from '@/lib/site';
import { listPublishedPosts } from '@/lib/posts';

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

  let posts: MetadataRoute.Sitemap = [];
  try {
    const list = await listPublishedPosts();
    posts = list.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt || p.publishedAt || now.getTime()),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error('[sitemap] blog yazıları alınamadı:', err);
  }

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/kategoriler`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/kurumsal`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/nasil-siparis-verilir`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/siparis-takip`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/hakkimizda`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...posts,
    ...products,
  ];
}
