'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { useState, useRef, useEffect } from 'react';
import {
  getTitle, getPriceMin, getPriceMax, getCategory,
  getSlug, getImageSrc, getFeatured,
} from '@/lib/product-utils';
import { formatPriceRange, cloudinaryUrl } from '@/lib/products';

interface Props { product: Product }

export default function ProductCard({ product }: Props) {
  const [imgError, setImgError]     = useState(false);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [hoverColor, setHoverColor] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, []);

  const title      = getTitle(product);
  const priceMin   = getPriceMin(product);
  const priceMax   = getPriceMax(product);
  const category   = getCategory(product);
  const featured   = getFeatured(product);
  const slug       = getSlug(product);
  const priceLabel = formatPriceRange(priceMin, priceMax);
  const colors     = product.colors?.filter(c => c.images[0]) ?? [];

  const baseImgSrc = imgError ? null : getImageSrc(product);
  const activeImgSrc = hoverColor !== null && colors[hoverColor]
    ? cloudinaryUrl(colors[hoverColor].images[0], 'f_auto,q_auto,w_600,h_600,c_fill')
    : baseImgSrc;

  return (
    <Link
      href={`/urun/${slug}`}
      className="tcard"
      onMouseLeave={() => setHoverColor(null)}
    >
      {/* Görsel */}
      <div className="tcard-img-wrap">
        {activeImgSrc ? (
          <>
            {!imgLoaded && <div className="tcard-skeleton" />}
            <motion.img
              ref={imgRef}
              key={hoverColor ?? 'base'}
              src={activeImgSrc}
              alt={title}
              loading="eager"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="tcard-img"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease', animation: hoverColor !== null ? 'galleryFadeIn 0.25s ease' : undefined }}
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

        {/* Renk varyant thumbnail'leri — hover'da sol kenar */}
        {colors.length > 0 && (
          <div className="tcard-colors">
            {colors.map((c, i) => {
              const thumb = cloudinaryUrl(c.images[0], 'f_auto,q_auto,w_80,h_80,c_fill');
              return (
                <button
                  key={i}
                  className={`tcard-color-btn${hoverColor === i ? ' tcard-color-btn--active' : ''}`}
                  onMouseEnter={e => { e.preventDefault(); setHoverColor(i); }}
                  onClick={e => e.preventDefault()}
                  title={c.name}
                  tabIndex={-1}
                >
                  <img src={thumb} alt={c.name} />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
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
