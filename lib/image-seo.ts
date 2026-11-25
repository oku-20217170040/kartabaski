// Görsel SEO için saf yardımcılar (testli): alt metin ve görsel sitemap XML'i.

export const ALT_MAX = 125; // ekran okuyucu ve arama motorları için makul uzunluk
export const SITEMAP_MAX_IMAGES = 1000; // sitemap protokolü: sayfa başına en fazla 1000 görsel

function cut(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s;
}

/**
 * Ürün fotoğrafı alt metni.
 * İlk (veya tek) fotoğraf: "{ürün} – {kategori}, kişiye özel baskı"; diğerleri: "{ürün} – {kategori}, fotoğraf 2/5".
 * Anahtar kelime doldurmadan, gerçeği tarif eder; 125 karakteri geçmez (ürün adı kısalır, ek kalır).
 */
export function productImageAlt(o: { title: string; category?: string; color?: string; index?: number; total?: number }): string {
  const title = o.title.trim();
  const meta = [o.category, o.color].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  const index = o.index ?? 0;
  const total = o.total ?? 1;
  const tail = index === 0 || total <= 1 ? 'kişiye özel baskı' : `fotoğraf ${index + 1}/${total}`;
  const suffix = `${meta ? `, ${meta}` : ''}, ${tail}`;
  const head = cut(title, Math.max(10, ALT_MAX - suffix.length - 3));
  return cut(`${head} –${suffix.startsWith(',') ? suffix.slice(1) : ` ${suffix}`}`, ALT_MAX);
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Google görsel sitemap'i (image:image). Görseli olmayan sayfalar atlanır. */
export function buildImageSitemapXml(entries: { loc: string; images: string[] }[]): string {
  const urls = entries
    .filter((e) => e.images.length > 0)
    .map((e) => {
      const imgs = e.images
        .slice(0, SITEMAP_MAX_IMAGES)
        .map((u) => `    <image:image><image:loc>${escapeXml(u)}</image:loc></image:image>`)
        .join('\n');
      return `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n${imgs}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
}
