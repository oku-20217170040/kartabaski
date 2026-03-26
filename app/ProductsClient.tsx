'use client';

import { useState, useMemo } from 'react';
import { Product, FilterState } from '@/types';
import ProductCard from '@/components/ProductCard';
import FilterBar, { SortOption } from '@/components/FilterBar';
import { getTitle, getCategory, getCondition, getInStock, getTags, getPrice, getFeatured } from '@/lib/product-utils';

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
      const title = getTitle(p).toLowerCase();
      const tags = getTags(p);
      const category = getCategory(p);
      const condition = getCondition(p);
      const inStock = getInStock(p);
      const price = getPrice(p);

      const q = filters.search.toLowerCase();
      if (q && !title.includes(q) && !tags.some((t) => t.toLowerCase().includes(q))) return false;
      if (filters.category && category !== filters.category) return false;
      if (filters.condition && condition !== filters.condition) return false;
      if (filters.inStock !== null && inStock !== filters.inStock) return false;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === 'featured') {
        if (getFeatured(a) && !getFeatured(b)) return -1;
        if (!getFeatured(a) && getFeatured(b)) return 1;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      if (sort === 'newest') return ((b as any).createdAt ?? 0) - ((a as any).createdAt ?? 0);
      if (sort === 'price_asc') return getPrice(a) - getPrice(b);
      if (sort === 'price_desc') return getPrice(b) - getPrice(a);
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
