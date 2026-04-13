'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { useState } from 'react';
import {
  getTitle, getPriceMin, getPriceMax, getCategory, getActive,
  getSlug, getImageSrc, getFeatured,
} from '@/lib/product-utils';
import { formatPriceRange } from '@/lib/products';

interface Props { product: Product }

export default function ProductCard({ product }: Props) {
  const [imgError, setImgError]   = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const title      = getTitle(product);
  const priceMin   = getPriceMin(product);
  const priceMax   = getPriceMax(product);
  const category   = getCategory(product);
  const featured   = getFeatured(product);
  const imgSrc     = imgError ? null : getImageSrc(product);
  const slug       = getSlug(product);
  const priceLabel = formatPriceRange(priceMin, priceMax);

  return (
    <Link href={`/urun/${slug}`} className="tcard">
      {/* Görsel */}
      <div className="tcard-img-wrap">
        {imgSrc ? (
          <>
            {!imgLoaded && <div className="tcard-skeleton" />}
            <motion.img
              src={imgSrc}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="tcard-img"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </>
        ) : (
          <div className="tcard-no-img">☕</div>
        )}

        {featured && (
          <span className="tcard-badge">⭐ Öne Çıkan</span>
        )}
      </div>

      {/* Bilgi */}
      <div className="tcard-body">
        <p className="tcard-cat">{category}</p>
        <h3 className="tcard-title">{title}</h3>
        <p className="tcard-price">{priceLabel}</p>
      </div>
    </Link>
  );
}
