'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ConfiguratorCup, ConfiguratorDesign } from '@/types';
import { useCart } from '@/lib/cart-context';
import { productToCartItem } from '@/lib/cart-products';
import { cupToProduct } from '@/lib/configurator-lines';
import { MAX_QTY, clampQty } from '@/lib/cart';
import { cloudinaryUrl } from '@/lib/format';
import { trackEvent } from '@/lib/analytics-client';
import { CartIcon } from '@/components/cart/CartLink';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';
import '@/components/cart/cart.css';
import './konfigurator.css';

const CUSTOM = '__custom__';
const ALL = 'Tümü';
const ASK_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent('Merhaba, özel tasarım bastırmak istiyorum.')}`;

/* Kupa fotoğrafı kırpılmaz: kare alana kenar rengiyle tamamlanır. */
const cupImage = (id: string, width: number) => cloudinaryUrl(id, `f_auto,q_auto,w_${width},ar_1:1,c_pad,b_auto:border`);
const designImage = (id: string) => cloudinaryUrl(id, 'f_auto,q_auto,w_400,c_limit');

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const variants = (cup: ConfiguratorCup) => (cup.colors ?? []).filter((c) => c.images?.[0]);

export default function ConfiguratorClient() {
  const router = useRouter();
  const cart = useCart();
  const [cups, setCups] = useState<ConfiguratorCup[]>([]);
  const [designs, setDesigns] = useState<ConfiguratorDesign[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [cupId, setCupId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);
  const [qty, setQty] = useState(1);
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [c, d] = await Promise.all([
        getDocs(query(collection(db, 'configurator_cups'), orderBy('order'))),
        getDocs(query(collection(db, 'configurator_designs'), orderBy('order'))),
      ]);
      setCups(c.docs.map((x) => ({ ...x.data(), id: x.id }) as ConfiguratorCup).filter((x) => x.active));
      setDesigns(d.docs.map((x) => ({ ...x.data(), id: x.id }) as ConfiguratorDesign).filter((x) => x.active));
      setState('ready');
    } catch {
      setState('failed');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cup = cups.find((c) => c.id === cupId) ?? null;
  const design = designs.find((d) => d.id === designId) ?? null;
  const isCustom = designId === CUSTOM;
  const chosenColor = cup ? variants(cup).find((c) => c.name === color) : undefined;
  const chosenCupImage = chosenColor?.images[0] ?? cup?.imagePublicId;
  const categories = [ALL, ...Array.from(new Set(designs.map((d) => d.category?.trim()).filter((x): x is string => Boolean(x))))];
  const shown = category === ALL ? designs : designs.filter((d) => d.category?.trim() === category);
  const complete = Boolean(cup && (design || isCustom));

  const pickCup = (id: string) => {
    setWarning('');
    if (id !== cupId) setColor(null);
    setCupId(id);
  };

  /** Kendi tasarımı: tasarım ekranına; hazır tasarım: doğrudan sepete. */
  const order = () => {
    if (!cup || (!design && !isCustom)) {
      setWarning(!cup ? 'Önce bir kupa seçin.' : 'Şimdi bir desen seçin.');
      return;
    }
    const product = cupToProduct(cup);
    if (!design) {
      router.push(`/tasarla/${product.slug}${chosenColor ? `?renk=${encodeURIComponent(chosenColor.name)}` : ''}`);
      return;
    }
    cart.save(productToCartItem(product, {
      qty,
      color: chosenColor?.name,
      design: { photos: [], ready: { id: design.id, name: design.name, image: design.imagePublicId } },
    }));
    trackEvent('cart_add', { slug: product.slug ?? product.id, qty });
    router.push('/sepet');
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <nav aria-label="Sayfa yolu">
          <ol className="breadcrumb">
            <li><Link href="/">Ana sayfa</Link></li>
            <li aria-current="page">Kendin tasarla</li>
          </ol>
        </nav>
        <h1 className="display">Kupayı ve deseni seçin.</h1>
        <p className="lead">Hazır desenlerden birini sepete ekleyin ya da kendi fotoğrafınızı koyun.</p>
      </header>

      {state === 'failed' ? (
        <div className="kf-empty" role="alert">
          <p>Kupalar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>
          <button type="button" className="btn btn-primary" onClick={load}>Tekrar deneyin</button>
        </div>
      ) : state === 'loading' ? (
        <div className="kf-grid kf-loading" aria-label="Yükleniyor">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton kf-skeleton" />)}
        </div>
      ) : cups.length === 0 ? (
        <div className="kf-empty">
          <p>Şu an seçilebilir kupa yok. İstediğinizi WhatsApp’tan yazın.</p>
          <a className="btn btn-primary" href={ASK_HREF} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /> WhatsApp’tan yazın</a>
        </div>
      ) : (
        <div className="kf-layout">
          <div className="kf-choices">
            <section aria-labelledby="kf-kupa">
              <h2 id="kf-kupa" className="h3">Kupa</h2>
              <ul className="kf-grid" id="cups-track">
                {cups.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="kf-tile" aria-pressed={cupId === c.id} onClick={() => pickCup(c.id)}>
                      <span className="kf-art">
                        {c.imagePublicId && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cupImage(c.imagePublicId, 360)} alt="" loading="lazy" />
                        )}
                      </span>
                      <span className="kf-name">{c.name}</span>
                      <span className="kf-price">{fmt(c.price)}₺</span>
                    </button>
                  </li>
                ))}
              </ul>

              {cup && variants(cup).length > 0 && (
                <div className="kf-colors">
                  <p id="kf-renk">{cup.name} rengi: <b>{chosenColor?.name ?? 'Standart'}</b></p>
                  <div className="kf-swatches" role="group" aria-labelledby="kf-renk">
                    <button type="button" className="kf-swatch" aria-pressed={!chosenColor} onClick={() => setColor(null)}>
                      {cup.imagePublicId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cupImage(cup.imagePublicId, 144)} alt="" />
                      )}
                      <span>Standart</span>
                    </button>
                    {variants(cup).map((c) => (
                      <button key={c.name} type="button" className="kf-swatch" aria-pressed={chosenColor?.name === c.name} onClick={() => setColor(c.name)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cupImage(c.images[0], 144)} alt="" loading="lazy" />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="kf-desen">
              <h2 id="kf-desen" className="h3">Desen</h2>
              {categories.length > 2 && (
                <div className="mood-tabs kf-tabs" role="group" aria-label="Desen türü">
                  {categories.map((c) => (
                    <button key={c} type="button" className="mood-tab" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
                  ))}
                </div>
              )}
              <ul className="kf-grid" id="designs-track">
                {category === ALL && (
                  <li>
                    <button type="button" className="kf-tile is-custom" aria-pressed={isCustom} onClick={() => { setWarning(''); setDesignId(CUSTOM); }}>
                      <span className="kf-art">Fotoğraf, logo ya da yazınız</span>
                      <span className="kf-name">Kendi Tasarımım</span>
                    </button>
                  </li>
                )}
                {shown.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="kf-tile" aria-pressed={designId === d.id} onClick={() => { setWarning(''); setDesignId(d.id); }}>
                      <span className="kf-art is-design">
                        {d.imagePublicId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={designImage(d.imagePublicId)} alt="" loading="lazy" />
                        ) : d.code}
                      </span>
                      <span className="kf-name">{d.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <p className="kf-ask">
              Aradığınız desen yok mu?{' '}
              <a href={ASK_HREF} target="_blank" rel="noopener noreferrer">WhatsApp’tan yazın</a>
            </p>
          </div>

          <aside className="kf-summary" aria-label="Seçiminiz">
            <div className="kf-pair">
              <figure>
                <span className="kf-art">
                  {chosenCupImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cupImage(chosenCupImage, 360)} alt="" />
                  ) : 'Kupa'}
                </span>
                <figcaption>{cup ? `${cup.name}${chosenColor ? `, ${chosenColor.name}` : ''}` : 'Kupa seçin'}</figcaption>
              </figure>
              <figure>
                <span className="kf-art is-design">
                  {design?.imagePublicId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={designImage(design.imagePublicId)} alt="" />
                  ) : isCustom ? 'Sizin tasarımınız' : design?.code ?? 'Desen'}
                </span>
                <figcaption>{isCustom ? 'Kendi Tasarımım' : design?.name ?? 'Desen seçin'}</figcaption>
              </figure>
            </div>

            <div className="kf-buy">
              <p className="kf-total">{cup ? `${fmt(cup.price * (isCustom ? 1 : qty))}₺` : ''}</p>
              {!isCustom && (
                <div className="cart-qty" role="group" aria-label="Adet">
                  <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
                  <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
                  <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
                </div>
              )}
            </div>

            <p className="kf-warning" role="alert">{warning}</p>
            <button type="button" className="btn btn-primary btn-block kf-order" onClick={order} data-complete={complete}>
              <CartIcon size={20} /> {isCustom ? 'Fotoğrafınızı ekleyin' : 'Sepete ekle'}
            </button>
            <p className="kf-note">Baskıdan önce önizleme gönderiyoruz; onayınızdan sonra 3 iş gününde kargoda.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
