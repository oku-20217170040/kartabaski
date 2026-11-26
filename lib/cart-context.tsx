'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem } from './cart-types';
import {
  CART_STORAGE_KEY, cartCount, designFileIds, parseStoredCart, removeFromCart, setQty as setQtyFn, upsertLine,
} from './cart';
import { deleteFiles } from './cart-files';

interface CartCtx {
  items: CartItem[];
  /** localStorage okundu mu? Okunmadan sepet "boş" görünmesin diye */
  ready: boolean;
  /** Toplam adet (rozet) */
  count: number;
  /** Satırı ekler ya da aynı anahtarlı satırın yerine yazar. */
  save: (item: CartItem) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

const noop = () => {};
const CartContext = createContext<CartCtx>({
  items: [], ready: false, count: 0, save: noop, remove: noop, setQty: noop, clear: noop,
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

  /** Sepetten düşen satırların fotoğrafları cihazdan da silinir. */
  const dropFiles = (before: CartItem[], after: CartItem[]) => {
    const keep = new Set(designFileIds(after));
    const gone = designFileIds(before).filter((id) => !keep.has(id));
    if (gone.length) deleteFiles(gone).catch(() => {});
  };

  const save = useCallback((item: CartItem) => update((prev) => {
    const next = upsertLine(prev, item);
    dropFiles(prev, next);
    return next;
  }), [update]);
  const remove = useCallback((key: string) => update((prev) => {
    const next = removeFromCart(prev, key);
    dropFiles(prev, next);
    return next;
  }), [update]);
  const setQty = useCallback((key: string, qty: number) => update((prev) => setQtyFn(prev, key, qty)), [update]);
  const clear = useCallback(() => update((prev) => { dropFiles(prev, []); return []; }), [update]);

  const value = useMemo<CartCtx>(() => ({
    items, ready, count: cartCount(items), save, remove, setQty, clear,
  }), [items, ready, save, remove, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
