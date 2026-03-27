'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import LogoSVG from '@/components/LogoSVG';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin && pathname !== '/admin/login') {
      router.replace('/admin/login');
    }
  }, [loading, isAdmin, pathname, router]);

  // Sayfa değişince mobil sidebar'ı kapat
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
    { href: '/admin/satis-talepleri', label: 'Satış Talepleri', icon: '🏷️' },
  ];

  const sidebarContent = (
    <>
      <div className="admin-sidebar-logo">
        <LogoSVG height={28} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Admin Panel</div>
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
    </>
  );

  return (
    <div className="admin-layout">
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`admin-sidebar-mobile ${sidebarOpen ? 'open' : ''}`}>
        <button
          className="admin-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Menüyü kapat"
        >
          ✕
        </button>
        {sidebarContent}
      </aside>

      {/* Content */}
      <div className="admin-content">
        {/* Mobile Top Bar */}
        <div className="admin-mobile-topbar">
          <button
            className="admin-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menüyü aç"
          >
            <span /><span /><span />
          </button>
          <LogoSVG height={28} />
          <div style={{ width: 40 }} />
        </div>

        {children}
      </div>
    </div>
  );
}
