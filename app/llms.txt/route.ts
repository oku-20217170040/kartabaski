import { getProductsServer } from '@/lib/products-server';
import { listPublishedPosts } from '@/lib/posts';
import { HOME_FAQ } from '@/lib/faq';
import { displayTitle, formatPriceRange } from '@/lib/format';
import { getActive, getDescription, getPriceMax, getPriceMin, getShortDesc, getSlug, getTitle } from '@/lib/product-utils';
import { plainText } from '@/lib/seo-text';
import { PHONE, PHONE_DISPLAY, SITE_NAME } from '@/lib/constants';
import { INSTAGRAM_URL, SITE_URL } from '@/lib/site';

// Yapay zekâ asistanları için sitenin özeti (llmstxt.org). Yalnız sitedeki gerçek bilgiler yazılır.
export const revalidate = 3600;

export async function GET() {
  const [products, posts] = await Promise.all([
    getProductsServer().catch(() => []),
    listPublishedPosts(60).catch(() => []),
  ]);
  const productLines = products.filter(getActive).map((p) => {
    const price = getPriceMin(p) ? ` Fiyat: ${formatPriceRange(getPriceMin(p), getPriceMax(p))}.` : '';
    return `- [${displayTitle(getTitle(p))}](${SITE_URL}/urun/${getSlug(p) || p.id}): ${plainText(getDescription(p) || getShortDesc(p), 900)}${price}`;
  });
  const lines = [
    `# ${SITE_NAME}`,
    '',
    '> Kişiye özel kupa ve fincan baskısı yapan online mağaza. Tek adetten toplu siparişe, baskıdan önce önizleme onayı, Türkiye geneline kargo.',
    '',
    '## Sipariş',
    `- [Nasıl sipariş verilir](${SITE_URL}/nasil-siparis-verilir): kupayı tasarlayıp sepete ekleyin, siparişi WhatsApp’tan bildirin, önizlemeyi onaylayın.`,
    `- [Kupanızı tasarlayın](${SITE_URL}/konfigurator)`,
    `- [Kurumsal ve toplu sipariş](${SITE_URL}/kurumsal)`,
    `- [Sipariş takibi](${SITE_URL}/siparis-takip)`,
    `- Telefon ve WhatsApp: ${PHONE_DISPLAY} (+${PHONE})`,
    `- Instagram: ${INSTAGRAM_URL}`,
    '',
    '## Sık sorulan sorular',
    ...HOME_FAQ.flatMap((f) => [`### ${f.q}`, f.a, '']),
    '## Ürünler',
    ...productLines,
    '',
    '## Blog yazıları',
    ...posts.map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug}): ${plainText(p.excerpt, 180)}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
