import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types';
import {
  getTitle, getPriceMin, getPriceMax, getCategory, getSlug, getFeatured,
} from '@/lib/product-utils';
import { formatPriceRange, cloudinaryUrl, displayTitle, colorSwatch } from '@/lib/format';

interface Props {
  product: Product;
  /** Above-the-fold cards load eagerly. */
  priority?: boolean;
}

const CARD_TRANSFORM = 'f_auto,q_auto,w_640,h_800,c_fill';
const MAX_SWATCHES = 6;

function imageSrc(id: string) {
  return id.startsWith('http') ? id : cloudinaryUrl(id, CARD_TRANSFORM);
}

export default function ProductCard({ product, priority = false }: Props) {
  const title = displayTitle(getTitle(product));
  const priceMin = getPriceMin(product);
  const priceMax = getPriceMax(product);
  const ranged = priceMax > priceMin && priceMin > 0;
  const images = product.images ?? [];
  const primary = images[0] ?? product.colors?.find((c) => c.images[0])?.images[0];
  const alternate = images[1];

  const swatches = (product.colors ?? [])
    .map((c) => ({ name: c.name, value: colorSwatch(c.name) }))
    .filter((c): c is { name: string; value: string } => Boolean(c.value));

  return (
    <Link href={`/urun/${getSlug(product)}`} className="product-card">
      <div className="product-card-media">
        {primary ? (
          <>
            <Image
              src={imageSrc(primary)}
              alt={title}
              fill
              sizes="(max-width: 960px) 50vw, (max-width: 1080px) 33vw, 25vw"
              priority={priority}
            />
            {alternate && (
              <Image
                src={imageSrc(alternate)}
                alt=""
                fill
                className="is-alt"
                sizes="(max-width: 960px) 50vw, (max-width: 1080px) 33vw, 25vw"
              />
            )}
          </>
        ) : (
          <span className="product-card-noimg">Görsel hazırlanıyor</span>
        )}
        {getFeatured(product) && <span className="product-card-badge">Öne çıkan</span>}
      </div>

      <div className="product-card-body">
        <div>
          <h3 className="product-card-title">{title}</h3>
          <p className="product-card-cat">{getCategory(product)}</p>
        </div>
        <p className="product-card-price">
          {ranged && <small>başlayan</small>}
          {ranged ? formatPriceRange(priceMin, 0) : formatPriceRange(priceMin, priceMax)}
        </p>
      </div>

      {swatches.length > 0 && (
        <div className="swatches" aria-label={`${swatches.length} renk seçeneği`}>
          {swatches.slice(0, MAX_SWATCHES).map((s) => (
            <span key={s.name} className="swatch" style={{ background: s.value }} title={s.name} />
          ))}
          {swatches.length > MAX_SWATCHES && (
            <span className="swatches-more">+{swatches.length - MAX_SWATCHES}</span>
          )}
        </div>
      )}
    </Link>
  );
}
