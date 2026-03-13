'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterState, CATEGORIES } from '@/types';

export type SortOption = 'featured' | 'newest' | 'price_asc' | 'price_desc';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  minPrice: string;
  maxPrice: string;
  onMinPrice: (v: string) => void;
  onMaxPrice: (v: string) => void;
  total: number;
}

const SORT_OPTS: { value: SortOption; label: string }[] = [
  { value: 'featured', label: '⭐ Önerilen' },
  { value: 'newest',   label: '🕐 En Yeni'  },
  { value: 'price_asc', label: '₺↑ Ucuzdan'  },
  { value: 'price_desc', label: '₺↓ Pahalıdan' },
];

const CONDITION_OPTS = [
  { value: '',      label: 'Tümü',   color: '' },
  { value: 'Sıfır', label: 'Sıfır', color: 'var(--accent)' },
  { value: '2. El', label: '2. El', color: '#f59e0b' },
];

const STOCK_OPTS = [
  { value: '',      label: 'Tümü' },
  { value: 'true',  label: '✓ Stokta' },
  { value: 'false', label: '✗ Satıldı' },
];

export default function FilterBar({
  filters, onChange, sort, onSortChange,
  minPrice, maxPrice, onMinPrice, onMaxPrice, total,
}: Props) {
  const [priceOpen, setPriceOpen] = useState(false);
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const activeFilters = [
    filters.search && `"${filters.search}"`,
    filters.category,
    filters.condition,
    filters.inStock !== null && (filters.inStock ? 'Stokta' : 'Satıldı'),
    (minPrice || maxPrice) && `₺${minPrice || 0}–${maxPrice || '∞'}`,
  ].filter(Boolean) as string[];

  const reset = () => {
    onChange({ search: '', category: '', condition: '', inStock: null });
    onSortChange('featured');
    onMinPrice('');
    onMaxPrice('');
    setPriceOpen(false);
  };

  return (
    <div className="fb-wrap">
      {/* ─── Row 1: Search + Sort ─── */}
      <div className="fb-top-row">
        {/* Search */}
        <div className="fb-search-wrap">
          <svg className="fb-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="fb-search"
            placeholder="Ürün adı veya etiket ara..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          {filters.search && (
            <button className="fb-search-clear" onClick={() => set({ search: '' })} title="Temizle">
              ✕
            </button>
          )}
        </div>

        {/* Sort pills */}
        <div className="fb-sort-row">
          {SORT_OPTS.map((o) => (
            <button
              key={o.value}
              className={`fb-sort-pill${sort === o.value ? ' active' : ''}`}
              onClick={() => onSortChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Row 2: Category pills ─── */}
      <div className="fb-category-row">
        <button
          className={`fb-cat-pill${!filters.category ? ' active' : ''}`}
          onClick={() => set({ category: '' })}
        >
          Tümü
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`fb-cat-pill${filters.category === c ? ' active' : ''}`}
            onClick={() => set({ category: filters.category === c ? '' : c })}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ─── Row 3: Condition + Stock + Price ─── */}
      <div className="fb-filter-row">
        {/* Condition */}
        <div className="fb-pill-group">
          <span className="fb-group-label">Kondisyon</span>
          {CONDITION_OPTS.map((o) => (
            <button
              key={o.value}
              className={`fb-mini-pill${filters.condition === o.value ? ' active' : ''}`}
              style={filters.condition === o.value && o.color ? { borderColor: o.color, color: o.color, background: `${o.color}18` } : {}}
              onClick={() => set({ condition: o.value as FilterState['condition'] })}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Stock */}
        <div className="fb-pill-group">
          <span className="fb-group-label">Stok</span>
          {STOCK_OPTS.map((o) => (
            <button
              key={o.value}
              className={`fb-mini-pill${(filters.inStock === null ? '' : String(filters.inStock)) === o.value ? ' active' : ''}`}
              onClick={() => set({ inStock: o.value === '' ? null : o.value === 'true' })}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Price range */}
        <div className="fb-price-wrap">
          <button
            className={`fb-mini-pill${(minPrice || maxPrice) ? ' active' : ''}`}
            onClick={() => setPriceOpen(!priceOpen)}
          >
            💰 Fiyat{(minPrice || maxPrice) ? ` (₺${minPrice || 0}–${maxPrice || '∞'})` : ''}
            <svg style={{ marginLeft: 4, transition: 'transform 0.2s', transform: priceOpen ? 'rotate(180deg)' : 'none' }}
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <AnimatePresence>
            {priceOpen && (
              <motion.div
                className="fb-price-dropdown"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
              >
                <div className="fb-price-row">
                  <input
                    className="fb-price-input"
                    placeholder="Min ₺"
                    value={minPrice}
                    onChange={(e) => onMinPrice(e.target.value.replace(/\D/g, ''))}
                  />
                  <span className="fb-price-sep">–</span>
                  <input
                    className="fb-price-input"
                    placeholder="Max ₺"
                    value={maxPrice}
                    onChange={(e) => onMaxPrice(e.target.value.replace(/\D/g, ''))}
                  />
                  <button className="fb-price-apply" onClick={() => setPriceOpen(false)}>Uygula</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spacer + result count + reset */}
        <div className="fb-right">
          <span className="fb-result-count">
            <span className="fb-result-num">{total}</span> ürün
          </span>
          {activeFilters.length > 0 && (
            <button className="fb-reset" onClick={reset}>
              Temizle ✕
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            className="fb-active-chips"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {activeFilters.map((f) => (
              <span key={f} className="fb-chip">{f}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .fb-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          position: relative;
        }

        /* Top row */
        .fb-top-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        /* Search */
        .fb-search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }
        .fb-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }
        .fb-search {
          width: 100%;
          padding: 10px 36px 10px 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text);
          font-size: 14px;
          font-family: var(--font-body);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .fb-search:focus {
          border-color: rgba(37,211,102,0.4);
          box-shadow: 0 0 0 3px rgba(37,211,102,0.08);
        }
        .fb-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-size: 12px;
          padding: 4px;
          line-height: 1;
        }

        /* Sort pills */
        .fb-sort-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .fb-sort-pill {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: var(--font-body);
        }
        .fb-sort-pill:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
        .fb-sort-pill.active {
          background: rgba(47,129,247,0.12);
          border-color: rgba(47,129,247,0.35);
          color: var(--accent2);
        }

        /* Category pills */
        .fb-category-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .fb-cat-pill {
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: var(--font-body);
        }
        .fb-cat-pill:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
        .fb-cat-pill.active {
          background: rgba(37,211,102,0.12);
          border-color: rgba(37,211,102,0.4);
          color: var(--accent);
          font-weight: 600;
        }

        /* Filter row */
        .fb-filter-row {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        /* Pill group */
        .fb-pill-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .fb-group-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
          margin-right: 2px;
        }
        .fb-mini-pill {
          padding: 5px 12px;
          border-radius: 100px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: var(--font-body);
          display: inline-flex;
          align-items: center;
        }
        .fb-mini-pill:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
        .fb-mini-pill.active {
          background: rgba(37,211,102,0.12);
          border-color: rgba(37,211,102,0.35);
          color: var(--accent);
        }

        /* Price */
        .fb-price-wrap { position: relative; }
        .fb-price-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 50;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.4);
          min-width: 240px;
        }
        .fb-price-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fb-price-input {
          flex: 1;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          color: var(--text);
          font-size: 13px;
          font-family: var(--font-body);
          outline: none;
          width: 70px;
        }
        .fb-price-input:focus { border-color: rgba(37,211,102,0.4); }
        .fb-price-sep { color: var(--muted); font-size: 12px; }
        .fb-price-apply {
          padding: 8px 14px;
          border-radius: 8px;
          background: var(--accent);
          color: #000;
          border: none;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          font-family: var(--font-body);
          white-space: nowrap;
        }

        /* Right side */
        .fb-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fb-result-count {
          font-size: 13px;
          color: var(--muted);
          white-space: nowrap;
        }
        .fb-result-num {
          font-weight: 700;
          color: var(--text);
        }
        .fb-reset {
          font-size: 12px;
          color: rgba(248,81,73,0.8);
          background: rgba(248,81,73,0.08);
          border: 1px solid rgba(248,81,73,0.2);
          border-radius: 100px;
          padding: 4px 12px;
          cursor: pointer;
          font-family: var(--font-body);
          font-weight: 600;
          transition: all 0.15s;
        }
        .fb-reset:hover {
          background: rgba(248,81,73,0.15);
          color: #f85149;
        }

        /* Active chips */
        .fb-active-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          overflow: hidden;
        }
        .fb-chip {
          padding: 3px 10px;
          border-radius: 100px;
          background: rgba(47,129,247,0.1);
          border: 1px solid rgba(47,129,247,0.2);
          color: var(--accent2);
          font-size: 11px;
          font-weight: 600;
        }

        @media (max-width: 760px) {
          .fb-wrap { padding: 14px; gap: 10px; }
          .fb-top-row { flex-direction: column; align-items: stretch; }
          .fb-sort-row { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 2px; }
          .fb-category-row { overflow-x: auto; flex-wrap: nowrap; }
          .fb-filter-row { flex-direction: column; align-items: flex-start; gap: 10px; }
          .fb-pill-group { flex-wrap: wrap; }
          .fb-right { margin-left: 0; width: 100%; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}
