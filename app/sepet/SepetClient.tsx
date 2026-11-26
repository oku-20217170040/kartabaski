'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon, CloseIcon } from '@/components/icons';
import { useCart } from '@/lib/cart-context';
import { loadFile } from '@/lib/cart-files';
import { cartImageSrc } from '@/lib/cart-products';
import { cartTotal, clampQty, MAX_QTY, reconcileCart } from '@/lib/cart';
import { PHONE_RE } from '@/lib/cart-schemas';
import type { CartItem, CartProductInfo } from '@/lib/cart-types';
import { getCartProductInfoAction } from '@/lib/actions-siparis';
import { submitOrder } from '@/lib/siparis-client';
import { trackEvent } from '@/lib/analytics-client';
import { formatPriceRange } from '@/lib/format';
import { lineHref } from '@/lib/configurator-lines';
import '@/components/cart/cart.css';
import './sepet.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** Satır görseli: cihazdaki kupa önizlemesi ya da ilk fotoğraf; yoksa ürün görseli. */
function Thumb({ item }: { item: CartItem }) {
  const fileId = item.design?.preview ?? item.design?.photos[0];
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) { setUrl(null); return; }
    let alive = true;
    let made: string | null = null;
    loadFile(fileId).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [fileId]);
  const src = url ?? cartImageSrc(item.design?.ready?.image ?? item.image);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" /> : null;
}

function designSummary(item: CartItem): string[] {
  const d = item.design;
  if (!d) return ['Tasarım eklenmedi'];
  const parts = [
    d.ready ? `Hazır tasarım: ${d.ready.name}` : '',
    d.text ? `Yazı: ${d.text}` : '',
    d.photos.length ? `${d.photos.length} fotoğraf` : '',
    d.removeBg ? 'Arka plan silinecek' : '',
    d.needsDesign ? 'Tasarımı biz hazırlayacağız' : '',
  ].filter(Boolean);
  return parts.length ? parts : ['Tasarım eklenmedi'];
}

const EMPTY = { name: '', phone: '', city: '', district: '', address: '', note: '', website: '' /* honeypot */ };

