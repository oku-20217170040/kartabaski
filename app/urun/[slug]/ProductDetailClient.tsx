'use client';

import { useEffect, useState } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kartabaski.com';

function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/urun/${slug}`;
  const waShareText = `${title} – KAR-TA BASKI'da bu ürüne bak!\n${url}`;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(waShareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <a
        href={waShareUrl}
        target="_blank" rel="noopener noreferrer"
        style={chipStyle}
        title="WhatsApp'ta Paylaş"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Paylaş
      </a>
      <button
        onClick={handleCopy}
        style={chipStyle}
        title="Linki Kopyala"
      >
        {copied ? (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#006D2F" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Kopyalandı</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Kopyala</>
        )}
      </button>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--text-sub)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', textDecoration: 'none', transition: 'border-color 0.15s',
};

import { cloudinaryUrl, cloudinaryThumb, whatsappLink, formatPriceRange } from '@/lib/products';
import { Product } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { getTitle, getPriceMin, getPriceMax, getCategory, getSlug, getDescription } from '@/lib/product-utils';

interface Props {
  slug: string;
  product: Product | null;
  similar: Product[];
}

export default function ProductDetailClient({ slug, product, similar }: Props) {
  const colors = product?.colors ?? [];
  const [selectedColor, setSelectedColor] = useState<number | null>(colors.length > 0 ? 0 : null);
  const [activeImg, setActiveImg]   = useState(0);
  const [lightbox, setLightbox]     = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => { setActiveImg(0); }, [selectedColor]);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(i => i !== null ? (i + 1) : null);
      if (e.key === 'ArrowLeft')  setLightbox(i => i !== null ? (i - 1) : null);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [lightbox]);

  if (!slug || slug === 'undefined') {
    return (
      <>
        <Navbar />
        <div className="container" style={{ paddingTop: 120 }}>
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-title">Geçersiz ürün bağlantısı</div>
            <Link href="/" className="btn btn-secondary" style={{ marginTop: 20, display: 'inline-flex' }}>← Ürünlere Dön</Link>
          </div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ paddingTop: 120 }}>
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-title">Ürün bulunamadı</div>
            <Link href="/" className="btn btn-secondary" style={{ marginTop: 20, display: 'inline-flex' }}>← Ürünlere Dön</Link>
          </div>
        </div>
      </>
    );
  }

  const title        = getTitle(product);
  const priceMin     = getPriceMin(product);
  const priceMax     = getPriceMax(product);
  const category     = getCategory(product);
  const description  = getDescription(product);
  const productSlug  = getSlug(product);
  const deliveryDays = product.deliveryDays ?? 3;

  const activeColorImages: string[] | null = (() => {
    if (selectedColor !== null && colors[selectedColor]?.images?.length) {
      return colors[selectedColor].images.map(id => id.startsWith('http') ? id : cloudinaryUrl(id));
    }
    const raw = product.images || [];
    return raw.length ? raw.map(id => id.startsWith('http') ? id : cloudinaryUrl(id)) : null;
  })();
  const images = activeColorImages;

  const priceLabel = formatPriceRange(priceMin, priceMax);

  return (
    <>
      <Navbar />
      <main className="detail-page-main" style={{ paddingTop: 'calc(var(--nav-h) + 40px)', paddingBottom: 80 }}>
        <div className="container">

          {/* Breadcrumb */}
          <nav style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 36, fontSize: 13, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Ürünler</Link>
            {category && (
              <><span>›</span>
              <Link href="/kategoriler" style={{ color: 'var(--muted)' }}>{category}</Link></>
            )}
            <span>›</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{title}</span>
          </nav>

          {/* Ana layout — stitch 12-col grid */}
          <div className="detail-grid">

            {/* Sol: Galeri (7/12) */}
            <div className="detail-gallery">
              {/* Ana görsel — renk sidebar'ı ile birlikte */}
              <div
                className="detail-main-img"
                style={{ cursor: images ? 'zoom-in' : 'default' }}
                onClick={() => images && setLightbox(activeImg)}
                onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={e => {
                  if (touchStartX === null || !images || images.length < 2) return;
                  const diff = touchStartX - e.changedTouches[0].clientX;
                  if (Math.abs(diff) < 40) return;
                  setActiveImg(diff > 0
                    ? (activeImg + 1) % images.length
                    : (activeImg - 1 + images.length) % images.length);
                  setTouchStartX(null);
                }}
              >
                {images ? (
                  <img src={images[activeImg]} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', opacity: 0.15 }}>☕</div>
                )}

                {/* Renk varyant sidebar — sol üst köşe, fotoğrafın üzerinde */}
                {colors.length > 0 && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: 10, left: 10, bottom: 10,
                      display: 'flex', flexDirection: 'column', gap: 6,
                      overflowY: 'auto',
                      scrollbarWidth: 'none',
                      paddingRight: 2,
                      zIndex: 10,
                    }}
                  >
                    {colors.map((c, i) => {
                      const thumb = c.images[0]
                        ? cloudinaryUrl(c.images[0], 'f_auto,q_auto,w_120,h_120,c_fill')
                        : null;
                      const isActive = selectedColor === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedColor(i)}
                          title={c.name}
                          style={{
                            padding: 0, border: 'none', borderRadius: 10,
                            overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                            width: 60, height: 60,
                            outline: isActive ? '2.5px solid var(--primary)' : '2px solid rgba(255,255,255,0.5)',
                            outlineOffset: 2,
                            background: 'rgba(26,28,28,0.45)',
                            backdropFilter: 'blur(6px)',
                            transition: 'outline-color 0.15s, opacity 0.15s',
                            opacity: isActive ? 1 : 0.72,
                            position: 'relative',
                          }}
                        >
                          {thumb
                            ? <img src={thumb} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <span style={{ fontSize: 10, color: '#fff', padding: 4, display: 'block', lineHeight: 1.2, textAlign: 'center' }}>{c.name}</span>
                          }
                          {/* Renk adı — altta küçük etiket */}
                          <span style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: isActive ? 'rgba(0,109,47,0.82)' : 'rgba(0,0,0,0.52)',
                            color: '#fff', fontSize: 9, fontWeight: 700,
                            textAlign: 'center', padding: '2px 2px 3px',
                            lineHeight: 1.2,
                            backdropFilter: 'blur(2px)',
                          }}>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Büyüt etiketi */}
                {images && (
                  <div style={{
                    position: 'absolute', bottom: 12, right: 12,
                    background: 'rgba(26,28,28,0.55)', backdropFilter: 'blur(8px)',
                    borderRadius: 8, padding: '5px 10px',
                    fontSize: 12, color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 4,
                    pointerEvents: 'none',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    Büyüt
                  </div>
                )}

                {/* Nokta göstergesi */}
                {images && images.length > 1 && (
                  <div className="gallery-dots">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        className={`gallery-dot ${i === activeImg ? 'gallery-dot--active' : ''}`}
                        onClick={e => { e.stopPropagation(); setActiveImg(i); }}
                        aria-label={`Fotoğraf ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                {/* Swipe hint */}
                {images && images.length > 1 && (
                  <div className="gallery-swipe-hint">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Thumbnail strip — seçili rengin tüm fotoğrafları */}
              {images && images.length > 1 && (
                <div style={{
                  display: 'flex', gap: 8, marginTop: 10,
                  overflowX: 'auto', paddingBottom: 4,
                  scrollbarWidth: 'none',
                }}>
                  {images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      style={{
                        padding: 0, border: 'none', borderRadius: 10,
                        overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                        width: 72, height: 72,
                        outline: i === activeImg ? '2.5px solid var(--primary)' : '2px solid transparent',
                        outlineOffset: 2,
                        transition: 'outline-color 0.15s',
                        background: 'var(--surface)',
                      }}
                    >
                      <img src={src} alt={`${title} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              )}

            </div>

            {/* Sağ: Info panel — sticky (5/12) */}
            <div className="detail-info">

              {/* Kategori etiketi */}
              {category && (
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--secondary)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {category}
                </span>
              )}

              {/* Başlık */}
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 3vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                color: 'var(--text)',
                margin: '10px 0 0',
              }}>{title}</h1>

              {/* Fiyat — mobilede sticky bar'da gösterildiği için gizlenir */}
              <div className="detail-price-row" style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '20px 0 0' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32, fontWeight: 800,
                  color: 'var(--primary)',
                  letterSpacing: '-0.03em',
                }}>
                  {priceLabel}
                </span>
              </div>

              {/* Açıklama */}
              {description && (
                <p style={{
                  fontSize: 16, lineHeight: 1.7,
                  color: 'var(--text-sub)',
                  margin: '20px 0 0',
                  maxWidth: 480,
                  whiteSpace: 'pre-line',
                }}>
                  {description}
                </p>
              )}

              {/* Kargo bilgisi */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                margin: '20px 0 0',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--muted)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13" rx="2"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
                Sipariş sonrası {deliveryDays} iş günü içinde kargoya verilir
              </div>

              {/* WhatsApp CTA — masaüstünde görünür, mobilden sticky bar'a taşındı */}
              <a
                href={whatsappLink(title, slug, selectedColor !== null ? colors[selectedColor]?.name : undefined)}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-wa-desktop"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '16px',
                  borderRadius: 14, marginTop: 28,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-container))',
                  color: '#fff', fontWeight: 700, fontSize: 17,
                  fontFamily: 'var(--font-display)',
                  textDecoration: 'none',
                  boxShadow: '0 10px 40px rgba(0,109,47,0.2)',
                  transition: 'opacity 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp&apos;tan Sipariş Ver
              </a>

              {/* Güvenceler */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                {[
                  { icon: '🎨', label: 'Ücretsiz Tasarım' },
                  { icon: '✅', label: 'Kalite Garantisi' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Paylaş */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <ShareButton title={title} slug={productSlug} />
              </div>
            </div>
          </div>

          {/* Lightbox */}
          {lightbox !== null && images && (
            <div
              onClick={() => setLightbox(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(26,28,28,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <button onClick={() => setLightbox(null)} style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', width: 40, height: 40, borderRadius: '50%',
                fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
              {images.length > 1 && (
                <button onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + images.length) % images.length); }} style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                  width: 44, height: 44, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>‹</button>
              )}
              <img src={images[lightbox]} alt={title} onClick={e => e.stopPropagation()}
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
              {images.length > 1 && (
                <button onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % images.length); }} style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                  width: 44, height: 44, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>›</button>
              )}
              {images.length > 1 && (
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  {lightbox + 1} / {images.length}
                </div>
              )}
            </div>
          )}

          {/* Benzer Ürünler — stitch "Pairs well with" */}
          {similar.length > 0 && (
            <section style={{ marginTop: 96 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(22px, 2.5vw, 32px)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: 'var(--text)',
                    margin: 0,
                  }}>Bunlara da bak</h2>
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
                    Aynı kategorideki diğer modellerle tamamlayın.
                  </p>
                </div>
                <Link href={`/?category=${encodeURIComponent(category)}`} style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--secondary)',
                  textDecoration: 'none',
                }}>
                  Tümünü Gör →
                </Link>
              </div>

              <div className="products-grid">
                {similar.map(p => {
                  const t     = getTitle(p);
                  const pMin  = getPriceMin(p);
                  const pMax  = getPriceMax(p);
                  const imgId = p.images?.[0] ?? null;
                  const thumb = imgId ? (imgId.startsWith('http') ? imgId : cloudinaryThumb(imgId)) : null;
                  return (
                    <Link key={p.id} href={`/urun/${getSlug(p)}`} className="tcard">
                      <div className="tcard-img-wrap">
                        {thumb
                          ? <img src={thumb} alt={t} loading="lazy" className="tcard-img" style={{ opacity: 1 }} />
                          : <div className="tcard-no-img">☕</div>
                        }
                      </div>
                      <div className="tcard-body">
                        <p className="tcard-cat">{getCategory(p)}</p>
                        <h3 className="tcard-title">{t}</h3>
                        <p className="tcard-price">{formatPriceRange(pMin, pMax)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* Mobil Sticky Bottom Bar — Trendyol stili */}
      <div className="detail-sticky-bar">
        <div className="detail-sticky-price">{priceLabel}</div>
        <a
          href={whatsappLink(title, slug, selectedColor !== null ? colors[selectedColor]?.name : undefined)}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-sticky-wa-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp&apos;tan Sipariş Ver
        </a>
      </div>

      <Footer />
    </>
  );
}
