import { Metadata } from 'next';
import { getProductBySlug, getProductById, cloudinaryUrl } from '@/lib/products';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: { slug: string };
}

const SITE_URL = 'https://umit-spot.vercel.app';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  if (!product) return { title: 'Ürün Bulunamadı' };

  const raw = product as any;
  const title = raw.title || raw.baslik || raw.name || 'Ürün';
  const description = raw.shortDesc || raw.description || raw.aciklama || `${title} – Ümit Spot'ta uygun fiyata`;
  const price = raw.priceTRY ?? raw.price ?? raw.fiyat;
  const category = raw.category || raw.kategori || '';
  const imageId = raw.images?.[0];
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
    const raw = product as any;
    const title = raw.title || raw.baslik || raw.name || 'Ürün';
    const price = raw.priceTRY ?? raw.price ?? raw.fiyat;
    const condition = raw.condition || raw.durum || '2. El';
    const inStock = raw.inStock ?? raw.stok ?? true;
    const imageId = raw.images?.[0];
    const imageUrl = imageId
      ? (imageId.startsWith('http') ? imageId : cloudinaryUrl(imageId, 'f_auto,q_auto,w_900,h_700,c_fill'))
      : undefined;

    productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: raw.shortDesc || raw.description || `${title} – Esenyurt Ümit Spot'ta satışta`,
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
          telephone: '+905426447296',
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
