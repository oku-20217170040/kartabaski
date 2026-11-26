'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '@/types';
import MugPreview, { MugPreviewHandle } from '@/components/MugPreview';
import PhotoControls from '@/components/PhotoControls';
import PrintStrip from '@/components/mug3d/PrintStrip';
import Mug3D from '@/components/mug3d/Mug3DLazy';
import type { Mug3DHandle } from '@/components/mug3d/Mug3D';
import { SNAPSHOT_BACKGROUND, mugModelFor, mugPalette } from '@/lib/mug3d';
import { DesignSideState, useDesignSide } from '@/lib/use-design-side';
import { SIDES, SIDE_HINTS, SIDE_LABELS, SideId } from '@/lib/design-sides';
import { takeDraft } from '@/lib/design-draft';
import { CartIcon } from '@/components/cart/CartLink';
import { CloseIcon } from '@/components/icons';
import { useCart } from '@/lib/cart-context';
import { saveFile } from '@/lib/cart-files';
import { cartImageSrc, productToCartItem } from '@/lib/cart-products';
import { MAX_QTY, NOTE_MAX, clampQty } from '@/lib/cart';
import { isUsableImage, prepareUpload } from '@/lib/siparis-client';
import { MAX_LINE_PHOTOS, MAX_TEXT } from '@/lib/siparis-types';
import { VITRIN_MUGS, VITRIN_PRODUCT_SLUG } from '@/lib/vitrin';
import { displayTitle, formatPriceRange } from '@/lib/format';
import { getPriceMin, getSlug, getTitle } from '@/lib/product-utils';
import { lineHref } from '@/lib/configurator-lines';
import type { DesignSide } from '@/lib/cart-types';
import { trackEvent } from '@/lib/analytics-client';
import '@/components/cart/cart.css';

interface Props {
  product: Product;
  initialColor?: string;
  /** Sepetteki satır düzenleniyorsa anahtarı. */
  lineKey?: string;
}

const same = (a: string, b: string) => a.toLocaleLowerCase('tr-TR') === b.toLocaleLowerCase('tr-TR');

