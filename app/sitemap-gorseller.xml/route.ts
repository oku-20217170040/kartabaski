import { getProductsServer } from '@/lib/products-server';
import { listPublishedPosts } from '@/lib/posts';
import { cloudinaryUrl } from '@/lib/format';
import { getActive, getSlug } from '@/lib/product-utils';
import { SITE_URL } from '@/lib/site';
import { escapeXml } from '@/lib/seo-text';

export const revalidate = 3600;

const full = (id: string) => (id.startsWith('http') ? id : cloudinaryUrl(id, 'f_auto,q_auto,w_1200,c_limit'));

const entry = (page: string, images: string[]) =>
  `<url><loc>${escapeXml(page)}</loc>${images.map((i) => `<image:image><image:loc>${escapeXml(full(i))}</image:loc></image:image>`).join('')}</url>`;

/** Görsel site haritası: ürün fotoğrafları (renkler dahil) ve blog kapakları. */
export async function GET() {
  const [products, posts] = await Promise.all([
    getProductsServer().catch(() => []),
    listPublishedPosts().catch(() => []),
  ]);
  const rows = [
    ...products.filter(getActive).map((p) => {
      const colors = (p as { colors?: { images?: string[] }[] }).colors ?? [];
      const images = Array.from(new Set([...(p.images ?? []), ...colors.flatMap((c) => c.images ?? [])])).filter(Boolean).slice(0, 50);
      return images.length ? entry(`${SITE_URL}/urun/${getSlug(p) || p.id}`, images) : '';
    }),
    ...posts.map((p) => (p.coverImage ? entry(`${SITE_URL}/blog/${p.slug}`, [p.coverImage]) : '')),
  ].filter(Boolean);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...rows,
    '</urlset>',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
