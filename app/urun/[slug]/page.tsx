import { Metadata } from 'next';
import { getProductBySlug, getProductById, cloudinaryUrl, formatPriceRange } from '@/lib/products';
import ProductDetailClient from './ProductDetailClient';
import { PHONE, SITE_NAME } from '@/lib/constants';
import { getTitle, getPriceMin, getPriceMax, getCategory, getActive, getFirstImageId, getShortDesc, getDescription } from '@/lib/product-utils';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kartabaski.com';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  if (!product) return { title: 'Ürün Bulunamadı' };

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

  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  let productSchema = null;
  if (product) {
    const pTitle = getTitle(product);
    const priceMin = getPriceMin(product);
    const inStock = getActive(product);
    const imageId = getFirstImageId(product);
    const imageUrl = imageId
      ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_900,h_700,c_fill'))
      : undefined;

    const seoTags: string[] = product.seoTags || [];

    productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: pTitle,
      description: getShortDesc(product) || getDescription(product) || `${pTitle} – KAR-TA BASKI'da özel kupa baskı`,
      ...(seoTags.length > 0 && { keywords: seoTags.join(', ') }),
      ...(imageUrl && { image: imageUrl }),
      brand: { '@type': 'Brand', name: SITE_NAME },
      offers: {
        '@type': 'Offer',
        url: `${SITE_URL}/urun/${slug}`,
        priceCurrency: 'TRY',
        ...(priceMin && { price: String(priceMin) }),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: SITE_NAME,
          telephone: `+${PHONE}`,
        },
      },
    };
  }

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      <ProductDetailClient slug={slug} />
    </>
  );
}
