'use client';

import { useState } from 'react';
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

const activeCount = (f: FilterState, minPrice: string, maxPrice: string) =>
  [f.search, f.category, minPrice, maxPrice].filter(Boolean).length;

export default function FilterBar({ filters, onChange, sort, onSortChange, minPrice, maxPrice, onMinPrice, onMaxPrice, total }: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const reset = () => {
    onChange({ search: '', category: '' });
    onSortChange('featured');
    onMinPrice('');
    onMaxPrice('');
  };
  const active = activeCount(filters, minPrice, maxPrice);

  return (
    <>
      {/* ── DESKTOP: yatay bar ── */}
      <div className="filter-bar filter-bar-desktop">
        <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
          <label>Ara</label>
          <input
            className="form-input"
            placeholder="Ürün adı ara..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Kategori</label>
          <select className="form-select" value={filters.category}
            onChange={(e) => set({ category: e.target.value as FilterState['category'] })}>
            <option value="">Tümü</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Sırala</label>
          <select className="form-select" value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)}>
            <option value="featured">Önerilen</option>
            <option value="newest">En Yeni</option>
            <option value="price_asc">Fiyat ↑</option>
            <option value="price_desc">Fiyat ↓</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Fiyat (₺)</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => onMinPrice(e.target.value.replace(/\D/g, ''))}
              style={{ width: 72, fontSize: 13 }}
            />
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>–</span>
            <input
              className="form-input"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => onMaxPrice(e.target.value.replace(/\D/g, ''))}
              style={{ width: 72, fontSize: 13 }}
            />
          </div>
        </div>
        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
          <label style={{ visibility: 'hidden' }}>_</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{total} ürün</span>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Sıfırla</button>
          </div>
        </div>
      </div>

      {/* ── MOBİL: kompakt bar ── */}
      <div className="filter-bar-mobile">
        {/* Üst satır: arama + filtre toggle */}
        <div className="filter-mobile-top">
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft: 32, fontSize: 13 }}
              placeholder="Ürün ara..."
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>

          <button className="filter-mobile-toggle" onClick={() => setOpen(!open)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="16" y2="12"/>
              <line x1="4" y1="18" x2="12" y2="18"/>
            </svg>
            Filtrele
            {active > 0 && <span className="filter-mobile-badge">{active}</span>}
            <svg style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        {/* Sonuç + temizle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{total} ürün bulundu</span>
          {active > 0 && (
            <button onClick={reset} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Filtreleri temizle ×
            </button>
          )}
        </div>

        {/* Açılır panel */}
        <div className={`filter-mobile-drawer ${open ? 'open' : ''}`}>
          <div className="filter-mobile-drawer-inner">
            <div className="filter-mobile-row">
              <div className="filter-group" style={{ flex: 1 }}>
                <label>Kategori</label>
                <select className="form-select" value={filters.category}
                  onChange={(e) => set({ category: e.target.value as FilterState['category'] })}>
                  <option value="">Tümü</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-group" style={{ flex: 1 }}>
                <label>Sırala</label>
                <select className="form-select" value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)}>
                  <option value="featured">Önerilen</option>
                  <option value="newest">En Yeni</option>
                  <option value="price_asc">Fiyat ↑</option>
                  <option value="price_desc">Fiyat ↓</option>
                </select>
              </div>
            </div>
            <div className="filter-mobile-row">
              <div className="filter-group" style={{ flex: 1 }}>
                <label>Min Fiyat (₺)</label>
                <input
                  className="form-input"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => onMinPrice(e.target.value.replace(/\D/g, ''))}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="filter-group" style={{ flex: 1 }}>
                <label>Max Fiyat (₺)</label>
                <input
                  className="form-input"
                  placeholder="∞"
                  value={maxPrice}
                  onChange={(e) => onMaxPrice(e.target.value.replace(/\D/g, ''))}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 4, alignSelf: 'flex-end' }}
              onClick={() => setOpen(false)}>
              Uygula ({total} ürün)
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
