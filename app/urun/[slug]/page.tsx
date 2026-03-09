import { Metadata } from 'next';
import { getProductBySlug, getProductById, cloudinaryUrl, whatsappLink } from '@/lib/products';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: { slug: string };
}

// Dinamik SEO — her ürün için ayrı title/description
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const product = await getProductBySlug(slug).catch(() => null)
    || await getProductById(slug).catch(() => null);

  if (!product) {
    return { title: 'Ürün Bulunamadı' };
  }

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
      canonical: `https://umitspot.com/urun/${slug}`,
    },
  };
}

export default function ProductDetailPage({ params }: Props) {
  return <ProductDetailClient slug={params.slug} />;
}
