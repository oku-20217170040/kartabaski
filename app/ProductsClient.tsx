'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Product, CATEGORIES, Category } from '@/types';
import ProductCard from '@/components/ProductCard';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { getTitle, getCategory, getActive, getPriceMin, getFeatured } from '@/lib/product-utils';

const PAGE_SIZE = 12;

type SortOption = 'featured' | 'newest' | 'price_asc' | 'price_desc';

const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Önerilen',
  newest: 'En yeni',
  price_asc: 'Fiyat: düşükten yükseğe',
  price_desc: 'Fiyat: yüksekten düşüğe',
};

/** Compact page list: 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').trim();

export default function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topRef = useRef<HTMLDivElement>(null);

  const paramCategory = params.get('kategori') ?? params.get('category') ?? '';
  const category: Category | '' = (CATEGORIES as string[]).includes(paramCategory)
    ? (paramCategory as Category)
    : '';

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('featured');
  const [page, setPage] = useState(1);

  const activeProducts = useMemo(() => initialProducts.filter(getActive), [initialProducts]);

  const categories = useMemo(() => {
    const used = new Set(activeProducts.map(getCategory));
    return CATEGORIES.filter((c) => used.has(c));
  }, [activeProducts]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const list = activeProducts.filter((p) => {
      if (category && getCategory(p) !== category) return false;
      if (q && !normalize(`${getTitle(p)} ${getCategory(p)}`).includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case 'price_asc': return getPriceMin(a) - getPriceMin(b);
        case 'price_desc': return getPriceMin(b) - getPriceMin(a);
        case 'newest': return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        default:
          if (getFeatured(a) !== getFeatured(b)) return getFeatured(a) ? -1 : 1;
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
    });
  }, [activeProducts, category, search, sort]);

  useEffect(() => { setPage(1); }, [category, search, sort]);

  const setCategory = (next: Category | '') => {
    const qs = new URLSearchParams(params.toString());
    qs.delete('category');
    if (next) qs.set('kategori', next); else qs.delete('kategori');
    const query = qs.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}#urunler`, { scroll: false });
  };

  const goToPage = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(category || search);

  return (
    <div ref={topRef} style={{ scrollMarginTop: 'calc(var(--header-h) + 16px)' }}>
      <div className="catalog-toolbar">
        <div className="chips" role="group" aria-label="Kategoriye göre filtrele">
          <button type="button" className="chip" aria-pressed={!category} onClick={() => setCategory('')}>
            Tümü
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="field-search">
            <span className="sr-only">Ürün ara</span>
            <SearchIcon size={16} />
            <input
              className="input"
              type="search"
              placeholder="Ürün ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Sırala</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="result-count" aria-live="polite">{filtered.length} ürün</p>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>Bu aramaya uyan ürün yok</h3>
          <p>Farklı bir kelime deneyin ya da tüm ürünlere dönün. Aradığınızı bulamazsanız bize yazın, özel olarak hazırlayalım.</p>
          {hasFilters && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setCategory(''); }}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="product-grid">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={page === 1 && i < 4} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Sayfalar">
          <button type="button" className="page-btn" onClick={() => goToPage(page - 1)} disabled={page === 1} aria-label="Önceki sayfa">
            <ChevronLeftIcon size={18} />
          </button>
          {pageList(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="page-gap" aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className="page-btn"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className="page-btn" onClick={() => goToPage(page + 1)} disabled={page === totalPages} aria-label="Sonraki sayfa">
            <ChevronRightIcon size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}
