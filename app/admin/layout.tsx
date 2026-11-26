'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import LogoSVG from '@/components/LogoSVG';
import { ToastProvider } from '@/components/admin/Toast';
import { countNewCartRequestsAction } from '@/lib/actions-cart';
import { countNewDesignsAction } from '@/lib/actions-designs';
import { setNoTrack } from '@/lib/analytics-client';
import {
  ADMIN_GROUPS, SOCIAL_LINKS, adminPageTitle, filterAdminLinks, inSocial as isSocialPath, isLinkActive,
  type AdminIconKey, type AdminLink,
} from '@/lib/admin-nav';
import {
  IconDashboard, IconBox, IconPalette, IconLogout, IconClose, IconChart, IconWallet, IconCog, IconSparkles,
  IconCart, IconMessage, IconMegaphone, IconPen, IconGlobe, IconInstagram, IconFacebook, IconThreads,
  IconTelegram, IconPinterest, IconTikTok, IconSearch, IconExternal, IconMenu,
} from '@/components/admin/icons';
import './admin.css';

const ICONS: Record<AdminIconKey, (p: { size?: number }) => JSX.Element> = {
  dashboard: IconDashboard, chart: IconChart, wallet: IconWallet, box: IconBox, palette: IconPalette, cog: IconCog,
  sparkles: IconSparkles, cart: IconCart, message: IconMessage, megaphone: IconMegaphone, pen: IconPen, globe: IconGlobe,
  instagram: IconInstagram, facebook: IconFacebook, threads: IconThreads, telegram: IconTelegram,
  pinterest: IconPinterest, tiktok: IconTikTok,
};

const SOCIAL_SUB_LINKS = SOCIAL_LINKS.filter((l) => l.href !== '/admin/sosyal-medya');

// Firebase istemci SDK'sı yalnızca admin tarafında yüklensin diye AuthProvider burada.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [newCartCount, setNewCartCount] = useState(0);
  const [newDesignCount, setNewDesignCount] = useState(0);

  useEffect(() => {
    if (!loading && !isAdmin && pathname !== '/admin/login') router.replace('/admin/login');
  }, [loading, isAdmin, pathname, router]);

  useEffect(() => { setSidebarOpen(false); setNavQuery(''); }, [pathname]);

  // Admin girişi yapılmış cihaz kendi ziyaretlerini istatistiğe katmasın
  useEffect(() => { if (isAdmin) setNoTrack(true); }, [isAdmin]);

  // Yeni sepet talebi ve tasarım siparişi rozeti: dakikada bir; sekme başlığına da yansır
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const tick = () => {
      countNewCartRequestsAction().then((n) => { if (alive) setNewCartCount(n); }).catch(() => {});
      countNewDesignsAction().then((n) => { if (alive) setNewDesignCount(n); }).catch(() => {});
    };
    tick();
    const t = window.setInterval(tick, 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, [isAdmin, pathname]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s/, '');
    const waiting = newCartCount + newDesignCount;
    document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
  }, [newCartCount, newDesignCount, pathname]);

  const filteredLinks = useMemo(() => filterAdminLinks(navQuery), [navQuery]);

  if (loading) {
    return <div className="adm-fullscreen-center"><div className="spinner" /></div>;
  }
  if (!isAdmin && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <ToastProvider>{children}</ToastProvider>;

  const inSocial = isSocialPath(pathname);
  const isActive = (l: AdminLink) => (l.socialGroup ? inSocial : isLinkActive(pathname, l));
  const searching = navQuery.trim().length > 0;

  const renderLink = (l: AdminLink, showDesc = false) => {
    const active = isActive(l);
    const Icon = ICONS[l.icon];
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`admin-sidebar-link ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={l.desc ?? l.label}
      >
        <Icon size={17} />
        <span className="adm-nav-text">
          <span>{l.label}</span>
          {showDesc && l.desc && <span className="adm-nav-desc">{l.desc}</span>}
        </span>
        {l.href === '/admin/tasarimlar' && newDesignCount > 0 && (
          <span className="adm-badge" aria-label={`${newDesignCount} yeni tasarım siparişi`}>{newDesignCount}</span>
        )}
        {l.href === '/admin/sepet-talepleri' && newCartCount > 0 && (
          <span className="adm-badge" aria-label={`${newCartCount} yeni sepet talebi`}>{newCartCount}</span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="admin-sidebar-logo">
        <Link href="/admin" aria-label="Genel Bakış"><LogoSVG height={34} /></Link>
        <div className="adm-sidebar-sub">Yönetim Paneli</div>
      </div>

      <div className="adm-nav-search">
        <IconSearch size={15} />
        <input
          type="search"
          value={navQuery}
          onChange={(e) => setNavQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setNavQuery(''); }}
          placeholder="Menüde ara"
          aria-label="Menüde ara"
          autoComplete="off"
        />
      </div>

      <nav className="adm-nav-scroll" aria-label="Yönetim menüsü">
        {searching ? (
          <div className="adm-nav-group">
            <div className="adm-nav-group-title">Sonuçlar ({filteredLinks.length})</div>
            {filteredLinks.length > 0 ? filteredLinks.map((l) => renderLink(l, true)) : <div className="adm-nav-empty">Eşleşen sayfa yok</div>}
          </div>
        ) : (
          ADMIN_GROUPS.map((g) => (
            <div key={g.id} className="adm-nav-group">
              <div className="adm-nav-group-title">{g.title}</div>
              {g.items.map((l) => (
                <div key={l.href}>
                  {renderLink(l)}
                  {l.socialGroup && inSocial && (
                    <div className="adm-nav-sub" role="group" aria-label="Sosyal medya platformları">
                      {SOCIAL_SUB_LINKS.map((s) => {
                        const Icon = ICONS[s.icon];
                        const on = isLinkActive(pathname, s);
                        return (
                          <Link key={s.href} href={s.href} className={`adm-nav-sublink ${on ? 'active' : ''}`} aria-current={on ? 'page' : undefined}>
                            <Icon size={14} /> {s.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </nav>

      <div className="adm-sidebar-footer">
        <Link href="/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm btn-full adm-btn-icon-label adm-mb-8">
          Siteyi Gör <IconExternal size={14} />
        </Link>
        <div className="adm-sidebar-email">{user?.email}</div>
        <button type="button" className="btn btn-secondary btn-sm btn-full adm-btn-icon-label" onClick={logout}>
          <IconLogout size={16} /> Çıkış Yap
        </button>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <div className="admin-layout">
        <aside className="admin-sidebar">{sidebarContent}</aside>

        {sidebarOpen && <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

        <aside className={`admin-sidebar-mobile ${sidebarOpen ? 'open' : ''}`}>
          <button type="button" className="admin-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Menüyü kapat">
            <IconClose size={16} />
          </button>
          {sidebarContent}
        </aside>

        <div className="admin-content">
          <div className="admin-mobile-topbar">
            <button type="button" className="admin-hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç">
              <IconMenu size={22} />
              {newCartCount > 0 && <span className="adm-badge adm-badge-dot" aria-hidden="true" />}
            </button>
            <div className="adm-mtop-title">{adminPageTitle(pathname)}</div>
            <Link href="/admin" className="adm-mtop-logo" aria-label="Genel Bakış"><LogoSVG height={28} /></Link>
          </div>

          {inSocial && (
            <nav className="adm-socialnav" aria-label="Sosyal medya">
              {SOCIAL_LINKS.map((l) => {
                const Icon = ICONS[l.icon];
                const on = isLinkActive(pathname, l);
                return (
                  <Link key={l.href} href={l.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                    <Icon size={15} /> <span>{l.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