export default function SepetClient() {
  const router = useRouter();
  const { items, ready, remove, setQty, clear } = useCart();
  const [info, setInfo] = useState<CartProductInfo[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [kvkk, setKvkk] = useState(false);
  const [touched, setTouched] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [recheck, setRecheck] = useState(0);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Sepetteki ürünlerin güncel fiyat/aktiflik bilgisi (yalnız ilgili belgeler okunur)
  const idsKey = useMemo(() => Array.from(new Set(items.map((i) => i.productId))).sort().join(','), [items]);
  useEffect(() => {
    if (!ready || !idsKey) { setInfo([]); return; }
    let alive = true;
    getCartProductInfoAction(idsKey.split(',')).then((r) => { if (alive) setInfo(r); }).catch(() => {});
    return () => { alive = false; };
  }, [ready, idsKey, recheck]);

  const { available, unavailable } = useMemo(() => reconcileCart(items, info), [items, info]);
  const total = cartTotal(available);
  const unpriced = available.filter((i) => i.unitPrice <= 0).length;
  const qtyTotal = available.reduce((s, i) => s + i.qty, 0);

  const errs = {
    name: form.name.trim().length < 2 ? 'Ad soyad girin' : '',
    phone: !PHONE_RE.test(form.phone.trim()) ? 'Geçerli bir telefon numarası girin' : '',
    kvkk: !kvkk ? 'Devam etmek için onaylayın' : '',
  };
  const valid = !errs.name && !errs.phone && !errs.kvkk;
  const show = (k: keyof typeof errs) => (touched && errs[k] ? <div className="cart-err">{errs[k]}</div> : null);
  const busy = progress !== null;

  const handleSubmit = async () => {
    setTouched(true);
    setError('');
    if (!valid || available.length === 0 || busy) return;
    setProgress('Sipariş hazırlanıyor…');
    try {
      const token = await submitOrder(
        available,
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim() || undefined,
          district: form.district.trim() || undefined,
          address: form.address.trim() || undefined,
          note: form.note.trim() || undefined,
          kvkk,
          website: form.website,
        },
        (done, count) => setProgress(count ? `Fotoğraflar yükleniyor ${done}/${count}` : 'Sipariş hazırlanıyor…'),
      );
      trackEvent('cart_send', { items: available.length, qty: qtyTotal });
      setLeaving(true);
      clear();
      router.push(`/siparis/${token}?musteri=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sipariş gönderilemedi. Lütfen tekrar deneyin.');
      setProgress(null);
      setRecheck((n) => n + 1);
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

  if (!ready || leaving) return shell(<div className="cart-empty"><p className="muted">{leaving ? 'Sipariş sayfanız açılıyor…' : 'Sepet yükleniyor…'}</p></div>);

  if (items.length === 0) {
    return shell(
      <div className="cart-empty">
        <h2 className="h2">Sepetiniz boş</h2>
        <p className="muted">Bir kupa seçip tasarladığınızda burada görünür.</p>
        <div className="cart-empty-actions">
          <Link href="/#urunler" className="btn btn-primary">Kupa seçin</Link>
          <Link href="/kategoriler" className="btn btn-outline">Kategoriler</Link>
        </div>
      </div>
    );
  }

  const row = (item: CartItem, off: boolean) => (
    <li key={item.key} className={`cart-row${off ? ' is-off' : ''}`}>
      <Link href={lineHref(item.slug)} className="cart-thumb" aria-label={item.title}>
        <Thumb item={item} />
      </Link>
      <div className="cart-row-main">
        <Link href={lineHref(item.slug)} className="cart-row-title">{item.title}</Link>
        <div className="cart-row-meta">
          {item.category}{item.color ? ` · Renk: ${item.color}` : ''}
        </div>
        {off ? (
          <div className="cart-row-off">Bu ürün artık satışta değil</div>
        ) : (
          <>
            <ul className="cart-design">
              {designSummary(item).map((t) => <li key={t}>{t}</li>)}
              {item.note && <li>Not: {item.note}</li>}
            </ul>
            <Link href={`/tasarla/${item.slug}?satir=${encodeURIComponent(item.key)}`} className="cart-edit">Tasarımı düzenle</Link>
            <div className="cart-row-price">
              {item.unitPrice > 0 ? <>{formatPriceRange(item.unitPrice, 0)}<small> &apos;den başlayan / adet</small></> : 'Fiyat için yazın'}
            </div>
            <div className="cart-row-controls">
              <div className="cart-qty" role="group" aria-label={`${item.title} adedi`}>
                <button type="button" onClick={() => setQty(item.key, item.qty - 1)} disabled={item.qty <= 1 || busy} aria-label="Adedi azalt">−</button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Adet"
                  value={item.qty}
                  disabled={busy}
                  onChange={(e) => setQty(item.key, clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))}
                />
                <button type="button" onClick={() => setQty(item.key, item.qty + 1)} disabled={item.qty >= MAX_QTY || busy} aria-label="Adedi artır">+</button>
              </div>
              {item.unitPrice > 0 && <span className="cart-row-line">≈ {fmt(item.unitPrice * item.qty)}₺</span>}
            </div>
          </>
        )}
      </div>
      <button type="button" className="cart-remove" onClick={() => remove(item.key)} disabled={busy} aria-label={`${item.title} sepetten çıkar`}>
        <CloseIcon size={18} />
      </button>
    </li>
  );

  return shell(
    <div className="cart-layout">
      <section aria-label="Sepet ürünleri">
        <ul className="cart-list">
          {available.map((i) => row(i, false))}
          {unavailable.map((i) => row(i, true))}
        </ul>
        <Link href="/#urunler" className="cart-more">Başka kupa ekleyin</Link>
      </section>

      <aside className="cart-side" aria-label="Sipariş özeti">
        <div className="cart-summary">
          <div className="cart-summary-line">
            <span>{available.length} tasarım · {qtyTotal} adet</span>
            <strong>{total > 0 ? `≈ ${fmt(total)}₺` : 'Fiyat için yazın'}</strong>
          </div>
          <p className="cart-hint">
            Fiyatlar &quot;başlayan&quot; birim fiyatlardır{unpriced > 0 ? ` (${unpriced} ürün için fiyat sorulacak)` : ''}.
            Kesin fiyat, tasarım ve adede göre WhatsApp&apos;ta onaylanır. Ödeme bu sitede alınmaz.
          </p>
        </div>

        <form className="cart-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate>
          <h2 className="h3">Size nasıl ulaşalım?</h2>

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

          <details className="cart-more-info">
            <summary>Teslimat adresi ekleyin (isteğe bağlı)</summary>
            <div className="cart-two">
              <div>
                <label className="cart-label" htmlFor="c-city">İl</label>
                <input id="c-city" className="cart-input" autoComplete="address-level1" maxLength={60} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label className="cart-label" htmlFor="c-district">İlçe</label>
                <input id="c-district" className="cart-input" autoComplete="address-level2" maxLength={60} value={form.district} onChange={(e) => set('district', e.target.value)} />
              </div>
            </div>
            <label className="cart-label" htmlFor="c-address">Adres</label>
            <input id="c-address" className="cart-input" autoComplete="street-address" maxLength={300} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </details>

          <label className="cart-label" htmlFor="c-note">Sipariş notu <span>(isteğe bağlı)</span></label>
          <textarea id="c-note" className="cart-input" rows={3} maxLength={500} placeholder="Teslim tarihi, fatura vb." value={form.note} onChange={(e) => set('note', e.target.value)} />

          <label className="cart-consent">
            <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} />
            <span>
              <Link href="/gizlilik" target="_blank">Aydınlatma metnini</Link> okudum; bilgilerimin ve fotoğraflarımın siparişim için işlenmesini onaylıyorum.
            </span>
          </label>
          {show('kvkk')}

          {error && <div className="cart-err cart-err-box" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={available.length === 0 || busy}>
            <WhatsAppIcon /> {progress ?? 'Siparişi oluşturun'}
          </button>
          {available.length === 0 && <p className="cart-hint">Sepetinizdeki ürünlerin hiçbiri artık satışta değil.</p>}
          <p className="cart-hint">Fotoğraflarınız bu düğmeye bastığınızda yüklenir. Sonraki sayfada WhatsApp&apos;a yalnızca sipariş bağlantınız gider.</p>
        </form>
      </aside>
    </div>
  );
}
