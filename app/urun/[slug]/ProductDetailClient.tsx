'use client';

import { useEffect, useState } from 'react';
import { getProductBySlug, getProductById, cloudinaryUrl, whatsappLink } from '@/lib/products';
import { Product } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!slug || slug === 'undefined') { setLoading(false); return; }
    getProductBySlug(slug)
      .then(async (p) => p || getProductById(slug))
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [slug]);

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

  const raw = product as any;
  const title: string = raw.title || raw.baslik || raw.isim || raw.name || '—';
  const priceNum: number = raw.priceTRY ?? raw.price ?? raw.fiyat ?? 0;
  const category: string = raw.category || raw.kategori || '';
  const condition: string = raw.condition || raw.durum || raw.kondisyon || '';
  const inStock: boolean = raw.inStock ?? raw.stok ?? true;
  const tags: string[] = raw.tags || raw.etiketler || [];
  const shortDesc: string = raw.shortDesc || raw.kisaAciklama || raw.kisa_aciklama || '';
  const description: string = raw.description || raw.aciklama || raw.açıklama || '';
  const specs: Record<string, string> = raw.specs || raw.ozellikler || {};
  const productSlug: string = raw.slug || product.id || slug;

  const rawImages: string[] = raw.images || raw.gorseller || raw.foto || [];
  const images = rawImages.length
    ? rawImages.map((id: string) => id.startsWith('http') ? id : cloudinaryUrl(id))
    : null;

  const price = priceNum ? new Intl.NumberFormat('tr-TR').format(priceNum) : null;

  return (
    <>
      <Navbar />
      <main className="product-detail">
        <div className="container">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 32, fontSize: 13, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Ürünler</Link>
            {category && <><span>›</span><span style={{ color: 'var(--muted)' }}>{category}</span></>}
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>{title}</span>
          </div>

          <div className="product-detail-grid">
            <div>
              <div className="product-gallery-main">
                {images ? (
                  <img src={images[activeImg]} alt={title} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', opacity: 0.15 }}>🛋️</div>
                )}
              </div>
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

            <div className="product-info">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {condition && <span className={`badge ${condition === 'Sıfır' ? 'badge-green' : 'badge-orange'}`}>{condition}</span>}
                {category && <span className="badge badge-muted">{category}</span>}
                {inStock ? <span className="badge badge-green">✓ Stokta</span> : <span className="badge badge-red">Stok Sor</span>}
              </div>

              <h1 className="product-title">{title}</h1>
              {price && <div className="product-price">₺{price}</div>}
              {shortDesc && <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{shortDesc}</p>}

              <a href={whatsappLink(title, productSlug)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp ile Satın Al
              </a>

              {tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {tags.map((t: string) => <span key={t} className="badge badge-blue">{t}</span>)}
                </div>
              )}

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
        </div>
      </main>
      <Footer />
    </>
  );
}
