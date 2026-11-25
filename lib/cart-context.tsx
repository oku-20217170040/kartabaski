'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from '@/types';
import type { CartItem } from './cart-types';
import {
  CART_STORAGE_KEY, addToCart, cartCount, parseStoredCart, removeFromCart, setNote as setNoteFn, setQty as setQtyFn,
} from './cart';
import { productToCartItem, type AddOptions } from './cart-products';

interface CartCtx {
  items: CartItem[];
  /** localStorage okundu mu? Okunmadan sepet "boş" görünmesin diye */
  ready: boolean;
  /** Toplam adet (rozet) */
  count: number;
  has: (productId: string) => boolean;
  add: (p: Product, opts?: AddOptions) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  setNote: (key: string, note: string) => void;
  clear: () => void;
}

const noop = () => {};
const CartContext = createContext<CartCtx>({
  items: [], ready: false, count: 0, has: () => false, add: noop, remove: noop, setQty: noop, setNote: noop, clear: noop,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // İlk yükleme + başka sekmede yapılan değişikliklerle senkron
  useEffect(() => {
    const read = () => {
      try { setItems(parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY))); } catch { /* gizli mod vb. */ }
    };
    read();
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === CART_STORAGE_KEY) read(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next)); } catch { /* depolama kapalı olabilir */ }
      return next;
    });
  }, []);

  const add = useCallback((p: Product, opts?: AddOptions) => update((prev) => addToCart(prev, productToCartItem(p, opts))), [update]);
  const remove = useCallback((key: string) => update((prev) => removeFromCart(prev, key)), [update]);
  const setQty = useCallback((key: string, qty: number) => update((prev) => setQtyFn(prev, key, qty)), [update]);
  const setNote = useCallback((key: string, note: string) => update((prev) => setNoteFn(prev, key, note)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartCtx>(() => ({
    items, ready, count: cartCount(items), has: (id) => items.some((i) => i.productId === id), add, remove, setQty, setNote, clear,
  }), [items, ready, add, remove, setQty, setNote, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