export default function DesignEditor({ product, initialColor, lineKey }: Props) {
  const router = useRouter();
  const cart = useCart();
  const slug = getSlug(product);
  const title = displayTitle(getTitle(product));
  const colors = (product.colors ?? []).map((c) => c.name);
  // Vitrinden gelen renk katalogda yoksa da seçenek olarak görünür.
  const mugColors = slug === VITRIN_PRODUCT_SLUG ? VITRIN_MUGS.map((m) => m.color) : [];

  const [color, setColor] = useState(initialColor || colors[0] || mugColors[0] || '');
  const [qty, setQty] = useState(1);
  const [twoSided, setTwoSided] = useState(false);
  const [side, setSide] = useState<SideId>('front');
  const [needsDesign, setNeedsDesign] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const preview = useRef<MugPreviewHandle>(null);
  const loaded = useRef(false);

  const options = Array.from(new Set([...colors, ...(color && !colors.some((c) => same(c, color)) ? [color] : [])]));
  const [flat, setFlat] = useState(false);
  const model = flat ? null : mugModelFor(getTitle(product));
  const view3d = useRef<Mug3DHandle>(null);
  // Üç boyut yoksa (eski cihaz) fotoğraflı düz önizlemeye dönülür.
  const mug = !model && slug === VITRIN_PRODUCT_SLUG ? VITRIN_MUGS.find((m) => same(m.color, color)) : undefined;
  const live = Boolean(model || mug);
  const colors3d = useMemo(() => (model ? mugPalette(model, color) : null), [model, color]);
  const sides: Record<SideId, DesignSideState> = { front: useDesignSide(live, Boolean(model)), back: useDesignSide(live, Boolean(model)) };
  const { front, back } = sides;
  const editing: SideId = twoSided ? side : 'front';
  const active = sides[editing];
  const { print, photos, text, font, ready } = active;
  const other = sides[editing === 'front' ? 'back' : 'front'];
  /** Fotoğraf sınırı iki yüzün toplamıdır. */
  const room = MAX_LINE_PHOTOS - (twoSided ? other.photos.length : 0);
  const sideName = twoSided ? SIDE_LABELS[editing] : '';
  const colorImage = product.colors?.find((c) => same(c.name, color))?.images?.[0] ?? product.images?.[0];

  // Sepetten "Düzenle" ile gelindiyse satırı ve cihazdaki fotoğrafları geri yükle.
  useEffect(() => {
    if (!cart.ready || loaded.current || !lineKey) return;
    loaded.current = true;
    const line = cart.items.find((i) => i.key === lineKey);
    if (!line) return;
    const d = line.design;
    setColor(line.color ?? '');
    setQty(line.qty);
    setNote(line.note ?? '');
    setNeedsDesign(Boolean(d?.needsDesign));
    setTwoSided(Boolean(d?.back));
    if (d) front.restore(d);
    if (d?.back) back.restore(d.back);
    // restore yalnız durum ayarlar; satır bir kez yüklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, cart.items, lineKey]);

  // Konfigüratörden gelindiyse yüz sayısını ve seçilen hazır desenleri al.
  useEffect(() => {
    if (lineKey) return;
    const draft = takeDraft(slug);
    if (!draft) return;
    setTwoSided(draft.twoSided);
    front.setReady(draft.front);
    back.setReady(draft.back);
    if (draft.twoSided && draft.front && !draft.back) setSide('back');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, lineKey]);

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError('');
    const usable = await Promise.all(picked.map((f) => isUsableImage(f, true).catch(() => false)));
    const files = picked.filter((_, i) => usable[i]);
    const rejected = picked.filter((_, i) => !usable[i]).map((f) => f.name);
    if (rejected.length) setError(`Açılamayan dosya eklenmedi: ${rejected.join(', ')}. JPG veya PNG deneyin.`);
    active.addFiles(files, room);
  };

  /** Bir yüzün fotoğraflarını cihaza kaydedip sepet biçimine çevirir. */
  const saveSide = async (s: DesignSideState): Promise<DesignSide> => {
    const ids: string[] = [];
    for (const p of s.photos) ids.push(p.fileId ?? await saveFile(await prepareUpload(p.blob)));
    const written = s.text.trim();
    return {
      photos: ids,
      ready: s.ready,
      text: written || undefined,
      font: written ? s.font : undefined,
      placement: live && ids.length ? s.print.placement : undefined,
      removeBg: live && ids.length && s.print.removeBg ? true : undefined,
    };
  };

  const submit = async () => {
    setError('');
    const blank = twoSided ? SIDES.find((id) => sides[id].empty) : undefined;
    if (blank && !needsDesign) {
      setSide(blank);
      setError(`${SIDE_LABELS[blank]} boş. Bir yazı ya da fotoğraf ekleyin, ya da “Tek yüz” seçin.`);
      return;
    }
    if (!twoSided && front.empty && !needsDesign && !note.trim()) {
      setError('Bir yazı ya da fotoğraf ekleyin, ya da “Tasarımım yok” seçin.');
      return;
    }
    if (twoSided && front.photos.length + back.photos.length > MAX_LINE_PHOTOS) {
      setError(`İki yüz için toplam en fazla ${MAX_LINE_PHOTOS} fotoğraf ekleyebilirsiniz.`);
      return;
    }
    setSaving(true);
    try {
      const frontSide = await saveSide(front);
      const backSide = twoSided ? await saveSide(back) : undefined;
      const wanted = twoSided ? !front.empty || !back.empty : Boolean(front.text.trim() || front.photos.length);
      // Düz önizleme tek yüzü gösterdiği için iki yüzlü satırda küçük resim yalnız üç boyutta alınır.
      const shot = !wanted ? null : model
        ? await view3d.current?.snapshot(SNAPSHOT_BACKGROUND, twoSided)
        : mug && !twoSided ? await preview.current?.snapshot(mug.field) : null;
      const previewId = shot ? await saveFile(shot) : undefined;
      cart.save(productToCartItem(product, {
        key: lineKey,
        qty,
        color: color || undefined,
        note,
        design: {
          ...frontSide,
          back: backSide,
          preview: previewId,
          needsDesign: needsDesign || undefined,
        },
      }));
      trackEvent('cart_add', { slug, qty });
      router.push('/sepet');
    } catch {
      setError('Sepete eklenemedi. Tarayıcınız gizli moddaysa fotoğraf saklanamayabilir.');
      setSaving(false);
    }
  };

  return (
    <div className="wrap tsr">
      <header className="tsr-head">
        <nav aria-label="Konum">
          <ol className="breadcrumb">
            <li><Link href={lineHref(slug)}>{title}</Link></li>
            <li aria-current="page">Tasarım</li>
          </ol>
        </nav>
        <h1 className="h2">Kupanızı tasarlayın</h1>
        <p>{title} · {formatPriceRange(getPriceMin(product), 0)}’den başlayan</p>
      </header>

      <div className="tsr-grid">
        <div
          className={`tsr-stage${mug ? ' is-live' : ''}${model ? ' is-3d' : ''}`}
          style={mug ? { ['--field' as string]: mug.field, ['--on-field' as string]: mug.onField } : undefined}
        >
          {live ? (
            <>
              {model && colors3d ? (
                <>
                  <Mug3D
                    handle={view3d}
                    model={model}
                    colors={colors3d}
                    label={`${title}${color ? `, ${color}` : ''}`}
                    {...front.content}
                    back={twoSided ? back.content : undefined}
                    view={editing}
                    onView={twoSided ? setSide : undefined}
                    onUnsupported={() => setFlat(true)}
                  />
                  {(photos.length > 0 || text.trim()) && (
                    <PrintStrip
                      key={editing}
                      model={model}
                      background={colors3d.body}
                      {...active.content}
                      onPlacementChange={active.fixed ? undefined : print.setPlacement}
                      side={sideName}
                    />
                  )}
                </>
              ) : mug && (
                <MugPreview
                  ref={preview}
                  mug={mug}
                  text={text}
                  font={font}
                  photo={print.image}
                  placement={print.placement}
                  onPlacementChange={print.setPlacement}
                  mirrored={editing === 'back'}
                />
              )}
              {photos.length > 0 && (
                <PhotoControls
                  key={editing}
                  dragHint={!model}
                  placement={print.placement}
                  onChange={print.setPlacement}
                  removeBg={print.removeBg}
                  removing={print.removing}
                  onToggleBg={print.toggleBackground}
                  onRemove={() => active.removePhoto(photos[0].uid)}
                />
              )}
              <p className="vitrin-error" role="alert">{print.error}</p>
            </>
          ) : (
            <>
              {colorImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="tsr-product" src={cartImageSrc(colorImage) ?? ''} alt={`${title}${color ? `, ${color}` : ''}`} />
              )}
              <p className="tsr-hint">
                {mugColors.length
                  ? `${color} renginde canlı önizleme yok. ${mugColors.join(', ')} renklerinde fotoğrafınızı kupanın üstünde görebilirsiniz.`
                  : 'Baskıdan önce nasıl duracağını size göndeririz.'}
              </p>
            </>
          )}
        </div>

        <form className="tsr-form" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          {options.length + mugColors.length > 0 && (
            <fieldset className="tsr-field">
              <legend>Renk: <b>{color}</b></legend>
              <div className="tsr-chips">
                {(options.length ? options : mugColors).map((c) => (
                  <button key={c} type="button" className="tsr-chip" aria-pressed={same(c, color)} onClick={() => setColor(c)}>{c}</button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="tsr-field">
            <legend>Baskı</legend>
            <div className="tsr-chips">
              <button type="button" className="tsr-chip" aria-pressed={!twoSided} onClick={() => setTwoSided(false)}>Tek yüz</button>
              <button type="button" className="tsr-chip" aria-pressed={twoSided} onClick={() => setTwoSided(true)}>İki yüze ayrı baskı</button>
            </div>
          </fieldset>

          {twoSided && (
            <div className="tsr-sides" role="group" aria-label="Hazırladığınız yüz">
              {SIDES.map((id) => (
                <button key={id} type="button" aria-pressed={side === id} onClick={() => setSide(id)}>
                  <b>{SIDE_LABELS[id]}</b>
                  <span>{SIDE_HINTS[id]} · {sides[id].empty ? 'boş' : 'hazır'}</span>
                </button>
              ))}
            </div>
          )}

          {ready && (
            <div className="tsr-ready">
              {ready.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cartImageSrc(ready.image) ?? ''} alt="" />
              )}
              <p>Hazır tasarım: <b>{ready.name}</b></p>
              <button type="button" className="tsr-chip" onClick={() => active.setReady(undefined)}>Kaldır</button>
            </div>
          )}

          <div className="tsr-field">
            <label htmlFor="tsr-yazi">{sideName ? `${sideName}deki yazı` : 'Kupadaki yazı'} <span>(isteğe bağlı)</span></label>
            <input id="tsr-yazi" className="cart-input" maxLength={MAX_TEXT} value={text} placeholder="İyi ki doğdun Elif" autoComplete="off" onChange={(e) => active.setText(e.target.value)} />
            <div className="tsr-chips">
              <button type="button" className="tsr-chip" aria-pressed={font === 'duz'} onClick={() => active.setFont('duz')}>Düz yazı</button>
              <button type="button" className="tsr-chip is-hand" aria-pressed={font === 'el'} onClick={() => active.setFont('el')}>El yazısı</button>
            </div>
          </div>

          <div className="tsr-field">
            <span className="tsr-label">{sideName ? `${sideName} için fotoğraf, logo ya da çizim` : 'Fotoğraf, logo ya da çizim'} ({photos.length}/{room})</span>
            <ul className="tsr-photos">
              {photos.map((p, i) => (
                <li key={p.uid}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Eklediğiniz fotoğraf ${i + 1}`} />
                  <button type="button" onClick={() => active.removePhoto(p.uid)} aria-label={`${i + 1}. fotoğrafı kaldır`}><CloseIcon size={16} /></button>
                </li>
              ))}
              {photos.length < room && (
                <li>
                  <label className="tsr-add">
                    Fotoğraf ekle
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
                  </label>
                </li>
              )}
            </ul>
            <p className="tsr-small">
              {live && photos.length > 1 ? 'Önizlemede ilk fotoğraf görünür; diğerleri siparişe eklenir. ' : ''}
              Fotoğraflar siparişi oluşturana kadar cihazınızda kalır.
            </p>
          </div>

          <label className="tsr-check">
            <input type="checkbox" checked={needsDesign} onChange={(e) => setNeedsDesign(e.target.checked)} />
            Tasarımım yok, siz hazırlayın
          </label>

          <div className="tsr-field">
            <label htmlFor="tsr-not">Not <span>(isteğe bağlı)</span></label>
            <textarea id="tsr-not" className="cart-input" rows={3} maxLength={NOTE_MAX} value={note} placeholder="Yazının yeri, teslim tarihi…" onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="tsr-field">
            <span className="tsr-label">Adet</span>
            <div className="cart-qty" role="group" aria-label="Adet">
              <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
              <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
              <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
            </div>
          </div>

          <p className="tsr-error" role="alert">{error}</p>
          <button type="submit" className="btn btn-primary btn-block tsr-submit" disabled={saving || front.print.removing || back.print.removing}>
            <CartIcon size={18} /> {saving ? 'Ekleniyor…' : lineKey ? 'Değişikliği kaydet' : 'Sepete ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
