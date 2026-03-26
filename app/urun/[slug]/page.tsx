import { Metadata } from 'next';
import { getProductBySlug, getProductById, cloudinaryUrl } from '@/lib/products';
import ProductDetailClient from './ProductDetailClient';
import { PHONE } from '@/lib/constants';
import { getTitle, getPrice, getCategory, getCondition, getInStock, getFirstImageId, getShortDesc, getDescription } from '@/lib/product-utils';

interface Props {
  params: { slug: string };
}

const SITE_URL = 'https://umit-spot.vercel.app';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  if (!product) return { title: 'Ürün Bulunamadı' };

  const title = getTitle(product);
  const description = getShortDesc(product) || getDescription(product) || `${title} – Ümit Spot'ta uygun fiyata`;
  const price = getPrice(product);
  const category = getCategory(product);
  const imageId = getFirstImageId(product);
  const imageUrl = imageId
    ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_1200,h_630,c_fill'))
    : undefined;

  return {
    title: `${title}${price ? ` – ₺${new Intl.NumberFormat('tr-TR').format(price)}` : ''}`,
    description: `${description} | Esenyurt Ümit Spot`,
    keywords: [title, category, 'ikinci el', 'spot', 'esenyurt', 'ümit spot'],
    openGraph: {
      title: `${title} | Ümit Spot`,
      description,
      type: 'website',
      locale: 'tr_TR',
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 630, alt: title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Ümit Spot`,
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

  // Product schema — Google ve AI motorları için
  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  let productSchema = null;
  if (product) {
    const pTitle = getTitle(product);
    const price = getPrice(product);
    const condition = getCondition(product) || '2. El';
    const inStock = getInStock(product);
    const imageId = getFirstImageId(product);
    const imageUrl = imageId
      ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_900,h_700,c_fill'))
      : undefined;

    productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: pTitle,
      description: getShortDesc(product) || getDescription(product) || `${pTitle} – Esenyurt Ümit Spot'ta satışta`,
      ...(imageUrl && { image: imageUrl }),
      brand: { '@type': 'Brand', name: 'Ümit Spot' },
      offers: {
        '@type': 'Offer',
        url: `${SITE_URL}/urun/${slug}`,
        priceCurrency: 'TRY',
        ...(price && { price: String(price) }),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
        itemCondition: condition === 'Sıfır'
          ? 'https://schema.org/NewCondition'
          : 'https://schema.org/UsedCondition',
        seller: {
          '@type': 'Organization',
          name: 'Ümit Spot',
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
