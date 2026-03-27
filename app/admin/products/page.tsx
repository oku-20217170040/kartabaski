'use client';

import { useEffect, useState } from 'react';
import { getProducts, cloudinaryThumb } from '@/lib/products';
import { deleteProductAction, toggleFeaturedAction, toggleStockAction } from '@/lib/actions';
import { Product } from '@/types';
import Link from 'next/link';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);
  const [togglingStock, setTogglingStock] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getProducts().then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = products
    .filter((p) => {
      const q = search.toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.inStock === b.inStock ? 0 : a.inStock ? -1 : 1));

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" silinsin mi?`)) return;
    setDeleting(id);
    await deleteProductAction(id);
    load();
    setDeleting(null);
  };

  const handleToggleFeatured = async (p: Product) => {
    setTogglingFeatured(p.id);
    await toggleFeaturedAction(p.id, !p.featured);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, featured: !p.featured } : x));
    setTogglingFeatured(null);
  };

  const handleToggleStock = async (p: Product) => {
    setTogglingStock(p.id);
    await toggleStockAction(p.id, !p.inStock);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, inStock: !p.inStock } : x));
    setTogglingStock(null);
  };

  const featuredCount = products.filter((p) => p.featured).length;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Ürünler</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {products.length} ürün
            {featuredCount > 0 && (
              <span style={{ marginLeft: 10, color: '#f59e0b' }}>⭐ {featuredCount} öne çıkan</span>
            )}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">+ Yeni Ürün</Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="Ürün veya kategori ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">Ürün bulunamadı</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((p) => {
            const thumb = p.images?.[0] ? cloudinaryThumb(p.images[0]) : null;
            const price = new Intl.NumberFormat('tr-TR').format(p.priceTRY);
            const isDeleting = deleting === p.id;
            const isTogglingFeatured = togglingFeatured === p.id;
            const isTogglingStock = togglingStock === p.id;

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  background: p.featured ? 'rgba(245,158,11,0.06)' : undefined,
                  borderLeft: p.featured ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                {/* Thumbnail */}
                <div style={{ flexShrink: 0 }}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={p.title}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: 8,
                      background: 'var(--surface)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                    }}>
                      🛋️
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.featured && <span title="Öne Çıkan" style={{ fontSize: '0.9rem' }}>⭐</span>}
                    <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.slug}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>₺{price}</span>
                    <span className="badge badge-muted">{p.category}</span>
                    <span className={`badge ${p.condition === 'Sıfır' ? 'badge-green' : 'badge-orange'}`}>
                      {p.condition}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
                  {/* Stock toggle */}
                  <button
                    onClick={() => handleToggleStock(p)}
                    disabled={isTogglingStock}
                    className={`badge ${p.inStock ? 'badge-green' : 'badge-red'}`}
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 12,
                      opacity: isTogglingStock ? 0.5 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {isTogglingStock ? '...' : (p.inStock ? 'Stokta' : 'Satıldı')}
                  </button>

                  {/* Bottom row: featured + edit + delete */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleFeatured(p)}
                      disabled={isTogglingFeatured}
                      title={p.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.2rem', opacity: isTogglingFeatured ? 0.4 : 1,
                        filter: p.featured ? 'none' : 'grayscale(1)',
                        padding: '2px 4px',
                      }}
                    >
                      ⭐
                    </button>
                    <Link href={`/admin/products/${p.id}`} className="btn btn-secondary btn-sm">
                      Düzenle
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(p.id, p.title)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? '...' : 'Sil'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
