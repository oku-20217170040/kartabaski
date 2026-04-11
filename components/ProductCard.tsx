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
import { whatsappLink } from '@/lib/products';

interface Props { product: Product }

const WA_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const EYE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function ProductCard({ product }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const title    = getTitle(product);
  const priceMin = getPriceMin(product);
  const priceMax = getPriceMax(product);
  const category = getCategory(product);
  const active   = getActive(product);
  const featured = getFeatured(product);
  const imgSrc   = imgError ? null : getImageSrc(product);
  const slug     = getSlug(product);
  const priceLabel = formatPriceRange(priceMin, priceMax);

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="pro-card"
    >
      <Link href={`/urun/${slug}`} className="pro-card-link">

        {/* ── Image ── */}
        <div className="pro-card-img-wrap">
          {imgSrc ? (
            <>
              {!imgLoaded && <div className="pro-card-img-skeleton" />}
              <img
                src={imgSrc}
                alt={title}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className="pro-card-img"
                style={{
                  transform: hovered ? 'scale(1.08)' : 'scale(1)',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
                }}
              />
            </>
          ) : (
            <div className="pro-card-no-img">☕</div>
          )}

          {/* Gradient overlay */}
          <div className="pro-card-gradient" />

          {/* Top badges */}
          <div className="pro-card-badges">
            {featured && (
              <span className="pro-badge pro-badge-featured">⭐ Öne Çıkan</span>
            )}
          </div>

          {/* Hover overlay button */}
          <motion.div
            className="pro-card-hover-btn"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
            transition={{ duration: 0.2 }}
          >
            {EYE_ICON} İncele
          </motion.div>
        </div>

        {/* ── Body ── */}
        <div className="pro-card-body">
          {category && (
            <span className="pro-card-cat">{category}</span>
          )}
          <h3 className="pro-card-title">{title}</h3>

          <div className="pro-card-footer">
            <div className="pro-card-price-wrap">
              <span className="pro-card-price">{priceLabel}</span>
            </div>
            <span className="pro-card-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {/* WhatsApp buton */}
      <div style={{ padding: '0 16px 16px' }}>
        <a
          href={whatsappLink(title)}
          target="_blank"
          rel="noopener noreferrer"
          className="pro-card-wa-btn"
          onClick={(e) => e.stopPropagation()}
        >
          {WA_ICON} Sipariş Ver
        </a>
      </div>

    </motion.article>
  );
}
