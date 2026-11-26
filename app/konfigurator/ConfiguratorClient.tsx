'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { CloseIcon, WhatsAppIcon } from '@/components/icons';
import { mugModelFor } from '@/lib/mug3d';
import { useMediaQuery } from '@/lib/use-media-query';
import { SIDES, SIDE_HINTS, SIDE_LABELS, SideId } from '@/lib/design-sides';
import { saveDraft } from '@/lib/design-draft';
import Cup3D from './Cup3D';
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
  const [picked, setPicked] = useState<Record<SideId, string | null>>({ front: null, back: null });
  const [twoSided, setTwoSided] = useState(false);
  const [side, setSide] = useState<SideId>('front');
  const [category, setCategory] = useState(ALL);
  const [qty, setQty] = useState(1);
  const [warning, setWarning] = useState('');
  const [no3d, setNo3d] = useState(false);
  const [viewing, setViewing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const narrow = useMediaQuery('(max-width: 960px)');

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
  const editing: SideId = twoSided ? side : 'front';
  const used: SideId[] = twoSided ? SIDES : ['front'];
  const designId = picked[editing];
  const find = (id: string | null) => designs.find((d) => d.id === id) ?? null;
  const nameOf = (id: string | null) => (id === CUSTOM ? 'Kendi Tasarımım' : find(id)?.name);
  const design = find(picked.front);
  const backDesign = twoSided ? find(picked.back) : null;
  const isCustom = designId === CUSTOM;
  /** Yüzlerden biri bile kendi tasarımıysa sipariş tasarım ekranından geçer. */
  const anyCustom = used.some((id) => picked[id] === CUSTOM);
  const pickDesign = (id: string) => { setWarning(''); setPicked((p) => ({ ...p, [editing]: id })); };
  const chosenColor = cup ? variants(cup).find((c) => c.name === color) : undefined;
  const chosenCupImage = chosenColor?.images[0] ?? cup?.imagePublicId;
  const categories = [ALL, ...Array.from(new Set(designs.map((d) => d.category?.trim()).filter((x): x is string => Boolean(x))))];
  const shown = category === ALL ? designs : designs.filter((d) => d.category?.trim() === category);
  const complete = Boolean(cup && used.every((id) => picked[id]));
  const model = cup && !no3d ? mugModelFor(cup.name) : null;
  const cupLabel = cup ? `${cup.name}${chosenColor ? `, ${chosenColor.name}` : ''}` : '';
  const designLabel = twoSided
    ? SIDES.map((id) => `${SIDE_LABELS[id]}: ${nameOf(picked[id]) ?? 'seçilmedi'}`).join(' · ')
    : nameOf(picked.front);
  const view3d = model && (
    <Cup3D
      model={model}
      color={chosenColor?.name}
      label={cupLabel}
      design={design?.imagePublicId}
      twoSided={twoSided}
      backDesign={backDesign?.imagePublicId}
      view={editing}
      onView={twoSided ? setSide : undefined}
      onUnsupported={() => { setNo3d(true); setViewing(false); }}
    />
  );

  useEffect(() => {
    const el = dialog.current;
    if (viewing && el && !el.open) el.showModal();
  }, [viewing]);
  useEffect(() => { if (narrow === false) setViewing(false); }, [narrow]);

  const pickCup = (id: string) => {
    setWarning('');
    if (id !== cupId) setColor(null);
    setCupId(id);
  };

  /** Kendi tasarımı: tasarım ekranına; hazır tasarım: doğrudan sepete. */
  const order = () => {
    const missing = used.find((id) => !picked[id]);
    if (!cup || missing) {
      if (missing) setSide(missing);
      setWarning(!cup ? 'Önce bir kupa seçin.' : twoSided ? `${SIDE_LABELS[missing!]} için bir desen seçin.` : 'Şimdi bir desen seçin.');
      return;
    }
    const product = cupToProduct(cup);
    const ready = (d: ConfiguratorDesign | null) => (d ? { id: d.id, name: d.name, image: d.imagePublicId } : undefined);
    if (anyCustom) {
      saveDraft({ slug: product.slug ?? product.id, twoSided, front: ready(design), back: ready(backDesign) });
      router.push(`/tasarla/${product.slug}${chosenColor ? `?renk=${encodeURIComponent(chosenColor.name)}` : ''}`);
      return;
    }
    cart.save(productToCartItem(product, {
      qty,
      color: chosenColor?.name,
      design: { photos: [], ready: ready(design), back: twoSided ? { photos: [], ready: ready(backDesign) } : undefined },
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
        <div className={`kf-layout${model ? ' has-3d' : ''}`}>
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
              <div className="kf-print" role="group" aria-label="Baskı">
                <button type="button" className="kf-chip" aria-pressed={!twoSided} onClick={() => { setWarning(''); setTwoSided(false); }}>Tek yüz</button>
                <button type="button" className="kf-chip" aria-pressed={twoSided} onClick={() => { setWarning(''); setTwoSided(true); }}>İki yüze ayrı desen</button>
              </div>
              {twoSided && (
                <div className="kf-sides" role="group" aria-label="Desen seçtiğiniz yüz">
                  {SIDES.map((id) => (
                    <button key={id} type="button" aria-pressed={side === id} onClick={() => setSide(id)}>
                      <b>{SIDE_LABELS[id]}</b>
                      <span>{nameOf(picked[id]) ?? `${SIDE_HINTS[id]} · seçilmedi`}</span>
                    </button>
                  ))}
                </div>
              )}
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
                    <button type="button" className="kf-tile is-custom" aria-pressed={isCustom} onClick={() => pickDesign(CUSTOM)}>
                      <span className="kf-art">Fotoğraf, logo ya da yazınız</span>
                      <span className="kf-name">Kendi Tasarımım</span>
                    </button>
                  </li>
                )}
                {shown.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="kf-tile" aria-pressed={designId === d.id} onClick={() => pickDesign(d.id)}>
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
            {model && narrow === false && (
              <div className="kf-3d">
                {view3d}
                <p>{cupLabel} · {designLabel ?? 'Desen seçin'}</p>
              </div>
            )}
            {model && narrow && (
              <button type="button" className="btn kf-see" onClick={() => setViewing(true)}>Kupayı görün</button>
            )}
            <div className={`kf-pair${twoSided ? ' is-two' : ''}`}>
              <figure>
                <span className="kf-art">
                  {chosenCupImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cupImage(chosenCupImage, 360)} alt="" />
                  ) : 'Kupa'}
                </span>
                <figcaption>{cup ? `${cup.name}${chosenColor ? `, ${chosenColor.name}` : ''}` : 'Kupa seçin'}</figcaption>
              </figure>
              {used.map((id) => {
                const d = find(picked[id]);
                const custom = picked[id] === CUSTOM;
                return (
                  <figure key={id}>
                    <span className="kf-art is-design">
                      {d?.imagePublicId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={designImage(d.imagePublicId)} alt="" />
                      ) : custom ? 'Sizin tasarımınız' : d?.code ?? 'Desen'}
                    </span>
                    <figcaption>{twoSided ? `${SIDE_LABELS[id]}: ` : ''}{nameOf(picked[id]) ?? 'Desen seçin'}</figcaption>
                  </figure>
                );
              })}
            </div>

            <div className="kf-buy">
              <p className="kf-total">{cup ? `${fmt(cup.price * (anyCustom ? 1 : qty))}₺` : ''}</p>
              {!anyCustom && (
                <div className="cart-qty" role="group" aria-label="Adet">
                  <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
                  <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
                  <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
                </div>
              )}
            </div>

            <p className="kf-warning" role="alert">{warning}</p>
            <button type="button" className="btn btn-primary btn-block kf-order" onClick={order} data-complete={complete}>
              <CartIcon size={20} /> {anyCustom ? 'Fotoğrafınızı ekleyin' : 'Sepete ekle'}
            </button>
            <p className="kf-note">Baskıdan önce önizleme gönderiyoruz; onayınızdan sonra 3 iş gününde kargoda.</p>
          </aside>
        </div>
      )}

      {model && narrow && viewing && (
        <dialog ref={dialog} className="kf-dialog" aria-label={cupLabel} onClose={() => setViewing(false)}>
          <div className="kf-dialog-head">
            <p>{cupLabel}<br /><span>{designLabel ?? 'Desen seçilmedi'}</span></p>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Kapat"><CloseIcon /></button>
          </div>
          {view3d}
          <button type="button" className="btn btn-primary btn-block" onClick={() => dialog.current?.close()}>Seçime dönün</button>
        </dialog>
      )}
    </div>
  );
}
