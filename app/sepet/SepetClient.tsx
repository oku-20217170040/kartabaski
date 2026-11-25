'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon, CloseIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';
import { useCart } from '@/lib/cart-context';
import { cartImageSrc } from '@/lib/cart-products';
import { buildCartWhatsAppMessage, cartTotal, clampQty, MAX_QTY, NOTE_MAX, reconcileCart } from '@/lib/cart';
import type { CartItem, CartProductInfo } from '@/lib/cart-types';
import { getCartProductInfoAction, submitCartRequestAction } from '@/lib/actions-cart';
import { trackEvent } from '@/lib/analytics-client';
import { formatPriceRange } from '@/lib/format';
import '@/components/cart/cart.css';
import './sepet.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const PHONE_RE = /^\+?[0-9\s()-]{10,18}$/;

interface Done { url: string; id: string }

export default function SepetClient() {
  const { items, ready, remove, setQty, setNote, clear } = useCart();
  const [info, setInfo] = useState<CartProductInfo[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', city: '', district: '', address: '', note: '', website: '' /* honeypot */ });
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Done | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Sepetteki ürünlerin güncel fiyat/aktiflik bilgisi (yalnız ilgili belgeler okunur)
  const idsKey = useMemo(() => Array.from(new Set(items.map((i) => i.productId))).sort().join(','), [items]);
  useEffect(() => {
    if (!ready || !idsKey) { setInfo([]); return; }
    let alive = true;
    getCartProductInfoAction(idsKey.split(',')).then((r) => { if (alive) setInfo(r); }).catch(() => {});
    return () => { alive = false; };
  }, [ready, idsKey]);

  const { available, unavailable } = useMemo(() => reconcileCart(items, info), [items, info]);
  const total = cartTotal(available);
  const unpriced = available.filter((i) => i.unitPrice <= 0).length;
  const qtyTotal = available.reduce((s, i) => s + i.qty, 0);

  const errs = {
    name: form.name.trim().length < 2 ? 'Ad soyad girin' : '',
    phone: !PHONE_RE.test(form.phone.trim()) ? 'Geçerli bir telefon numarası girin' : '',
    city: form.city.trim().length < 2 ? 'İl girin' : '',
    district: form.district.trim().length < 2 ? 'İlçe girin' : '',
  };
  const valid = !errs.name && !errs.phone && !errs.city && !errs.district;
  const show = (k: keyof typeof errs) => (touched && errs[k] ? <div className="cart-err">{errs[k]}</div> : null);

  const handleSubmit = async () => {
    setTouched(true);
    setError('');
    if (!valid || available.length === 0 || submitting) return;
    setSubmitting(true);

    // Mobil tarayıcılar await sonrası açılan popup'ı engeller: pencereyi tıklama anında aç
    const popup = window.open('', '_blank');
    const contact = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      address: form.address.trim() || undefined,
      note: form.note.trim() || undefined,
    };

    try {
      const res = await submitCartRequestAction({
        items: available.map((i) => ({ productId: i.productId, qty: i.qty, color: i.color, note: i.note })),
        ...contact,
        website: form.website,
      });
      trackEvent('cart_send', { items: res.items.length, qty: res.items.reduce((s, i) => s + i.qty, 0) });
      const text = buildCartWhatsAppMessage({ ref: res.id, items: res.items, total: res.total, ...contact });
      const url = `${WHATSAPP_BASE}?text=${encodeURIComponent(text)}`;
      trackEvent('whatsapp', { src: 'sepet' });
      if (popup) popup.location.href = url;
      else window.location.href = url;
      clear();
      setDone({ url, id: res.id });
    } catch (e) {
      popup?.close();
      setError(e instanceof Error && e.message && !e.message.includes('omitted in production')
        ? e.message
        : 'Talep gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <>
      <Navbar />
      <main id="icerik" className="cart-page">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li aria-current="page">Sepet</li>
              </ol>
            </nav>
            <h1 className="display">Sepetim</h1>
          </header>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );

  if (done) {
    return shell(
      <div className="cart-empty">
        <h2 className="h2">Talebiniz alındı</h2>
        <p className="muted">
          Sepetiniz WhatsApp mesajı olarak hazırlandı. Mesajı göndermeniz süreci hızlandırır; fiyatı ve tasarım detaylarını orada netleştireceğiz.
          Kişiselleştirme fotoğrafınızı da aynı sohbetten iletebilirsiniz.
        </p>
        <div className="cart-empty-actions">
          <a href={done.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" onClick={() => trackEvent('whatsapp', { src: 'sepet' })}>
            <WhatsAppIcon /> WhatsApp&apos;ı tekrar aç
          </a>
          <Link href="/" className="btn btn-outline">Alışverişe devam et</Link>
        </div>
      </div>
    );
  }

  if (!ready) return shell(<div className="cart-empty"><p className="muted">Sepet yükleniyor…</p></div>);

  if (items.length === 0) {
    return shell(
      <div className="cart-empty">
        <h2 className="h2">Sepetiniz boş</h2>
        <p className="muted">Beğendiğiniz kupayı ürün sayfasından sepete ekleyebilirsiniz.</p>
        <div className="cart-empty-actions">
          <Link href="/" className="btn btn-primary">Ürünlere göz atın</Link>
          <Link href="/kategoriler" className="btn btn-outline">Kategoriler</Link>
        </div>
      </div>
    );
  }

  const row = (item: CartItem, off: boolean) => {
    const src = cartImageSrc(item.image);
    return (
      <li key={item.key} className={`cart-row${off ? ' is-off' : ''}`}>
        <Link href={`/urun/${item.slug}`} className="cart-thumb" aria-label={item.title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" /> : null}
        </Link>
        <div className="cart-row-main">
          <Link href={`/urun/${item.slug}`} className="cart-row-title">{item.title}</Link>
          <div className="cart-row-meta">
            {item.category}{item.color ? ` · Renk: ${item.color}` : ''}
          </div>
          {off ? (
            <div className="cart-row-off">Bu ürün artık satışta değil</div>
          ) : (
            <>
              <div className="cart-row-price">
                {item.unitPrice > 0 ? <>{formatPriceRange(item.unitPrice, 0)}<small> &apos;den başlayan / adet</small></> : 'Fiyat için yazın'}
              </div>
              <div className="cart-row-controls">
                <div className="cart-qty" role="group" aria-label={`${item.title} adedi`}>
                  <button type="button" onClick={() => setQty(item.key, item.qty - 1)} disabled={item.qty <= 1} aria-label="Adedi azalt">−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Adet"
                    value={item.qty}
                    onChange={(e) => setQty(item.key, clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))}
                  />
                  <button type="button" onClick={() => setQty(item.key, item.qty + 1)} disabled={item.qty >= MAX_QTY} aria-label="Adedi artır">+</button>
                </div>
                {item.unitPrice > 0 && <span className="cart-row-line">≈ {fmt(item.unitPrice * item.qty)}₺</span>}
              </div>
              <label className="cart-label" htmlFor={`note-${item.key}`}>Kişiselleştirme notu <span>(isim / yazı)</span></label>
              <input
                id={`note-${item.key}`}
                className="cart-input"
                maxLength={NOTE_MAX}
                placeholder="Örn. Ayşe & Mehmet 2026"
                value={item.note ?? ''}
                onChange={(e) => setNote(item.key, e.target.value)}
              />
            </>
          )}
        </div>
        <button type="button" className="cart-remove" onClick={() => remove(item.key)} aria-label={`${item.title} sepetten çıkar`}>
          <CloseIcon size={18} />
        </button>
      </li>
    );
  };

  return shell(
    <div className="cart-layout">
      <section aria-label="Sepet ürünleri">
        <ul className="cart-list">
          {available.map((i) => row(i, false))}
          {unavailable.map((i) => row(i, true))}
        </ul>
      </section>

      <aside className="cart-side" aria-label="Talep özeti">
        <div className="cart-summary">
          <div className="cart-summary-line">
            <span>{available.length} ürün · {qtyTotal} adet</span>
            <strong>{total > 0 ? `≈ ${fmt(total)}₺` : 'Fiyat için yazın'}</strong>
          </div>
          <p className="cart-hint">
            Fiyatlar &quot;başlayan&quot; birim fiyatlardır{unpriced > 0 ? ` (${unpriced} ürün için fiyat sorulacak)` : ''}.
            Kesin fiyat, tasarım ve adede göre WhatsApp&apos;ta onaylanır. Ödeme bu sitede alınmaz.
          </p>
        </div>

        <form className="cart-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate>
          <h2 className="h3">İletişim bilgileriniz</h2>

          {/* Honeypot: botlar doldurur, insanlar görmez */}
          <input
            type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
            value={form.website} onChange={(e) => set('website', e.target.value)}
            className="cart-hp"
          />

          <label className="cart-label" htmlFor="c-name">Ad soyad</label>
          <input id="c-name" className="cart-input" autoComplete="name" maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} />
          {show('name')}

          <label className="cart-label" htmlFor="c-phone">Telefon</label>
          <input id="c-phone" className="cart-input" type="tel" autoComplete="tel" placeholder="05xx xxx xx xx" maxLength={18} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          {show('phone')}

          <div className="cart-two">
            <div>
              <label className="cart-label" htmlFor="c-city">İl</label>
              <input id="c-city" className="cart-input" autoComplete="address-level1" maxLength={60} value={form.city} onChange={(e) => set('city', e.target.value)} />
              {show('city')}
            </div>
            <div>
              <label className="cart-label" htmlFor="c-district">İlçe</label>
              <input id="c-district" className="cart-input" autoComplete="address-level2" maxLength={60} value={form.district} onChange={(e) => set('district', e.target.value)} />
              {show('district')}
            </div>
          </div>

          <label className="cart-label" htmlFor="c-address">Adres <span>(opsiyonel)</span></label>
          <input id="c-address" className="cart-input" autoComplete="street-address" maxLength={300} value={form.address} onChange={(e) => set('address', e.target.value)} />

          <label className="cart-label" htmlFor="c-note">Not <span>(opsiyonel)</span></label>
          <textarea id="c-note" className="cart-input" rows={3} maxLength={500} placeholder="Teslim tarihi, tasarım isteği vb." value={form.note} onChange={(e) => set('note', e.target.value)} />

          {error && <div className="cart-err cart-err-box" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={available.length === 0 || submitting}>
            <WhatsAppIcon /> {submitting ? 'Gönderiliyor…' : 'Talebi gönder ve WhatsApp’a geç'}
          </button>
          {available.length === 0 && <p className="cart-hint">Sepetinizdeki ürünlerin hiçbiri artık satışta değil.</p>}
          <p className="cart-hint">Talebiniz kaydedilir ve WhatsApp&apos;ta hazır mesaj açılır. Fotoğrafınızı o sohbetten gönderebilirsiniz.</p>
        </form>
      </aside>
    </div>
  );
}
