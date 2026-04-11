'use client';

import { useState, useMemo, useEffect } from 'react';
import { Product, FilterState } from '@/types';
import ProductCard from '@/components/ProductCard';
import FilterBar, { SortOption } from '@/components/FilterBar';
import { getTitle, getCategory, getActive, getPriceMin, getFeatured } from '@/lib/product-utils';

const PAGE_SIZE = 12;

interface Props {
  initialProducts: Product[];
}

export default function ProductsClient({ initialProducts }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    search: '', category: '',
  });
  const [sort, setSort] = useState<SortOption>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = initialProducts.filter((p) => {
      if (!getActive(p)) return false;

      const title    = getTitle(p).toLowerCase();
      const category = getCategory(p);
      const price    = getPriceMin(p);

      const q = filters.search.toLowerCase();
      if (q && !title.includes(q)) return false;
      if (filters.category && category !== filters.category) return false;
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
      if (sort === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sort === 'price_asc') return getPriceMin(a) - getPriceMin(b);
      if (sort === 'price_desc') return getPriceMin(b) - getPriceMin(a);
      return 0;
    });

    return list;
  }, [initialProducts, filters, sort, minPrice, maxPrice]);

  useEffect(() => {
    setPage(1);
  }, [filters, sort, minPrice, maxPrice]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        <>
          <div className="products-grid">
            {paginated.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                ‹ Önceki
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${p === page ? 'pagination-btn--active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}

              <button
                className="pagination-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
              >
                Sonraki ›
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
