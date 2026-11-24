'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT, PHONE, PHONE_DISPLAY } from '@/lib/constants';
import { WhatsAppIcon, MenuIcon, CloseIcon, PhoneIcon, ArrowRightIcon } from '@/components/icons';

const NAV_LINKS = [
  { href: '/', label: 'Ürünler' },
  { href: '/kategoriler', label: 'Kategoriler' },
  { href: '/kurumsal', label: 'Kurumsal' },
  { href: '/konfigurator', label: 'Kendin Tasarla' },
  { href: '/nasil-siparis-verilir', label: 'Nasıl Çalışır' },
];

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

function isActive(path: string, href: string) {
  if (href === '/') return path === '/' || path.startsWith('/urun/');
  return path === href || path.startsWith(`${href}/`);
}

export default function Navbar() {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const toggle = toggleRef.current;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('a, button')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab' || !drawer) return;
      const items = drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      toggle?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="announce">
        <div className="wrap">
          <span>Siparişler onaydan sonra 3 iş günü içinde kargoda</span>
          <a className="hide-sm" href={`tel:+${PHONE}`}>{PHONE_DISPLAY}</a>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="KAR-TA BASKI ana sayfa">
            <Image src="/logo.png" alt="" width={40} height={40} priority />
            <span className="brand-name">Kar-Ta<small>Baskı</small></span>
          </Link>

          <nav className="main-nav" aria-label="Ana menü">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link href="/kurumsal" className="btn btn-outline btn-sm hide-md">Teklif isteyin</Link>
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              aria-label="WhatsApp üzerinden yazın"
            >
              <WhatsAppIcon />
              <span className="wa-label">WhatsApp</span>
            </a>
            <button
              ref={toggleRef}
              type="button"
              className="icon-btn menu-toggle"
              aria-label="Menüyü aç"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(true)}
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            id="mobile-menu"
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menü"
          >
            <div className="drawer-head">
              <span className="brand-name">Kar-Ta<small>Baskı</small></span>
              <button type="button" className="icon-btn" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav className="drawer-nav" aria-label="Mobil menü">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? 'page' : undefined}>
                  {l.label}
                  <ArrowRightIcon size={18} />
                </Link>
              ))}
              <Link href="/hakkimizda" aria-current={isActive(path, '/hakkimizda') ? 'page' : undefined}>
                Hakkımızda
                <ArrowRightIcon size={18} />
              </Link>
            </nav>
            <div className="drawer-foot">
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
                <WhatsAppIcon /> WhatsApp&apos;tan yazın
              </a>
              <a className="contact-line" href={`tel:+${PHONE}`}><PhoneIcon size={18} /> {PHONE_DISPLAY}</a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
