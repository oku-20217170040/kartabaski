'use client';

import { useEffect, useState } from 'react';
import { getProducts, deleteProduct, toggleFeatured, cloudinaryThumb } from '@/lib/products';
import { Product } from '@/types';
import Link from 'next/link';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getProducts(true).then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" silinsin mi?`)) return;
    setDeleting(id);
    await deleteProduct(id);
    load();
    setDeleting(null);
  };

  const handleToggleFeatured = async (p: Product) => {
    setTogglingFeatured(p.id);
    await toggleFeatured(p.id, !p.featured);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, featured: !p.featured } : x));
    setTogglingFeatured(null);
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

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
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
          <table className="admin-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Başlık</th>
                <th>Fiyat</th>
                <th>Kategori</th>
                <th>Durum</th>
                <th>Stok</th>
                <th style={{ textAlign: 'center' }}>Öne Çıkar</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const thumb = p.images?.[0] ? cloudinaryThumb(p.images[0]) : null;
                const price = new Intl.NumberFormat('tr-TR').format(p.priceTRY);
                return (
                  <tr key={p.id} style={p.featured ? { background: 'rgba(245,158,11,0.06)' } : {}}>
                    <td>
                      {thumb ? (
                        <img src={thumb} alt={p.title} className="admin-table-img" />
                      ) : (
                        <div className="admin-table-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', fontSize: '1.2rem' }}>
                          🛋️
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.featured && <span title="Öne Çıkan">⭐</span>}
                        {p.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.slug}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₺{price}</td>
                    <td><span className="badge badge-muted">{p.category}</span></td>
                    <td>
                      <span className={`badge ${p.condition === 'Sıfır' ? 'badge-green' : 'badge-orange'}`}>
                        {p.condition}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.inStock ? 'badge-green' : 'badge-red'}`}>
                        {p.inStock ? 'Stokta' : 'Satıldı'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleFeatured(p)}
                        disabled={togglingFeatured === p.id}
                        title={p.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.4rem',
                          opacity: togglingFeatured === p.id ? 0.4 : 1,
                          transition: 'transform 0.15s',
                          filter: p.featured ? 'none' : 'grayscale(1)',
                        }}
                      >
                        ⭐
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/admin/products/${p.id}`} className="btn btn-secondary btn-sm">
                          Düzenle
                        </Link>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p.id, p.title)}
                          disabled={deleting === p.id}
                        >
                          {deleting === p.id ? '...' : 'Sil'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
