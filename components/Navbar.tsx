'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const WA_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const NAV_LINKS = [
  { href: '/',           label: 'Ürünler',    exact: true  },
  { href: '/kategoriler', label: 'Kategoriler', exact: true  },
  { href: '/urun-sat',   label: 'Eşya Sat',   exact: true, highlight: true },
  { href: '/#iletisim',  label: 'İletişim',   exact: false },
];

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Sayfa değişince menüyü kapat
  useEffect(() => { setOpen(false); }, [path]);

  // Menü açıkken scroll kilitle
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isActive = (href: string, exact: boolean) =>
    exact ? path === href : path.startsWith(href);

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">
            Ümit<span>Spot</span>
          </Link>

          {/* Desktop links */}
          <ul className="nav-links">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={isActive(l.href, l.exact ?? true) ? 'active' : ''}
                  style={l.highlight ? { color: '#f59e0b' } : {}}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Desktop WhatsApp */}
            <a
              href="https://wa.me/905426447296?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum"
              target="_blank" rel="noopener noreferrer"
              className="btn btn-primary btn-sm nav-wa-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {WA_ICON}
              WhatsApp
            </a>

            {/* Hamburger */}
            <button
              className="hamburger"
              onClick={() => setOpen(!open)}
              aria-label="Menüyü aç/kapat"
            >
              <span className={`ham-line ${open ? 'open' : ''}`} />
              <span className={`ham-line ${open ? 'open' : ''}`} />
              <span className={`ham-line ${open ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobil overlay */}
      <div className={`mobile-menu-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      {/* Mobil menü drawer */}
      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <span className="nav-logo">Ümit<span>Spot</span></span>
          <button className="mobile-menu-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <nav className="mobile-menu-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`mobile-menu-link ${isActive(l.href, l.exact ?? true) ? 'active' : ''}`}
              style={l.highlight ? { color: '#f59e0b' } : {}}
              onClick={() => setOpen(false)}
            >
              {l.label === 'Ürünler'    && '🛋️ '}
              {l.label === 'Kategoriler' && '🗂️ '}
              {l.label === 'Eşya Sat'   && '🏷️ '}
              {l.label === 'İletişim'   && '📍 '}
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mobile-menu-footer">
          <a
            href="https://wa.me/905426447296?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum"
            target="_blank" rel="noopener noreferrer"
            className="btn btn-primary btn-full"
            style={{ gap: 8 }}
            onClick={() => setOpen(false)}
          >
            {WA_ICON}
            WhatsApp ile İletişim
          </a>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
            📞 0542 644 72 96 · Her gün 09:00–00:00
          </p>
        </div>
      </div>

      <style>{`
        /* Active link */
        .nav-links a.active { color: var(--text); background: var(--surface); }

        /* Hamburger — sadece mobilde göster */
        .hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          width: 36px; height: 36px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          padding: 8px;
          flex-shrink: 0;
        }
        .ham-line {
          display: block;
          height: 2px;
          background: var(--text);
          border-radius: 2px;
          transition: all 0.25s;
          transform-origin: center;
        }
        .ham-line:nth-child(1).open { transform: translateY(7px) rotate(45deg); }
        .ham-line:nth-child(2).open { opacity: 0; transform: scaleX(0); }
        .ham-line:nth-child(3).open { transform: translateY(-7px) rotate(-45deg); }

        /* Overlay */
        .mobile-menu-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 299;
          opacity: 0;
          transition: opacity 0.25s;
        }
        .mobile-menu-overlay.open { opacity: 1; }

        /* Drawer */
        .mobile-menu {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: min(300px, 85vw);
          background: var(--surface);
          border-left: 1px solid var(--border);
          z-index: 300;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
        }
        .mobile-menu.open { transform: translateX(0); }

        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
        }
        .mobile-menu-close {
          background: none; border: none;
          color: var(--muted); font-size: 18px;
          cursor: pointer; padding: 4px 8px;
          border-radius: 6px;
          transition: color 0.15s;
        }
        .mobile-menu-close:hover { color: var(--text); }

        .mobile-menu-links {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 12px 0;
          overflow-y: auto;
        }
        .mobile-menu-link {
          display: flex;
          align-items: center;
          padding: 14px 20px;
          font-size: 15px;
          font-weight: 500;
          color: var(--muted);
          transition: all 0.15s;
          border-left: 3px solid transparent;
        }
        .mobile-menu-link:hover { color: var(--text); background: rgba(255,255,255,0.04); }
        .mobile-menu-link.active { color: var(--text); border-left-color: var(--accent); background: var(--accent-dim); }

        .mobile-menu-footer {
          padding: 16px 20px 28px;
          border-top: 1px solid var(--border);
        }

        @media (max-width: 760px) {
          .hamburger { display: flex; }
          .nav-wa-btn { display: none !important; }
          .mobile-menu-overlay { display: block; pointer-events: none; }
          .mobile-menu-overlay.open { pointer-events: auto; }
        }
      `}</style>
    </>
  );
}
