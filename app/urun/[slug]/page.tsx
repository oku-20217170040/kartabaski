import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { getProductBySlugServer, getSimilarProductsServer, getProductsServer } from '@/lib/products-server';
import { cloudinaryUrl, formatPriceRange } from '@/lib/format';
import ProductDetailClient from './ProductDetailClient';
import ProductReviews from '@/components/ProductReviews';
import RelatedPosts from '@/components/RelatedPosts';
import { getReviewAggregate } from '@/lib/reviews';
import { PHONE, SITE_NAME } from '@/lib/constants';
import { SITE_URL, jsonLdString } from '@/lib/site';
import { getTitle, getPriceMin, getPriceMax, getCategory, getActive, getFirstImageId, getShortDesc, getDescription } from '@/lib/product-utils';

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

// generateMetadata + sayfa aynı isteği paylaşır; ayrıca Firestore'a her istekte gidilmez.
const getProductCached = unstable_cache(
  async (slug: string) => getProductBySlugServer(slug),
  ['product-by-slug'],
  { tags: ['products'], revalidate: 3600 },
);

const getSimilarCached = unstable_cache(
  async (category: string, excludeId: string) => getSimilarProductsServer(category, excludeId),
  ['similar-products'],
  { tags: ['products'], revalidate: 3600 },
);

const getAllProductsCached = unstable_cache(() => getProductsServer(), ['products'], {
  tags: ['products'],
  revalidate: 3600,
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const product = await getProductCached(slug).catch(() => null);

  // notFound() burada çağrılmalı: metadata akış başlamadan çözülür, böylece gerçek 404 durum kodu döner
  // (kök loading.tsx sayfayı Suspense ile sardığı için sayfa gövdesindeki notFound() 200 ile akıyor).
  if (!product || !getActive(product)) notFound();

  const title = getTitle(product);
  const description = getShortDesc(product) || getDescription(product) || `${title} – KAR-TA BASKI'da özel baskı`;
  const priceMin = getPriceMin(product);
  const priceMax = getPriceMax(product);
  const priceLabel = formatPriceRange(priceMin, priceMax);
  const category = getCategory(product);
  const imageId = getFirstImageId(product);
  const imageUrl = imageId
    ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_1200,h_630,c_fill'))
    : undefined;

  return {
    title: `${title}${priceMin ? ` – ${priceLabel}` : ''}`,
    description: `${description} | KAR-TA BASKI`,
    keywords: [title, category, 'kupa baskı', 'özel tasarım', 'sihirli kupa', 'kar-ta baski'],
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      type: 'website',
      locale: 'tr_TR',
      url: `${SITE_URL}/urun/${slug}`,
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 630, alt: title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    alternates: {
      canonical: `${SITE_URL}/urun/${slug}`,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = params;

  const product = await getProductCached(slug).catch(() => null);
  if (!product || !getActive(product)) notFound();

  const category = getCategory(product);
  const sameCategory = await getSimilarCached(category, product.id).catch(() => []);
  // Kategoriler küçük (1–3 ürün); "Benzer ürünler" boş kalmasın diye diğer aktif ürünlerle tamamla.
  let similar = sameCategory.slice(0, 4);
  if (similar.length < 4) {
    const all = await getAllProductsCached().catch(() => []);
    const taken = new Set([product.id, ...similar.map((p) => p.id)]);
    similar = [...similar, ...all.filter((p) => getActive(p) && !taken.has(p.id))].slice(0, 4);
  }

  const rating = await getReviewAggregate(product.id).catch(() => ({ count: 0, average: 0 }));
  const pTitle = getTitle(product);
  const priceMin = getPriceMin(product);
  const priceMax = getPriceMax(product);
  const imageId = getFirstImageId(product);
  const imageUrl = imageId
    ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_900,h_700,c_fill'))
    : undefined;
  const seoTags: string[] = product.seoTags || [];
  const productUrl = `${SITE_URL}/urun/${slug}`;

  const seller = { '@type': 'Organization', name: SITE_NAME, telephone: `+${PHONE}` };
  const common = {
    url: productUrl,
    priceCurrency: 'TRY',
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller,
  };
  const offers = priceMax > priceMin && priceMin > 0
    ? { '@type': 'AggregateOffer', ...common, lowPrice: String(priceMin), highPrice: String(priceMax) }
    : { '@type': 'Offer', ...common, ...(priceMin ? { price: String(priceMin) } : {}) };

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pTitle,
    description: getShortDesc(product) || getDescription(product) || `${pTitle} – KAR-TA BASKI'da özel kupa baskı`,
    ...(product.productCode && { sku: product.productCode }),
    ...(category && { category }),
    ...(seoTags.length > 0 && { keywords: seoTags.join(', ') }),
    ...(imageUrl && { image: imageUrl }),
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers,
    ...(rating.count > 0 && {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average.toFixed(1), reviewCount: rating.count },
    }),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      ...(category
        ? [{ '@type': 'ListItem', position: 2, name: category, item: `${SITE_URL}/kategoriler` }]
        : []),
      { '@type': 'ListItem', position: category ? 3 : 2, name: pTitle, item: productUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbSchema) }} />
      <ProductDetailClient slug={slug} product={product} similar={similar} />
      <ProductReviews productId={product.id} />
      <RelatedPosts productId={product.id} category={category} />
    </>
  );
}
