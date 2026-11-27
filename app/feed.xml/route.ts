import { listPublishedPosts } from '@/lib/posts';
import { SITE_NAME } from '@/lib/constants';
import { SITE_URL } from '@/lib/site';
import { escapeXml } from '@/lib/seo-text';

export const revalidate = 3600;

/** Blog RSS akışı: son 50 yazı. */
export async function GET() {
  const posts = await listPublishedPosts(50).catch(() => []);
  const items = posts.map((p) => {
    const url = `${SITE_URL}/blog/${p.slug}`;
    return [
      '<item>',
      `<title>${escapeXml(p.title)}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${new Date(p.publishedAt || p.updatedAt).toUTCString()}</pubDate>`,
      `<description>${escapeXml(p.excerpt)}</description>`,
      '</item>',
    ].join('');
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeXml(SITE_NAME)} Blog</title>`,
    `<link>${SITE_URL}/blog</link>`,
    `<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
    '<description>Kupa baskı, hediye fikirleri ve özel günler üzerine yazılar</description>',
    '<language>tr-TR</language>',
    ...items,
    '</channel></rss>',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
