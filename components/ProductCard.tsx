import Link from 'next/link';
import { Product } from '@/types';
import { cloudinaryThumb } from '@/lib/products';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  // Firestore'dan gelen veriyi normalize et — farklı alan isimleri için fallback
  const raw = product as any;

  const title: string =
    raw.title || raw.baslik || raw.isim || raw.name || '—';

  const price: number =
    raw.priceTRY ?? raw.price ?? raw.fiyat ?? raw.Price ?? 0;

  const category: string =
    raw.category || raw.kategori || raw.Category || '';

  const condition: string =
    raw.condition || raw.durum || raw.kondisyon || '';

  const inStock: boolean =
    raw.inStock ?? raw.stok ?? raw.stock ?? true;

  const tags: string[] =
    raw.tags || raw.etiketler || [];

  // Görsel: Cloudinary public_id veya direkt URL
  const imageField = raw.images?.[0] || raw.image || raw.foto || raw.img || null;
  let imgSrc: string | null = null;
  if (imageField) {
    imgSrc = imageField.startsWith('http')
      ? imageField
      : cloudinaryThumb(imageField);
  }

  // Slug: yoksa Firestore doküman id'sini kullan
  const slug: string = raw.slug || raw.id || product.id;

  const formatted = price
    ? new Intl.NumberFormat('tr-TR').format(price)
    : null;

  return (
    <Link href={`/urun/${slug}`} className="product-card">
      <div className="product-card-img">
        {imgSrc ? (
          <img src={imgSrc} alt={title} loading="lazy" />
        ) : (
          <div className="product-card-no-img">🛋️</div>
        )}
        <div className="product-card-badges">
          {!inStock && (
            <span className="badge badge-red">Stok Sor</span>
          )}
          {condition && (
            <span className={`badge ${condition === 'Sıfır' ? 'badge-green' : 'badge-orange'}`}>
              {condition}
            </span>
          )}
        </div>
      </div>

      <div className="product-card-body">
        <div className="product-card-title">{title}</div>
        {formatted && (
          <div className="product-card-price">₺{formatted}</div>
        )}
        <div className="product-card-meta">
          {category && <span className="badge badge-muted">{category}</span>}
          {inStock && (
            <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Stokta</span>
          )}
          {tags?.slice(0, 1).map((tag: string) => (
            <span key={tag} className="badge badge-blue" style={{ fontSize: 11 }}>{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
