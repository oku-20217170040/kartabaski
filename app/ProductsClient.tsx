'use client';

import { useState, useMemo } from 'react';
import { Product, FilterState } from '@/types';
import ProductCard from '@/components/ProductCard';
import FilterBar, { SortOption } from '@/components/FilterBar';

interface Props {
  initialProducts: Product[];
}

export default function ProductsClient({ initialProducts }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    search: '', category: '', condition: '', inStock: null,
  });
  const [sort, setSort] = useState<SortOption>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const filtered = useMemo(() => {
    let list = initialProducts.filter((p) => {
      const raw = p as any;
      const title = (raw.title || raw.baslik || raw.name || '').toLowerCase();
      const tags: string[] = raw.tags || raw.etiketler || [];
      const category = raw.category || raw.kategori || '';
      const condition = raw.condition || raw.durum || '';
      const inStock = raw.inStock ?? raw.stok ?? true;
      const price = raw.priceTRY ?? raw.price ?? raw.fiyat ?? 0;

      const q = filters.search.toLowerCase();
      if (q && !title.includes(q) && !tags.some((t: string) => t.toLowerCase().includes(q))) return false;
      if (filters.category && category !== filters.category) return false;
      if (filters.condition && condition !== filters.condition) return false;
      if (filters.inStock !== null && inStock !== filters.inStock) return false;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const ra = a as any;
      const rb = b as any;
      if (sort === 'featured') {
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
  }, [initialProducts, filters, sort, minPrice, maxPrice]);

  return (
    <>
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

      {filtered.length === 0 ? (
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
    </>
  );
}
