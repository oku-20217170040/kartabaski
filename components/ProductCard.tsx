'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getTitle, getPriceMin, getPriceMax, getCategory,
  getSlug, getImageSrc, getFeatured,
} from '@/lib/product-utils';
import { formatPriceRange, cloudinaryUrl } from '@/lib/products';

interface Props { product: Product }

const SLIDE_INTERVAL = 900; // ms — her varyant arası süre

export default function ProductCard({ product }: Props) {
  const [imgError, setImgError]     = useState(false);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [hoverColor, setHoverColor] = useState<number | null>(null);
  const cardRef   = useRef<HTMLAnchorElement>(null);
  const imgRef    = useRef<HTMLImageElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef  = useRef(0);

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

  const stopSlide = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    indexRef.current = 0;
    setHoverColor(null);
  }, []);

  const startSlide = useCallback(() => {
    if (colors.length < 2) return;
    indexRef.current = 0;
    setHoverColor(0);
    timerRef.current = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % colors.length;
      setHoverColor(indexRef.current);
    }, SLIDE_INTERVAL);
  }, [colors.length]);

  // Mobilde IntersectionObserver ile otomatik slayt
  useEffect(() => {
    if (colors.length < 2) return;
    const isMobile = () => window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile()) return;

    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { entry.isIntersecting ? startSlide() : stopSlide(); },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); stopSlide(); };
  }, [colors.length, startSlide, stopSlide]);

  const baseImgSrc = imgError ? null : getImageSrc(product);
  const activeImgSrc = hoverColor !== null && colors[hoverColor]
    ? cloudinaryUrl(colors[hoverColor].images[0], 'f_auto,q_auto,w_600,h_600,c_fill')
    : baseImgSrc;

  return (
    <Link
      ref={cardRef}
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

        {/* Renk varyant thumbnail'leri — hover'da sol kenar (masaüstü) */}
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

        {/* Mobil: alt nokta göstergesi */}
        {colors.length > 1 && hoverColor !== null && (
          <div className="tcard-slide-dots">
            {colors.map((_, i) => (
              <span key={i} className={`tcard-slide-dot${hoverColor === i ? ' tcard-slide-dot--active' : ''}`} />
            ))}
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
