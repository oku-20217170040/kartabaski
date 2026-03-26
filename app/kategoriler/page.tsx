'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, cloudinaryThumb } from '@/lib/products';
import { WHATSAPP_BASE } from '@/lib/constants';
import { Product, Category, CATEGORIES } from '@/types';
import { getCategory, getTitle, getPrice, getCondition, getInStock, getSlug, getFirstImageId } from '@/lib/product-utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

const CATEGORY_META: Record<Category, { icon: string; desc: string; color: string }> = {
  'Mobilya':      { icon: '🛋️',  desc: 'Koltuk, kanepe, masa, sandalye ve daha fazlası', color: '#f59e0b' },
  'Beyaz Eşya':   { icon: '🧺',  desc: 'Buzdolabı, çamaşır makinesi, bulaşık makinesi', color: '#2f81f7' },
  'Elektronik':   { icon: '📺',  desc: 'TV, ses sistemi, küçük ev aletleri', color: '#a855f7' },
  'Yatak':        { icon: '🛏️',  desc: 'Yatak, baza, yatak odası takımları', color: '#ec4899' },
  'Ofis':         { icon: '🪑',  desc: 'Ofis masası, sandalye, raf sistemleri', color: '#06b6d4' },
  'Dekorasyon':   { icon: '🪴',  desc: 'Ayna, tablo, dekoratif objeler', color: '#10b981' },
  'Aydınlatma':   { icon: '💡',  desc: 'Avize, abajur, sarkıt ve led aydınlatma', color: '#f97316' },
  'Bahçe':        { icon: '🌿',  desc: 'Bahçe mobilyası, saksı, dış mekan ürünleri', color: '#84cc16' },
  'Diğer':        { icon: '📦',  desc: 'Diğer kategorilerdeki ürünler', color: '#8b9caa' },
};

export default function KategorilerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Category | null>(null);
  const router = useRouter();

  useEffect(() => {
    getProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const cat = getCategory(p) || 'Diğer';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (!selected) return [];
    return products
      .filter((p) => getCategory(p) === selected)
      .slice(0, 6);
  }, [products, selected]);

  const handleCategoryClick = (cat: Category) => {
    if (selected === cat) {
      setSelected(null);
    } else {
      setSelected(cat);
      setTimeout(() => {
        document.getElementById('kategori-urunler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 'calc(var(--nav-h) + 32px)', minHeight: '100vh' }}>
        <div className="container">
          {/* Hero */}
          <div className="page-hero">
            <h1 className="page-hero-title">
              Ürün <span style={{ color: 'var(--accent)' }}>Kategorileri</span>
            </h1>
            <p className="page-hero-sub">
              Aradığınız kategoriyi seçin, ürünleri keşfedin
            </p>
          </div>

          {/* Kategori Grid */}
          <div className="kategori-grid">
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = counts[cat] || 0;
              const isActive = selected === cat;
              return (
                <button
                  key={cat}
                  className={`kategori-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat)}
                  style={{ '--cat-color': meta.color } as React.CSSProperties}
                >
                  <div className="kategori-icon">{meta.icon}</div>
                  <div className="kategori-name">{cat}</div>
                  <div className="kategori-desc">{meta.desc}</div>
                  <div className="kategori-count">
                    {loading ? '...' : count > 0 ? `${count} ürün` : 'Yakında'}
                  </div>
                  {isActive && (
                    <div className="kategori-active-indicator">▼</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Seçili kategori ürünleri */}
          {selected && (
            <div id="kategori-urunler" style={{ marginTop: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
                  {CATEGORY_META[selected].icon} {selected}
                  <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '1rem', marginLeft: 10 }}>
                    ({counts[selected] || 0} ürün)
                  </span>
                </h2>
                <Link
                  href={`/?category=${encodeURIComponent(selected)}`}
                  className="btn btn-secondary btn-sm"
                >
                  Tümünü Gör →
                </Link>
              </div>

              {categoryProducts.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="empty-state-icon">📦</div>
                  <div className="empty-state-title">Bu kategoride henüz ürün yok</div>
                  <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>Yakında eklenecek</div>
                </div>
              ) : (
                <div className="products-grid">
                  {categoryProducts.map((p) => {
                    const title = getTitle(p);
                    const price = getPrice(p);
                    const inStock = getInStock(p);
                    const condition = getCondition(p);
                    const imageId = getFirstImageId(p);
                    const thumb = imageId
                      ? (imageId.startsWith('http') ? imageId : cloudinaryThumb(imageId))
                      : null;

                    return (
                      <Link key={p.id} href={`/urun/${getSlug(p)}`} className="product-card">
                        <div className="product-card-img">
                          {thumb
                            ? <img src={thumb} alt={title} loading="lazy" />
                            : <div className="product-card-no-img">🛋️</div>
                          }
                          <div className="product-card-badges">
                            <span className={`badge ${condition === 'Sıfır' ? 'badge-blue' : 'badge-orange'}`}>{condition}</span>
                            <span className={`badge ${inStock ? 'badge-green' : 'badge-red'}`}>{inStock ? 'Stokta' : 'Satıldı'}</span>
                          </div>
                        </div>
                        <div className="product-card-body">
                          <div className="product-card-title">{title}</div>
                          {price != null && (
                            <div className="product-card-price">
                              ₺{new Intl.NumberFormat('tr-TR').format(price)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Alt CTA */}
          <div style={{ textAlign: 'center', padding: '80px 0 40px' }}>
            <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 15 }}>
              Aradığınızı bulamadınız mı? WhatsApp'tan sorun, stokta olabilir.
            </p>
            <a
              href={`${WHATSAPP_BASE}?text=Merhaba%2C%20arad%C4%B1%C4%9F%C4%B1m%20bir%20%C3%BCr%C3%BCn%20var%2C%20yard%C4%B1mc%C4%B1%20olabilir%20misiniz%3F`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-primary btn-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp ile Sor
            </a>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        .kategori-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 1020px) { .kategori-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 600px)  { .kategori-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }

        .kategori-card {
          position: relative;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px 20px 24px;
          text-align: left;
          cursor: pointer;
          transition: all 0.22s;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow: hidden;
        }
        .kategori-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: var(--cat-color);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .kategori-card:hover, .kategori-card.active {
          border-color: var(--cat-color);
          background: var(--card-hover);
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .kategori-card:hover::before, .kategori-card.active::before { opacity: 1; }
        .kategori-card.active { transform: translateY(-3px); }

        .kategori-icon { font-size: 2.2rem; line-height: 1; }
        .kategori-name {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
        }
        .kategori-desc {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.5;
        }
        .kategori-count {
          font-size: 12px;
          font-weight: 600;
          color: var(--cat-color, var(--accent));
          margin-top: 4px;
        }
        .kategori-active-indicator {
          position: absolute;
          bottom: 8px; right: 12px;
          font-size: 12px;
          color: var(--cat-color, var(--accent));
          opacity: 0.7;
        }

        @media (max-width: 600px) {
          .kategori-card { padding: 18px 14px; }
          .kategori-icon { font-size: 1.8rem; }
          .kategori-name { font-size: 0.95rem; }
          .kategori-desc { display: none; }
        }
      `}</style>
    </>
  );
}
