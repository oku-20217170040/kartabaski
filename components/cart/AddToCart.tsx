'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/types';
import { useCart } from '@/lib/cart-context';
import { MAX_QTY, NOTE_MAX, clampQty } from '@/lib/cart';
import { getActive } from '@/lib/product-utils';
import { trackEvent } from '@/lib/analytics-client';
import { CartIcon } from './CartLink';
import './cart.css';

interface Props {
  product: Product;
  /** Ürün sayfasında seçili renk adı (varsa) */
  color?: string;
}

export default function AddToCart({ product, color }: Props) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [qtyText, setQtyText] = useState('1');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [added, setAdded] = useState(false);

  // Renk değişince "eklendi" bilgisi sıfırlanır
  useEffect(() => { setAdded(false); }, [color]);

  if (!getActive(product)) return null;

  const commitQty = (n: number) => {
    const v = clampQty(n);
    setQty(v);
    setQtyText(String(v));
    setAdded(false);
  };

  const onAdd = () => {
    add(product, { qty, color, note });
    trackEvent('cart_add', { slug: product.slug || product.id, qty });
    setAdded(true);
  };

  return (
    <div className="cart-add">
      <div className="cart-add-row">
        <div className="cart-qty" role="group" aria-label="Adet">
          <button type="button" onClick={() => commitQty(qty - 1)} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Adet"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => commitQty(Number(qtyText) || 1)}
          />
          <button type="button" onClick={() => commitQty(qty + 1)} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
        </div>
        <button type="button" className="btn btn-primary cart-add-btn" onClick={onAdd}>
          <CartIcon size={18} /> Sepete ekle
        </button>
      </div>

      {noteOpen ? (
        <div className="cart-note">
          <label htmlFor="cart-add-note" className="cart-label">Kişiselleştirme notu <span>(isim / yazı)</span></label>
          <textarea
            id="cart-add-note"
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => { setNote(e.target.value); setAdded(false); }}
            placeholder="Kupaya yazılacak isim ya da metin"
          />
          <p className="cart-hint">Fotoğrafınızı sepeti gönderdikten sonra WhatsApp’tan iletebilirsiniz.</p>
        </div>
      ) : (
        <button type="button" className="cart-link-btn" onClick={() => setNoteOpen(true)}>
          + Kişiselleştirme notu ekle
        </button>
      )}

      <p className="cart-hint">
        Fiyat birim fiyattır (&quot;başlayan&quot;); kesin fiyat WhatsApp&apos;ta onaylanır.
      </p>

      <p className="cart-added" role="status" aria-live="polite">
        {added && (
          <>
            Sepete eklendi. <Link href="/sepet">Sepeti görüntüle</Link>
          </>
        )}
      </p>
    </div>
  );
}
