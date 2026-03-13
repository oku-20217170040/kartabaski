'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { cloudinaryThumb } from '@/lib/products';
import { useState } from 'react';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const raw = product as any;
  const [imgError, setImgError] = useState(false);

  const title: string  = raw.title || raw.baslik || raw.isim || raw.name || '—';
  const price: number  = raw.priceTRY ?? raw.price ?? raw.fiyat ?? raw.Price ?? 0;
  const category: string = raw.category || raw.kategori || raw.Category || '';
  const condition: string = raw.condition || raw.durum || raw.kondisyon || '';
  const inStock: boolean  = raw.inStock ?? raw.stok ?? raw.stock ?? true;
  const hasDelivery: boolean = raw.nakliye ?? raw.delivery ?? false;
  const tags: string[]  = raw.tags || raw.etiketler || [];
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

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ height: '100%' }}
    >
      <Link href={`/urun/${slug}`} className="product-card pc-pro" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* ── Image ── */}
        <div className="product-card-img" style={{ position: 'relative', overflow: 'hidden' }}>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={title}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{ transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}
              className="pc-img"
            />
          ) : (
            <div className="product-card-no-img">🛋️</div>
          )}

          {/* Dark gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(11,15,20,0.7) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />

          {/* Out-of-stock dim */}
          {!inStock && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(11,15,20,0.55)',
              backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                background: 'rgba(248,81,73,0.9)',
                color: '#fff', fontWeight: 700, fontSize: 13,
                padding: '6px 16px', borderRadius: 20,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>Satıldı</span>
            </div>
          )}

          {/* Badges top-left */}
          <div className="product-card-badges" style={{ zIndex: 2 }}>
            {featured && (
              <span style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0b0f14', fontWeight: 700, fontSize: 11,
                padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em',
              }}>⭐ Öne Çıkan</span>
            )}
            {condition && (
              <span style={{
                background: `${conditionColor}22`,
                border: `1px solid ${conditionColor}44`,
                color: conditionColor,
                fontWeight: 700, fontSize: 11,
                padding: '3px 10px', borderRadius: 20,
              }}>{condition}</span>
            )}
          </div>

          {/* Delivery badge top-right */}
          {hasDelivery && (
            <span style={{
              position: 'absolute', top: 10, right: 10, zIndex: 2,
              background: 'rgba(47,129,247,0.15)',
              border: '1px solid rgba(47,129,247,0.3)',
              color: 'var(--accent2)',
              fontSize: 10, fontWeight: 700, padding: '3px 8px',
              borderRadius: 20, backdropFilter: 'blur(4px)',
              letterSpacing: '0.03em',
            }}>🚚 Nakliye</span>
          )}
        </div>

        {/* ── Body ── */}
        <div className="product-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

          <div className="product-card-title">{title}</div>

          {/* Price row */}
          {formatted && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="product-card-price">₺{formatted}</span>
              {inStock && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                  background: 'rgba(37,211,102,0.1)',
                  border: '1px solid rgba(37,211,102,0.2)',
                  padding: '2px 7px', borderRadius: 10,
                }}>✓ Stokta</span>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="product-card-meta" style={{ marginTop: 'auto' }}>
            {category && (
              <span className="badge badge-muted" style={{ fontSize: 10 }}>{category}</span>
            )}
            {tags?.slice(0, 2).map((tag: string) => (
              <span key={tag} className="badge badge-blue" style={{ fontSize: 10 }}>{tag}</span>
            ))}
          </div>
        </div>

      </Link>

      <style>{`
        .pc-pro { transition: box-shadow 0.25s, border-color 0.25s; }
        .pc-pro:hover { border-color: rgba(47,129,247,0.4) !important; box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(47,129,247,0.15) !important; }
        .pc-pro:hover .pc-img { transform: scale(1.07); }
      `}</style>
    </motion.div>
  );
}
