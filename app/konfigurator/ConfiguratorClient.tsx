'use client';

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
import { WhatsAppIcon } from '@/components/icons';
import { mugModelFor } from '@/lib/mug3d';
import { Menu, UstCubuk } from '@/components/tasarim/Studyo';
import { ICart, IMug, IPalette, IPattern, IPencil, IPlus, IUpload, MugGlyph } from '@/components/tasarim/ikonlar';
import { SIDES, SIDE_HINTS, SIDE_LABELS, SideId } from '@/lib/design-sides';
import { saveDraft } from '@/lib/design-draft';
import Cup3D from './Cup3D';
import { WHATSAPP_BASE } from '@/lib/constants';
import '@/components/cart/cart.css';
import '@/components/tasarim/studyo.css';
import './konfigurator.css';

type PanelTab = 'kupa' | 'renk' | 'desen';
const PANEL_TITLES: Record<PanelTab, string> = { kupa: 'Kupanızı seçin', renk: 'Renk', desen: 'Desen' };

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
  const [tab, setTab] = useState<PanelTab>('kupa');

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
      onUnsupported={() => setNo3d(true)}
    />
  );

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

  const ready3 = state === 'ready' && cups.length > 0;
  const cupColors = cup ? variants(cup) : [];
  const price = cup ? `${fmt(cup.price * (anyCustom ? 1 : qty))}₺` : '';
  const subtitle = cup ? `${cupLabel} · ${designLabel ?? 'Desen seçin'}` : 'Kupa ve desen seçin';

  const pickTile = (c: ConfiguratorCup) => (
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
  );

  const panel = tab === 'kupa' ? (
    <ul className="kf-grid" id="cups-track">{cups.map(pickTile)}</ul>
  ) : tab === 'renk' ? (
    cup && cupColors.length ? (
      <div className="kf-swatches" role="group" aria-label={`${cup.name} rengi`}>
        <button type="button" className="kf-swatch" aria-pressed={!chosenColor} onClick={() => setColor(null)}>
          {cup.imagePublicId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cupImage(cup.imagePublicId, 220)} alt="" />
          )}
          <span>Standart</span>
        </button>
        {cupColors.map((c) => (
          <button key={c.name} type="button" className="kf-swatch" aria-pressed={chosenColor?.name === c.name} onClick={() => setColor(c.name)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cupImage(c.images[0], 220)} alt="" loading="lazy" />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    ) : <p className="std-empty">{cup ? 'Bu kupanın başka rengi yok.' : 'Önce bir kupa seçin.'}</p>
  ) : (
    <>
      <div className="std-sticky">
        <div className="std-choice" role="group" aria-label="Baskı">
          <button type="button" aria-pressed={!twoSided} onClick={() => { setWarning(''); setTwoSided(false); }}><MugGlyph face="front" size={34} /> Tek yüz</button>
          <button type="button" aria-pressed={twoSided} onClick={() => { setWarning(''); setTwoSided(true); }}><MugGlyph face="both" size={34} /> İki yüz</button>
        </div>
        {categories.length > 2 && (
          <div className="std-chips" role="group" aria-label="Desen türü">
            {categories.map((c) => (
              <button key={c} type="button" className="std-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <ul className="kf-grid is-designs" id="designs-track">
        {category === ALL && (
          <li>
            <button type="button" className="kf-tile is-custom" aria-pressed={isCustom} onClick={() => pickDesign(CUSTOM)}>
              <span className="kf-art"><IUpload size={36} /></span>
              <span className="kf-name">Kendi tasarımım</span>
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
      <p className="kf-ask">
        Aradığınız desen yok mu?{' '}
        <a href={ASK_HREF} target="_blank" rel="noopener noreferrer">WhatsApp’tan yazın</a>
      </p>
    </>
  );

  return (
    <div className="std kf has-panel">
      <UstCubuk back="/" title="Kendin tasarla" subtitle={subtitle}>
        {price && <p className="kf-total">{price}</p>}
        <button type="button" className="std-buy" onClick={order} data-complete={complete} disabled={!ready3}>
          {anyCustom ? <><IPencil size={20} /> <span>Tasarla</span></> : <><ICart size={20} /> <span>Sepete ekle</span></>}
        </button>
      </UstCubuk>

      <Menu
        label="Seçim adımları" active={tab} onPick={setTab}
        items={[
          { id: 'kupa', label: 'Kupa', icon: <IMug /> },
          { id: 'renk', label: 'Renk', icon: <IPalette /> },
          { id: 'desen', label: 'Desen', icon: <IPattern /> },
        ]}
      />

      <section className="std-panel" aria-label={PANEL_TITLES[tab]}>
        <div className="std-panel-head"><h2>{PANEL_TITLES[tab]}</h2></div>
        <div className="std-panel-body" key={tab}>
          {state === 'loading' ? (
            <div className="kf-grid" aria-label="Yükleniyor">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton kf-skeleton" />)}
            </div>
          ) : ready3 ? panel : null}
        </div>
      </section>

      <div className="std-context is-idle">
        <p className="kf-summary">{subtitle}</p>
      </div>

      <div className="std-work">
        {state === 'failed' ? (
          <div className="kf-empty" role="alert">
            <p>Kupalar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>
            <button type="button" className="btn btn-primary" onClick={load}>Tekrar deneyin</button>
          </div>
        ) : state === 'ready' && cups.length === 0 ? (
          <div className="kf-empty">
            <p>Şu an seçilebilir kupa yok. İstediğinizi WhatsApp’tan yazın.</p>
            <a className="btn btn-primary" href={ASK_HREF} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /> WhatsApp’tan yazın</a>
          </div>
        ) : (
          <>
            {twoSided && (
              <div className="std-sides" role="group" aria-label="Desen seçtiğiniz yüz">
                {SIDES.map((id) => (
                  <button key={id} type="button" aria-pressed={side === id} onClick={() => { setSide(id); setTab('desen'); }} title={SIDE_HINTS[id]}>
                    <MugGlyph face={id} size={30} /> {SIDE_LABELS[id]}
                    <i className={picked[id] ? 'is-full' : undefined} role="img" aria-label={picked[id] ? 'seçildi' : 'seçilmedi'} />
                  </button>
                ))}
              </div>
            )}
            <div className="std-mug">
              {model ? view3d : chosenCupImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="std-product" src={cupImage(chosenCupImage, 800)} alt={cupLabel} />
              ) : <p className="kf-hint"><IMug size={64} />Kupa seçin</p>}
            </div>
            <div className="kf-bar">
              {used.map((id) => {
                const d = find(picked[id]);
                return (
                  <button key={id} type="button" className="kf-chosen" onClick={() => { setSide(id); setTab('desen'); }} aria-label={`${SIDE_LABELS[id]} deseni: ${nameOf(picked[id]) ?? 'seçilmedi'}`}>
                    {d?.imagePublicId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={designImage(d.imagePublicId)} alt="" />
                    ) : picked[id] === CUSTOM ? <IUpload size={24} /> : <IPlus size={24} />}
                  </button>
                );
              })}
              {!anyCustom && (
                <div className="cart-qty" role="group" aria-label="Adet">
                  <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
                  <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
                  <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
                </div>
              )}
            </div>
          </>
        )}
        <div className="std-toasts">
          {warning && <p className="std-toast is-error" role="alert">{warning}&nbsp;</p>}
        </div>
      </div>
    </div>
  );
}
