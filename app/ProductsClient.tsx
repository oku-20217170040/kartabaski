'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Product, CATEGORIES, Category } from '@/types';
import ProductCard from '@/components/ProductCard';
import CuratedMoods from '@/components/CuratedMoods';
import StudioPromoCard from '@/components/StudioPromoCard';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons';
import { getTitle, getCategory, getActive, getPriceMin, getFeatured } from '@/lib/product-utils';
import { buildMoodsWithCounts, isValidMoodId, matchesMood } from '@/lib/catalog-moods';
import type { MoodId } from '@/lib/catalog-moods-types';

const PAGE_SIZE = 12;

type SortOption = 'featured' | 'newest' | 'price_asc' | 'price_desc';

const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Öne çıkanlar',
  newest: 'Son eklenenler',
  price_asc: 'Fiyat: artan',
  price_desc: 'Fiyat: azalan',
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
  const paramMood = params.get('koleksiyon') ?? '';
  const activeMood: MoodId | null = isValidMoodId(paramMood) ? paramMood : null;

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('featured');
  const [page, setPage] = useState(1);

  const activeProducts = useMemo(() => initialProducts.filter(getActive), [initialProducts]);
  const moods = useMemo(() => buildMoodsWithCounts(initialProducts), [initialProducts]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const list = activeProducts.filter((p) => {
      if (activeMood && !matchesMood(p, activeMood)) return false;
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
  }, [activeProducts, activeMood, category, search, sort]);

  useEffect(() => { setPage(1); }, [activeMood, category, search, sort]);

  const setCategory = (next: Category | '') => {
    const qs = new URLSearchParams(params.toString());
    qs.delete('category');
    qs.delete('koleksiyon');
    if (next) qs.set('kategori', next); else qs.delete('kategori');
    const query = qs.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}#urunler`, { scroll: false });
  };

  const setMood = (next: MoodId | null) => {
    const qs = new URLSearchParams(params.toString());
    qs.delete('category');
    qs.delete('kategori');
    if (next) qs.set('koleksiyon', next); else qs.delete('koleksiyon');
    const query = qs.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}#urunler`, { scroll: false });
  };

  const clearAllFilters = () => {
    setSearch('');
    const qs = new URLSearchParams(params.toString());
    qs.delete('category');
    qs.delete('kategori');
    qs.delete('koleksiyon');
    const query = qs.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}#urunler`, { scroll: false });
  };

  const goToPage = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(activeMood || category || search);
  const showStudioPromo = page === 1 && !hasFilters && visible.length >= 7;

  return (
    <div ref={topRef} style={{ scrollMarginTop: 'calc(var(--header-h) + 16px)' }}>
      <CuratedMoods
        moods={moods}
        activeMood={activeMood}
        totalActiveCount={activeProducts.length}
        onSelectMood={setMood}
      />

      <div className="catalog-toolbar">
        <p className="result-count" aria-live="polite">{filtered.length} ürün</p>
        {category && (
          <button type="button" className="chip" onClick={() => setCategory('')} aria-label={`${category} filtresini kaldır`}>
            {category} <CloseIcon size={14} />
          </button>
        )}
        <div className="toolbar-right">
          <label className="field-search">
            <span className="sr-only">Ürün ara</span>
            <SearchIcon size={16} />
            <input
              className="input"
              type="search"
              placeholder="Ürün arayın"
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

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>Böyle bir ürün bulamadık</h3>
          <p>Başka bir kelime deneyin ya da filtreleri kaldırın. Aklınızda belli bir kupa varsa WhatsApp&apos;tan yazın.</p>
          {hasFilters && (
            <button type="button" className="btn btn-outline btn-sm" onClick={clearAllFilters}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="product-grid">
          {visible.map((p, i) => (
            <Fragment key={p.id}>
              <ProductCard product={p} priority={page === 1 && i < 4} />
              {showStudioPromo && i === 6 && <StudioPromoCard />}
            </Fragment>
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
