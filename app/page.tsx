'use client';

import { useState, useEffect, useMemo } from 'react';
import { getProducts } from '@/lib/products';
import { Product, FilterState } from '@/types';
import ProductCard from '@/components/ProductCard';
import FilterBar, { SortOption } from '@/components/FilterBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '', category: '', condition: '', inStock: null,
  });
  const [sort, setSort] = useState<SortOption>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    getProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const raw = p as any;
      const title = (raw.title || raw.baslik || raw.name || '').toLowerCase();
      const tags: string[] = raw.tags || raw.etiketler || [];
      const category = raw.category || raw.kategori || '';
      const condition = raw.condition || raw.durum || '';
      const inStock = raw.inStock ?? raw.stok ?? true;
      const price = raw.priceTRY ?? raw.price ?? raw.fiyat ?? 0;

      const q = filters.search.toLowerCase();
      if (q && !title.includes(q) && !tags.some((t) => t.toLowerCase().includes(q))) return false;
      if (filters.category && category !== filters.category) return false;
      if (filters.condition && condition !== filters.condition) return false;
      if (filters.inStock !== null && inStock !== filters.inStock) return false;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });

    // Sıralama
    list = [...list].sort((a, b) => {
      const ra = a as any;
      const rb = b as any;
      if (sort === 'featured') {
        // Öne çıkanlar üste, sonra en yeni
        if (ra.featured && !rb.featured) return -1;
        if (!ra.featured && rb.featured) return 1;
        return (rb.createdAt ?? 0) - (ra.createdAt ?? 0);
      }
      if (sort === 'newest') return (rb.createdAt ?? 0) - (ra.createdAt ?? 0);
      const pa = ra.priceTRY ?? ra.price ?? 0;
      const pb = rb.priceTRY ?? rb.price ?? 0;
      if (sort === 'price_asc') return pa - pb;
      if (sort === 'price_desc') return pb - pa;
      return 0;
    });

    return list;
  }, [products, filters, sort, minPrice, maxPrice]);

  return (
    <>
      <Navbar />
      <main className="products-page">
        <div className="container">
          <div className="page-hero">
            <h1 className="page-hero-title">
              İkinci El & Sıfır Spot{' '}
              <span style={{ color: 'var(--accent)' }}>Ürünler</span>
            </h1>
            <p className="page-hero-sub">
              Esenyurt'un en yakın spotçusu — Mobilya, beyaz eşya ve daha fazlası
            </p>
          </div>

          <FilterBar
            filters={filters}
            onChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPrice={setMinPrice}
            onMaxPrice={setMaxPrice}
            total={filtered.length}
          />

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">Ürün bulunamadı</div>
              <div className="empty-state-sub">Farklı filtreler deneyin</div>
            </div>
          ) : (
            <div className="products-grid">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <section id="iletisim" className="contact-section">
            <div className="contact-left">
              <h2>Bir ürün mü buldunuz?</h2>
              <p>Ürünleri satın almak veya fiyat sormak için WhatsApp üzerinden bizimle iletişime geçebilirsiniz.</p>
              <div className="contact-info">
                <span>📍 Mehmet Akif Ersoy Mah. 1824 Sk. 11A, Esenyurt</span>
                <span>🕐 Her gün 09:00 – 00:00</span>
                <span>🚚 Aynı gün teslimat & nakliye</span>
              </div>
            </div>
            <div className="contact-right">
              <a
                href="https://wa.me/905426447296?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum"
                target="_blank" rel="noopener noreferrer"
                className="btn-whatsapp"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp ile İletişim
              </a>
              <p style={{ marginTop: 14, color: 'var(--muted)', fontSize: 14 }}>📞 0542 644 72 96</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
