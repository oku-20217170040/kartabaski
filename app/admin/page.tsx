'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/lib/products';
import { Product } from '@/types';
import Link from 'next/link';

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts().then(setProducts).finally(() => setLoading(false));
  }, []);

  const total = products.length;
  const inStock = products.filter((p) => p.inStock).length;
  const sifir = products.filter((p) => p.condition === 'Sıfır').length;
  const ikinciel = products.filter((p) => p.condition === '2. El').length;

  const stats = [
    { label: 'Toplam Ürün', value: total, icon: '📦', color: 'var(--accent2)' },
    { label: 'Stokta', value: inStock, icon: '✅', color: 'var(--accent)' },
    { label: 'Sıfır', value: sifir, icon: '🆕', color: '#fb8c00' },
    { label: '2. El', value: ikinciel, icon: '♻️', color: 'var(--muted)' },
  ];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Ümit Spot Admin Paneli</p>
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
    </div>
  );
}
