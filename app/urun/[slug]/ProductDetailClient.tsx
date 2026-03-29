'use client';

import { useEffect, useState } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.umitspot.com';

function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/urun/${slug}`;
  const waShareText = `${title} – Ümit Spot'ta bu ürüne bak!\n${url}`;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(waShareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <a
        href={waShareUrl}
        target='_blank' rel='noopener noreferrer'
        className='btn btn-secondary'
        title="WhatsApp'ta Paylaş"
        style={{ padding: '10px 12px' }}
      >
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <circle cx='18' cy='5' r='3'/><circle cx='6' cy='12' r='3'/><circle cx='18' cy='19' r='3'/>
          <line x1='8.59' y1='13.51' x2='15.42' y2='17.49'/>
          <line x1='15.41' y1='6.51' x2='8.59' y2='10.49'/>
        </svg>
      </a>
      <button
        onClick={handleCopy}
        className='btn btn-secondary'
        title='Linki Kopyala'
        style={{ padding: '10px 12px' }}
      >
        {copied
          ? <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='var(--accent)' strokeWidth='2.5'><polyline points='20 6 9 17 4 12'/></svg>
          : <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1'/></svg>
        }
      </button>
    </div>
  );
}
import { getProductBySlug, getProductById, getProducts, cloudinaryUrl, cloudinaryThumb, whatsappLink } from '@/lib/products';
import { Product } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { getTitle, getPrice, getCategory, getCondition, getInStock, getTags, getSlug, getDescription, getSpecs } from '@/lib/product-utils';

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!slug || slug === 'undefined') { setLoading(false); return; }
    getProductBySlug(slug)
      .then(async (p) => p || getProductById(slug))
      .then(async (p) => {
        setProduct(p);
        if (p) {
          const cat = getCategory(p);
          const all = await getProducts();
          const sim = all
            .filter((x) => x.id !== p.id && getCategory(x) === cat && getInStock(x))
            .slice(0, 4);
          setSimilar(sim);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(i => i !== null ? (i + 1) : null);
      if (e.key === 'ArrowLeft') setLightbox(i => i !== null ? (i - 1) : null);
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ paddingTop: 120, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
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

  const title       = getTitle(product);
  const priceNum    = getPrice(product);
  const category    = getCategory(product);
  const condition   = getCondition(product);
  const inStock     = getInStock(product);
  const tags        = getTags(product);
  const description = getDescription(product);
  const specs       = getSpecs(product);
  const productSlug = getSlug(product);

  const rawImages: string[] = product.images || [];
  const images = rawImages.length
    ? rawImages.map((id) => id.startsWith('http') ? id : cloudinaryUrl(id))
    : null;

  const price = priceNum ? new Intl.NumberFormat('tr-TR').format(priceNum) : null;

  return (
    <>
      <Navbar />
      <main className="product-detail">
        <div className="container">
          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 32, fontSize: 13, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Ürünler</Link>
            {category && <><span>›</span><Link href={`/kategoriler`} style={{ color: 'var(--muted)' }}>{category}</Link></>}
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>{title}</span>
          </div>

          {/* Ana ürün grid */}
          <div className="product-detail-grid">
            {/* Galeri */}
            <div>
              <div
                className="product-gallery-main"
                onClick={() => images && setLightbox(activeImg)}
                style={{ cursor: images ? 'zoom-in' : 'default', position: 'relative' }}
                onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  if (touchStartX === null || !images || images.length < 2) return;
                  const diff = touchStartX - e.changedTouches[0].clientX;
                  if (Math.abs(diff) < 40) return;
                  setActiveImg(diff > 0
                    ? (activeImg + 1) % images.length
                    : (activeImg - 1 + images.length) % images.length
                  );
                  setTouchStartX(null);
                }}
              >
                {images ? (
                  <>
                    <img src={images[activeImg]} alt={title} />
                    <div style={{
                      position: 'absolute', bottom: 10, right: 10,
                      background: 'rgba(0,0,0,0.5)', borderRadius: 6,
                      padding: '4px 8px', fontSize: 12, color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                      </svg>
                      Büyüt
                    </div>
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', opacity: 0.15 }}>🛋️</div>
                )}
              </div>


              {/* Mobil: nokta göstergesi */}
              {images && images.length > 1 && (
                <div className="gallery-dots">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      className={`gallery-dot ${i === activeImg ? 'gallery-dot--active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setActiveImg(i); }}
                      aria-label={`Fotoğraf ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Masaüstü: thumbnail strip */}
              {images && images.length > 1 && (
                <div className="product-gallery-thumbs">
                  {images.map((src, i) => (
                    <div key={i} className={`product-gallery-thumb ${i === activeImg ? 'active' : ''}`} onClick={() => setActiveImg(i)}>
                      <img src={src} alt={`${title} ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lightbox */}
            {lightbox !== null && images && (
              <div
                onClick={() => setLightbox(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.92)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 16,
                }}
              >
                {/* Kapat */}
                <button onClick={() => setLightbox(null)} style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', width: 40, height: 40, borderRadius: '50%',
                  fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>✕</button>

                {/* Önceki */}
                {images.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + images.length) % images.length); }}
                    style={{
                      position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                      width: 44, height: 44, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >‹</button>
                )}

                {/* Görsel */}
                <img
                  src={images[lightbox]}
                  alt={title}
                  onClick={e => e.stopPropagation()}
                  style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
                />

                {/* Sonraki */}
                {images.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % images.length); }}
                    style={{
                      position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                      width: 44, height: 44, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >›</button>
                )}

                {/* Sayaç */}
                {images.length > 1 && (
                  <div style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    color: 'rgba(255,255,255,0.6)', fontSize: 13
                  }}>{lightbox + 1} / {images.length}</div>
                )}
              </div>
            )}

            {/* Bilgiler */}
            <div className="product-info">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {condition && <span className={`badge ${condition === 'Sıfır' ? 'badge-green' : 'badge-orange'}`}>{condition}</span>}
                {category && <span className="badge badge-muted">{category}</span>}
                {inStock ? <span className="badge badge-green">✓ Stokta</span> : <span className="badge badge-red">Satıldı</span>}
                {tags?.map((t: string) => <span key={t} className="badge badge-blue">{t}</span>)}
              </div>

              <h1 className="product-title">{title}</h1>
              {price && <div className="product-price">₺{price}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <a href={whatsappLink(title, productSlug)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp" style={{ flex: 1 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp ile Satın Al
                </a>
                <ShareButton title={title} slug={productSlug} />
              </div>

              {description && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10, fontSize: '1.1rem' }}>Açıklama</h3>
                  <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: 14 }}>{description}</p>
                </div>
              )}

              {specs && Object.keys(specs).length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12, fontSize: '1.1rem' }}>Özellikler</h3>
                  <div className="product-specs">
                    {Object.entries(specs).map(([k, v]) => (
                      <div key={k} className="spec-row">
                        <div className="spec-key">{k}</div>
                        <div className="spec-val">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Benzer Ürünler */}
          {similar.length > 0 && (
            <section style={{ marginTop: 72, marginBottom: 60 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: 0 }}>
                  Bunlara da bak
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <Link href={`/?category=${encodeURIComponent(category)}`} className="btn btn-ghost btn-sm">
                  Tümünü gör →
                </Link>
              </div>
              <div className="products-grid">
                {similar.map((p) => {
                  const t     = getTitle(p);
                  const pr    = getPrice(p);
                  const cond  = getCondition(p);
                  const imgId = p.images?.[0] ?? null;
                  const thumb = imgId ? (imgId.startsWith('http') ? imgId : cloudinaryThumb(imgId)) : null;
                  const stok  = getInStock(p);
                  return (
                    <Link key={p.id} href={`/urun/${getSlug(p)}`} className="product-card">
                      <div className="product-card-img">
                        {thumb
                          ? <img src={thumb} alt={t} loading="lazy" />
                          : <div className="product-card-no-img">🛋️</div>
                        }
                        <div className="product-card-badges">
                          <span className={`badge ${cond === 'Sıfır' ? 'badge-blue' : 'badge-orange'}`}>{cond}</span>
                          <span className={`badge ${stok ? 'badge-green' : 'badge-red'}`}>{stok ? 'Stokta' : 'Satıldı'}</span>
                        </div>
                      </div>
                      <div className="product-card-body">
                        <div className="product-card-title">{t}</div>
                        {pr != null && (
                          <div className="product-card-price">₺{new Intl.NumberFormat('tr-TR').format(pr)}</div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
