'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import LogoSVG from '@/components/LogoSVG';

const WA_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const NAV_LINKS = [
  { href: '/',                      label: 'Ürünler',         icon: '☕', exact: true  },
  { href: '/kategoriler',           label: 'Kategoriler',     icon: '🗂️', exact: true  },
  { href: '/nasil-siparis-verilir', label: 'Nasıl Sipariş?',  icon: '📋', exact: true  },
  { href: '/#iletisim',             label: 'İletişim',        icon: '📞', exact: false },
];

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string, exact: boolean) =>
    exact ? path === href : path.startsWith(href);

  return (
    <>
      <motion.nav
        className="nav"
        animate={{
          backgroundColor: scrolled ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.95)',
          boxShadow: scrolled
            ? '0 2px 12px rgba(0,0,0,0.10)'
            : '0 1px 0 rgba(0,0,0,0.08)',
        }}
        transition={{ duration: 0.25 }}
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      >
        <div className="container nav-inner">

          {/* Logo */}
          <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoSVG height={44} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>
              KAR-TA <span style={{ color: 'var(--accent)' }}>BASKI</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <ul className="nav-links" style={{ display: 'flex', gap: 2, listStyle: 'none' }}>
            {NAV_LINKS.map((l) => {
              const active = isActive(l.href, l.exact ?? true);
              return (
                <li key={l.href} style={{ position: 'relative' }}>
                  <Link
                    href={l.href}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--text)' : 'var(--muted)',
                      background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                      display: 'block',
                      transition: 'color 0.15s, background 0.15s',
                      position: 'relative',
                    }}
                  >
                    {l.label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        style={{
                          position: 'absolute', bottom: -2, left: 10, right: 10,
                          height: 2, borderRadius: 2,
                          background: 'var(--accent)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Desktop WhatsApp */}
            <motion.a
              href={WA_HREF}
              target="_blank" rel="noopener noreferrer"
              className="nav-wa-btn"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: '#25D366',
                color: '#ffffff', fontWeight: 700, fontSize: 13,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                boxShadow: '0 2px 12px rgba(37,211,102,0.3)',
                textDecoration: 'none',
              }}
            >
              {WA_ICON}
              Sipariş Ver
            </motion.a>

            {/* Hamburger */}
            <button
              className="hamburger"
              onClick={() => setOpen(!open)}
              aria-label="Menüyü aç/kapat"
              style={{
                display: 'none',
                flexDirection: 'column', justifyContent: 'center', gap: 5,
                width: 36, height: 36,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', padding: 8,
              }}
            >
              <span className={`ham-line ${open ? 'open' : ''}`} />
              <span className={`ham-line ${open ? 'open' : ''}`} />
              <span className={`ham-line ${open ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 299,
            }}
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(300px, 85vw)',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              zIndex: 300, display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <span className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogoSVG height={40} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                  KAR-TA <span style={{ color: 'var(--accent)' }}>BASKI</span>
                </span>
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                  color: 'var(--muted)', fontSize: 16,
                  cursor: 'pointer', padding: '4px 10px', borderRadius: 6,
                }}
              >✕</motion.button>
            </div>

            {/* Links */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 0', overflowY: 'auto' }}>
              {NAV_LINKS.map((l, i) => {
                const active = isActive(l.href, l.exact ?? true);
                return (
                  <motion.div
                    key={l.href}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                  >
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 20px', fontSize: 15, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--text)' : 'var(--muted)',
                        borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                        background: active ? 'rgba(201,168,76,0.06)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{l.icon}</span>
                      {l.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Footer */}
            <div style={{ padding: '16px 20px 32px', borderTop: '1px solid var(--border)' }}>
              <motion.a
                href={WA_HREF}
                target="_blank" rel="noopener noreferrer"
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '13px 0', borderRadius: 10,
                  background: '#25D366',
                  color: '#ffffff', fontWeight: 700, fontSize: 15,
                  boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                  textDecoration: 'none',
                }}
              >
                {WA_ICON} WhatsApp ile Sipariş Ver
              </motion.a>
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
                0505 087 47 26
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
