'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAdmin && pathname !== '/admin/login') {
      router.replace('/admin/login');
    }
  }, [loading, isAdmin, pathname, router]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAdmin && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <>{children}</>;

  const links = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/products', label: 'Ürünler', icon: '📦' },
    { href: '/admin/products/new', label: 'Yeni Ürün', icon: '➕' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800 }}>
            Ümit<span style={{ color: 'var(--accent)' }}>Spot</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Admin Panel</div>
        </div>

        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`admin-sidebar-link ${pathname === l.href ? 'active' : ''}`}
          >
            <span>{l.icon}</span>
            {l.label}
          </Link>
        ))}

        <div style={{ marginTop: 'auto', padding: '0 20px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, wordBreak: 'break-all' }}>
            {user?.email}
          </div>
          <button className="btn btn-ghost btn-sm btn-full" onClick={logout}>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="admin-content">{children}</div>
    </div>
  );
}
