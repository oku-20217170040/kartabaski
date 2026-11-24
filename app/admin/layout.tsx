'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import LogoSVG from '@/components/LogoSVG';
import { ToastProvider } from '@/components/admin/Toast';
import { IconDashboard, IconBox, IconPlus, IconPalette, IconLogout, IconClose } from '@/components/admin/icons';
import './admin.css';

// Firebase istemci SDK'sı yalnızca admin tarafında yüklensin diye AuthProvider burada.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
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
      <div className="adm-fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAdmin && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <ToastProvider>{children}</ToastProvider>;

  const links = [
    { href: '/admin',              label: 'Dashboard',    icon: <IconDashboard /> },
    { href: '/admin/products',     label: 'Ürünler',      icon: <IconBox /> },
    { href: '/admin/products/new', label: 'Yeni Ürün',    icon: <IconPlus /> },
    { href: '/admin/konfigurator', label: 'Konfiguratör', icon: <IconPalette /> },
  ];

  // En uzun eşleşen önek aktif olur (/admin/products/xyz → Ürünler, /admin/products/new → Yeni Ürün)
  const activeHref = links
    .filter((l) => pathname === l.href || (l.href !== '/admin' && pathname.startsWith(l.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const sidebarContent = (
    <>
      <div className="admin-sidebar-logo">
        <LogoSVG height={36} />
        <div className="adm-sidebar-sub">Admin Panel</div>
      </div>

      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`admin-sidebar-link ${activeHref === l.href ? 'active' : ''}`}
          aria-current={activeHref === l.href ? 'page' : undefined}
        >
          {l.icon}
          {l.label}
        </Link>
      ))}

      <div className="adm-sidebar-footer">
        <div className="adm-sidebar-email">{user?.email}</div>
        <button className="btn btn-secondary btn-sm btn-full adm-btn-icon-label" onClick={logout}>
          <IconLogout size={16} /> Çıkış Yap
        </button>
      </div>
    </>
  );

  return (
    <ToastProvider>
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
          <IconClose size={16} />
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
          <LogoSVG height={36} />
          <div className="adm-spacer-40" />
        </div>

        {children}
      </div>
    </div>
    </ToastProvider>
  );
}
