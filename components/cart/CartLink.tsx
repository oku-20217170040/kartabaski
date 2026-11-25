'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import './cart.css';

export function CartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.6 12.2a1.5 1.5 0 001.5 1.2h8.4a1.5 1.5 0 001.5-1.1L21 8H6" />
    </svg>
  );
}

/** Navbar sepet ikonu: adet rozetli. */
export default function CartLink() {
  const { count, ready } = useCart();
  const n = ready ? count : 0;
  return (
    <Link
      href="/sepet"
      className="icon-btn cart-nav"
      aria-label={n > 0 ? `Sepet (${n} adet)` : 'Sepet'}
    >
      <CartIcon />
      {n > 0 && <span className="cart-nav-badge">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}
