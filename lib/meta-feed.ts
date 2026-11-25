import type { Product } from '@/types';
import { getCategory, getActive, getDescription, getPriceMin, getShortDesc, getSlug, getTitle } from './product-utils';
import { cloudinaryUrl, displayTitle } from './format';

// Meta Commerce katalog feed'i (RSS 2.0 + g: ad alanı). Meta bu adresi zamanlanmış olarak okur;
// pasife alınan ürünler feed'e girmez, böylece değişiklik otomatik olarak kataloğa yansır.
// Kupa ürünleri modeldir: fiyat olarak başlangıç fiyatı (priceMin) yazılır, her zaman "yeni" ve "stokta" sayılır.

export const META_FEED_BRAND = 'KAR-TA BASKI';

const MAX_TITLE = 150;
const MAX_DESC = 5000;

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const clean = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

/** Meta fiyat biçimi: "150.00 TRY". */
export function formatPrice(priceTRY: number): string {
  return `${priceTRY.toFixed(2)} TRY`;
}

const JPG = 'f_jpg,q_auto,w_1080,c_limit';

function cloudImages(p: Product): string[] {
  return (p.images ?? []).filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** Görsel adresi: Cloudinary public_id veya tam URL. Meta JPG/PNG ister, bu yüzden f_jpg zorlanır. */
export function imageUrlFor(p: Product): string | null {
  const first = cloudImages(p)[0];
  if (!first) return null;
  return first.startsWith('http') ? first : cloudinaryUrl(first, JPG);
}

/** Çoklu görselli gönderi için ürünün tüm görselleri (en fazla `max`). Boşsa []. */
export function imageUrlsFor(p: Product, max = 10): string[] {
  return cloudImages(p).slice(0, max).map((img) => (img.startsWith('http') ? img : cloudinaryUrl(img, JPG)));
}

/** Feed'e girebilecek ürün: aktif, başlangıç fiyatı > 0 ve fotoğrafı olan. */
export function isFeedEligible(p: Product): boolean {
  return getActive(p) && getPriceMin(p) > 0 && imageUrlFor(p) !== null;
}

function itemXml(p: Product, siteUrl: string): string {
  const title = clip(clean(displayTitle(getTitle(p))), MAX_TITLE);
  const body = clean(getDescription(p) || getShortDesc(p) || getTitle(p));
  const desc = clip(`Kişiye özel baskı. ${body}`, MAX_DESC);
  const slug = getSlug(p) || p.id;
  const category = getCategory(p) || 'Özel Tasarım';
  const lines = [
    `    <g:id>${xmlEscape(p.id)}</g:id>`,
    `    <title>${xmlEscape(title)}</title>`,
    `    <g:title>${xmlEscape(title)}</g:title>`,
    `    <g:description>${xmlEscape(desc)}</g:description>`,
    `    <link>${xmlEscape(`${siteUrl}/urun/${slug}`)}</link>`,
    `    <g:image_link>${xmlEscape(imageUrlFor(p) ?? '')}</g:image_link>`,
    `    <g:availability>in stock</g:availability>`,
    `    <g:condition>new</g:condition>`,
    `    <g:price>${formatPrice(getPriceMin(p))}</g:price>`,
    `    <g:brand>${xmlEscape(META_FEED_BRAND)}</g:brand>`,
    `    <g:product_type>${xmlEscape(category)}</g:product_type>`,
  ];
  return `  <item>\n${lines.join('\n')}\n  </item>`;
}

/** Tüm feed'i üretir. Uygun olmayan ürünler sessizce atlanır. */
export function buildMetaFeedXml(products: Product[], siteUrl: string): string {
  const items = products.filter(isFeedEligible).map((p) => itemXml(p, siteUrl));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title>${xmlEscape(META_FEED_BRAND)}</title>`,
    `    <link>${xmlEscape(siteUrl)}</link>`,
    `    <description>${xmlEscape('KAR-TA BASKI kişiye özel baskılı kupa ve fincan modelleri')}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
