'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/lib/products';
import { Product, CATEGORIES } from '@/types';
import Link from 'next/link';
import { getActive, getCategory } from '@/lib/product-utils';

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  const total  = products.length;
  const active = products.filter((p) => getActive(p)).length;
  const categoryCount = new Set(products.map((p) => getCategory(p)).filter(Boolean)).size;

  const stats = [
    { label: 'Toplam Ürün',   value: total,         icon: '📦', color: 'var(--accent2)' },
    { label: 'Aktif Ürün',    value: active,         icon: '✅', color: 'var(--accent)'  },
    { label: 'Kategori',      value: categoryCount,  icon: '🗂️', color: '#fb8c00'        },
    { label: 'Pasif Ürün',    value: total - active, icon: '🔒', color: 'var(--muted)'   },
  ];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>KAR-TA BASKI Admin Paneli</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          + Yeni Ürün Ekle
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '1.6rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: s.color }}>
              {loading ? '—' : s.value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Hızlı İşlemler</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/admin/products/new" className="btn btn-primary">+ Ürün Ekle</Link>
          <Link href="/admin/products" className="btn btn-secondary">Ürünleri Yönet</Link>
          <Link href="/" target="_blank" className="btn btn-ghost">Siteyi Gör ↗</Link>
        </div>
      </div>

      {/* Categories overview */}
      {!loading && products.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Kategori Dağılımı</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CATEGORIES.map((cat) => {
              const count = products.filter((p) => getCategory(p) === cat).length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 200, fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
