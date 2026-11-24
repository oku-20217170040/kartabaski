'use client';

import { useEffect, useMemo, useState } from 'react';
import { getProducts, cloudinaryThumb } from '@/lib/products';
import { Product, CATEGORIES } from '@/types';
import Link from 'next/link';
import { getActive, getCategory } from '@/lib/product-utils';
import { IconExternal, IconPlus } from '@/components/admin/icons';
import { useToast } from '@/components/admin/Toast';

function formatDate(ts?: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AdminDashboard() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => toast.error('Ürünler yüklenemedi.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = products.length;
  const active = products.filter((p) => getActive(p)).length;
  const featured = products.filter((p) => p.featured).length;

  const stats = [
    { label: 'Toplam ürün', value: total },
    { label: 'Aktif', value: active },
    { label: 'Pasif', value: total - active },
    { label: 'Öne çıkan', value: featured },
  ];

  const recent = useMemo(
    () =>
      products
        .filter((p) => (p.updatedAt || p.createdAt))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 5),
    [products]
  );

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-sub">KAR-TA BASKI Admin Paneli</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary adm-btn-icon-label">
          <IconPlus size={16} /> Yeni Ürün
        </Link>
      </div>

      <div className="adm-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card adm-stat">
            <div className="adm-stat-value">{loading ? '—' : s.value}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card adm-section">
        <h2 className="adm-section-title">Hızlı işlemler</h2>
        <div className="adm-actions-row">
          <Link href="/admin/products/new" className="btn btn-primary">Ürün Ekle</Link>
          <Link href="/admin/products" className="btn btn-secondary">Ürünleri Yönet</Link>
          <Link href="/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary adm-btn-icon-label">
            Siteyi Gör <IconExternal size={14} />
          </Link>
        </div>
      </div>

      {!loading && recent.length > 0 && (
        <div className="card adm-section">
          <h2 className="adm-section-title">Son düzenlenen ürünler</h2>
          <ul className="adm-recent-list">
            {recent.map((p) => (
              <li key={p.id} className="adm-recent-item">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cloudinaryThumb(p.images[0])} alt="" className="adm-recent-thumb" />
                ) : (
                  <div className="adm-recent-thumb" />
                )}
                <div className="adm-recent-main">
                  <Link href={`/admin/products/${p.id}`} className="adm-recent-title">{p.title}</Link>
                  <div className="adm-recent-meta">
                    {formatDate(p.updatedAt || p.createdAt)} · {getActive(p) ? 'Aktif' : 'Pasif'}
                  </div>
                </div>
                <Link href={`/admin/products/${p.id}`} className="btn btn-secondary btn-sm">Düzenle</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="card adm-section">
          <h2 className="adm-section-title">Kategori dağılımı</h2>
          {CATEGORIES.map((cat) => {
            const count = products.filter((p) => getCategory(p) === cat).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={cat} className="adm-cat-row">
                <span className="adm-cat-name">{cat}</span>
                <div className="adm-cat-bar"><div style={{ width: `${pct}%` }} /></div>
                <span className="adm-cat-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
