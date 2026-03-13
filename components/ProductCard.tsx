'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { cloudinaryThumb } from '@/lib/products';
import { useState } from 'react';

interface Props { product: Product }

const TRUCK_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="m16 8 5 3v5h-5V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const EYE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function ProductCard({ product }: Props) {
  const raw = product as any;
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const title: string     = raw.title || raw.baslik || raw.isim || raw.name || '—';
  const price: number     = raw.priceTRY ?? raw.price ?? raw.fiyat ?? raw.Price ?? 0;
  const category: string  = raw.category || raw.kategori || raw.Category || '';
  const condition: string = raw.condition || raw.durum || raw.kondisyon || '';
  const inStock: boolean  = raw.inStock ?? raw.stok ?? raw.stock ?? true;
  const hasDelivery: boolean = raw.nakliye ?? raw.delivery ?? false;
  const tags: string[]    = raw.tags || raw.etiketler || [];
  const featured: boolean = raw.featured ?? false;

  const imageField = raw.images?.[0] || raw.image || raw.foto || raw.img || null;
  let imgSrc: string | null = null;
  if (imageField && !imgError) {
    imgSrc = imageField.startsWith('http') ? imageField : cloudinaryThumb(imageField);
  }

  const slug: string = raw.slug || raw.id || product.id;
  const formatted = price ? new Intl.NumberFormat('tr-TR').format(price) : null;

  const conditionColor =
    condition === 'Sıfır' ? 'var(--accent)' :
    condition === '2. El'  ? '#f59e0b' : 'var(--muted)';

  const conditionBg =
    condition === 'Sıfır' ? 'rgba(37,211,102,0.12)' :
    condition === '2. El'  ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)';

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
            <img
              src={imgSrc}
              alt={title}
              loading="lazy"
              onError={() => setImgError(true)}
              className="pro-card-img"
              style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
            />
          ) : (
            <div className="pro-card-no-img">🛋️</div>
          )}

          {/* Gradient overlay */}
          <div className="pro-card-gradient" />

          {/* Out of stock overlay */}
          {!inStock && (
            <div className="pro-card-sold">
              <span>Satıldı</span>
            </div>
          )}

          {/* Top badges */}
          <div className="pro-card-badges">
            {featured && (
              <span className="pro-badge pro-badge-featured">⭐ Öne Çıkan</span>
            )}
            {condition && (
              <span
                className="pro-badge"
                style={{ background: conditionBg, borderColor: `${conditionColor}40`, color: conditionColor }}
              >
                {condition}
              </span>
            )}
          </div>

          {/* Delivery badge */}
          {hasDelivery && (
            <span className="pro-badge-delivery">
              {TRUCK_ICON} Nakliye
            </span>
          )}

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
          {/* Category */}
          {category && (
            <span className="pro-card-cat">{category}</span>
          )}

          {/* Title */}
          <h3 className="pro-card-title">{title}</h3>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="pro-card-tags">
              {tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="pro-tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Price + stock */}
          <div className="pro-card-footer">
            {formatted ? (
              <div className="pro-card-price-wrap">
                <span className="pro-card-price">₺{formatted}</span>
                {inStock && (
                  <span className="pro-card-in-stock">✓ Stokta</span>
                )}
              </div>
            ) : (
              <span className="pro-card-price" style={{ color: 'var(--muted)', fontSize: 14 }}>Fiyat sorununuz</span>
            )}

            <span className="pro-card-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      <style>{`
        .pro-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .pro-card:hover {
          border-color: rgba(47,129,247,0.35);
          box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(47,129,247,0.12);
        }
        .pro-card-link {
          display: flex;
          flex-direction: column;
          height: 100%;
          text-decoration: none;
          color: inherit;
        }

        /* Image */
        .pro-card-img-wrap {
          position: relative;
          overflow: hidden;
          height: 200px;
          background: #111820;
          flex-shrink: 0;
        }
        .pro-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.4,0,0.2,1);
        }
        .pro-card-no-img {
          width: 100%; height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          opacity: 0.3;
        }
        .pro-card-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(11,15,20,0.75) 0%, transparent 55%);
          pointer-events: none;
        }

        /* Sold overlay */
        .pro-card-sold {
          position: absolute;
          inset: 0;
          background: rgba(11,15,20,0.6);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
        }
        .pro-card-sold span {
          background: rgba(248,81,73,0.92);
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          padding: 7px 20px;
          border-radius: 100px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* Badges */
        .pro-card-badges {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 3;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .pro-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 100px;
          border: 1px solid;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          backdrop-filter: blur(6px);
        }
        .pro-badge-featured {
          background: linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9));
          border-color: transparent;
          color: #0b0f14;
        }
        .pro-badge-delivery {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 100px;
          background: rgba(47,129,247,0.15);
          border: 1px solid rgba(47,129,247,0.3);
          color: var(--accent2);
          font-size: 10px;
          font-weight: 700;
          backdrop-filter: blur(6px);
        }

        /* Hover overlay */
        .pro-card-hover-btn {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 4;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 18px;
          border-radius: 100px;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
        }

        /* Body */
        .pro-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
        }
        .pro-card-cat {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .pro-card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.4;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .pro-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .pro-tag {
          padding: 2px 8px;
          border-radius: 100px;
          background: rgba(47,129,247,0.08);
          border: 1px solid rgba(47,129,247,0.15);
          color: var(--accent2);
          font-size: 10px;
          font-weight: 600;
        }
        .pro-card-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .pro-card-price-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pro-card-price {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .pro-card-in-stock {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent);
          background: rgba(37,211,102,0.1);
          border: 1px solid rgba(37,211,102,0.2);
          padding: 2px 8px;
          border-radius: 100px;
        }
        .pro-card-arrow {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          transition: background 0.2s, color 0.2s;
          flex-shrink: 0;
        }
        .pro-card:hover .pro-card-arrow {
          background: rgba(47,129,247,0.15);
          border-color: rgba(47,129,247,0.3);
          color: var(--accent2);
        }
      `}</style>
    </motion.article>
  );
}
