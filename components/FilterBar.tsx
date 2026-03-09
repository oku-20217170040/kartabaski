'use client';

import { useState } from 'react';
import { FilterState, CATEGORIES } from '@/types';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  total: number;
}

const activeCount = (f: FilterState) =>
  [f.search, f.category, f.condition, f.inStock !== null].filter(Boolean).length;

export default function FilterBar({ filters, onChange, total }: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const reset = () => onChange({ search: '', category: '', condition: '', inStock: null });
  const active = activeCount(filters);

  return (
    <>
      {/* ── DESKTOP: yatay bar ── */}
      <div className="filter-bar filter-bar-desktop">
        <div className="filter-group" style={{ flex: 1, minWidth: 200 }}>
          <label>Ara</label>
          <input
            className="form-input"
            placeholder="Ürün adı veya etiket..."
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
          <label>Kondisyon</label>
          <select className="form-select" value={filters.condition}
            onChange={(e) => set({ condition: e.target.value as FilterState['condition'] })}>
            <option value="">Tümü</option>
            <option value="Sıfır">Sıfır</option>
            <option value="2. El">2. El</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Stok</label>
          <select className="form-select"
            value={filters.inStock === null ? '' : String(filters.inStock)}
            onChange={(e) => set({ inStock: e.target.value === '' ? null : e.target.value === 'true' })}>
            <option value="">Tümü</option>
            <option value="true">Stokta</option>
            <option value="false">Satıldı</option>
          </select>
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
                <label>Kondisyon</label>
                <select className="form-select" value={filters.condition}
                  onChange={(e) => set({ condition: e.target.value as FilterState['condition'] })}>
                  <option value="">Tümü</option>
                  <option value="Sıfır">Sıfır</option>
                  <option value="2. El">2. El</option>
                </select>
              </div>
              <div className="filter-group" style={{ flex: 1 }}>
                <label>Stok</label>
                <select className="form-select"
                  value={filters.inStock === null ? '' : String(filters.inStock)}
                  onChange={(e) => set({ inStock: e.target.value === '' ? null : e.target.value === 'true' })}>
                  <option value="">Tümü</option>
                  <option value="true">Stokta</option>
                  <option value="false">Satıldı</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 4, alignSelf: 'flex-end' }}
              onClick={() => setOpen(false)}>
              Uygula ({total} ürün)
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .filter-bar-desktop { display: flex; }
        .filter-bar-mobile  { display: none; }

        @media (max-width: 760px) {
          .filter-bar-desktop { display: none !important; }
          .filter-bar-mobile  { display: flex; flex-direction: column; gap: 0; margin-bottom: 16px; }
        }

        .filter-mobile-top {
          display: flex; gap: 8px; align-items: center;
        }

        .filter-mobile-toggle {
          display: flex; align-items: center; gap: 6px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 13px; font-weight: 600;
          white-space: nowrap; cursor: pointer;
          transition: border-color 0.15s;
          font-family: var(--font-body);
          flex-shrink: 0;
        }
        .filter-mobile-toggle:hover { border-color: var(--accent2); }

        .filter-mobile-badge {
          background: var(--accent); color: #000;
          border-radius: 10px; font-size: 11px; font-weight: 700;
          padding: 1px 6px; line-height: 1.4;
        }

        .filter-mobile-drawer {
          overflow: hidden; max-height: 0;
          transition: max-height 0.3s ease, opacity 0.2s ease;
          opacity: 0;
        }
        .filter-mobile-drawer.open { max-height: 300px; opacity: 1; }

        .filter-mobile-drawer-inner {
          padding: 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          margin-top: 8px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .filter-mobile-row { display: flex; gap: 8px; }
        .filter-mobile-row .filter-group { margin-bottom: 0; }
        .filter-mobile-row .form-select { font-size: 12px; padding: 8px 8px; }
        .filter-mobile-row label { font-size: 10px; }
      `}</style>
    </>
  );
}
