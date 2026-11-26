'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/types';
import MugPreview, { MugPreviewHandle, PrintFont } from '@/components/MugPreview';
import PhotoControls from '@/components/PhotoControls';
import { CartIcon } from '@/components/cart/CartLink';
import { CloseIcon } from '@/components/icons';
import { useCart } from '@/lib/cart-context';
import { loadFile, newId, saveFile } from '@/lib/cart-files';
import { cartImageSrc, productToCartItem } from '@/lib/cart-products';
import { MAX_QTY, NOTE_MAX, clampQty } from '@/lib/cart';
import { isUsableImage, prepareUpload } from '@/lib/siparis-client';
import { MAX_LINE_PHOTOS, MAX_TEXT } from '@/lib/siparis-types';
import { usePrintPhoto } from '@/lib/use-print-photo';
import { VITRIN_MUGS, VITRIN_PRODUCT_SLUG } from '@/lib/vitrin';
import { displayTitle, formatPriceRange } from '@/lib/format';
import { getPriceMin, getSlug, getTitle } from '@/lib/product-utils';
import { lineHref } from '@/lib/configurator-lines';
import type { ReadyDesign } from '@/lib/cart-types';
import { trackEvent } from '@/lib/analytics-client';
import '@/components/cart/cart.css';

interface Props {
  product: Product;
  initialColor?: string;
  /** Sepetteki satır düzenleniyorsa anahtarı. */
  lineKey?: string;
}

interface Picked {
  uid: string;
  blob: Blob;
  url: string;
  /** Cihazda zaten kayıtlıysa kimliği. */
  fileId?: string;
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
  const [text, setText] = useState('');
  const [font, setFont] = useState<PrintFont>('duz');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [needsDesign, setNeedsDesign] = useState(false);
  const [ready, setReady] = useState<ReadyDesign>();
  const [note, setNote] = useState('');
  const [initial, setInitial] = useState<Parameters<typeof usePrintPhoto>[1]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const preview = useRef<MugPreviewHandle>(null);
  const loaded = useRef(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const options = Array.from(new Set([...colors, ...(color && !colors.some((c) => same(c, color)) ? [color] : [])]));
  const mug = slug === VITRIN_PRODUCT_SLUG ? VITRIN_MUGS.find((m) => same(m.color, color)) : undefined;
  const print = usePrintPhoto(mug ? photos[0]?.blob ?? null : null, initial);
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
    setText(d?.text ?? '');
    setFont(d?.font ?? 'duz');
    setNeedsDesign(Boolean(d?.needsDesign));
    setReady(d?.ready);
    Promise.all((d?.photos ?? []).map(async (fileId) => {
      const blob = await loadFile(fileId).catch(() => null);
      return blob ? { uid: fileId, fileId, blob, url: URL.createObjectURL(blob) } : null;
    })).then((list) => {
      setInitial({ placement: d?.placement, removeBg: d?.removeBg });
      setPhotos(list.filter((p): p is NonNullable<typeof p> => p !== null));
    });
  }, [cart.ready, cart.items, lineKey]);

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError('');
    const usable = await Promise.all(picked.map((f) => isUsableImage(f, true).catch(() => false)));
    const files = picked.filter((_, i) => usable[i]);
    const rejected = picked.filter((_, i) => !usable[i]).map((f) => f.name);
    if (rejected.length) setError(`Açılamayan dosya eklenmedi: ${rejected.join(', ')}. JPG veya PNG deneyin.`);
    setPhotos((prev) => [
      ...prev,
      ...files.slice(0, MAX_LINE_PHOTOS - prev.length).map((blob) => ({ uid: newId(), blob, url: URL.createObjectURL(blob) })),
    ]);
  };

  const removePhoto = (uid: string) => {
    if (photos[0]?.uid === uid) setInitial(undefined);
    setPhotos((prev) => prev.filter((p) => {
      if (p.uid === uid) URL.revokeObjectURL(p.url);
      return p.uid !== uid;
    }));
  };

  const submit = async () => {
    setError('');
    if (!text.trim() && !photos.length && !needsDesign && !note.trim() && !ready) {
      setError('Bir yazı ya da fotoğraf ekleyin, ya da “Tasarımım yok” seçin.');
      return;
    }
    setSaving(true);
    try {
      const ids: string[] = [];
      for (const p of photos) ids.push(p.fileId ?? await saveFile(await prepareUpload(p.blob)));
      const shot = mug && (text.trim() || photos.length) ? await preview.current?.snapshot(mug.field) : null;
      const previewId = shot ? await saveFile(shot) : undefined;
      cart.save(productToCartItem(product, {
        key: lineKey,
        qty,
        color: color || undefined,
        note,
        design: {
          photos: ids,
          preview: previewId,
          ready,
          text: text.trim() || undefined,
          font: text.trim() ? font : undefined,
          placement: mug && ids.length ? print.placement : undefined,
          removeBg: mug && ids.length && print.removeBg ? true : undefined,
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
          className={`tsr-stage${mug ? ' is-live' : ''}`}
          style={mug ? { ['--field' as string]: mug.field, ['--on-field' as string]: mug.onField } : undefined}
        >
          {mug ? (
            <>
              <MugPreview
                ref={preview}
                mug={mug}
                text={text}
                font={font}
                photo={print.image}
                placement={print.placement}
                onPlacementChange={print.setPlacement}
              />
              {photos.length > 0 && (
                <PhotoControls
                  placement={print.placement}
                  onChange={print.setPlacement}
                  removeBg={print.removeBg}
                  removing={print.removing}
                  onToggleBg={print.toggleBackground}
                  onRemove={() => removePhoto(photos[0].uid)}
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

          {ready && (
            <div className="tsr-ready">
              {ready.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cartImageSrc(ready.image) ?? ''} alt="" />
              )}
              <p>Hazır tasarım: <b>{ready.name}</b></p>
              <button type="button" className="tsr-chip" onClick={() => setReady(undefined)}>Kaldır</button>
            </div>
          )}

          <div className="tsr-field">
            <label htmlFor="tsr-yazi">Kupadaki yazı <span>(isteğe bağlı)</span></label>
            <input id="tsr-yazi" className="cart-input" maxLength={MAX_TEXT} value={text} placeholder="İyi ki doğdun Elif" autoComplete="off" onChange={(e) => setText(e.target.value)} />
            <div className="tsr-chips">
              <button type="button" className="tsr-chip" aria-pressed={font === 'duz'} onClick={() => setFont('duz')}>Düz yazı</button>
              <button type="button" className="tsr-chip is-hand" aria-pressed={font === 'el'} onClick={() => setFont('el')}>El yazısı</button>
            </div>
          </div>

          <div className="tsr-field">
            <span className="tsr-label">Fotoğraf, logo ya da çizim ({photos.length}/{MAX_LINE_PHOTOS})</span>
            <ul className="tsr-photos">
              {photos.map((p, i) => (
                <li key={p.uid}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Eklediğiniz fotoğraf ${i + 1}`} />
                  <button type="button" onClick={() => removePhoto(p.uid)} aria-label={`${i + 1}. fotoğrafı kaldır`}><CloseIcon size={16} /></button>
                </li>
              ))}
              {photos.length < MAX_LINE_PHOTOS && (
                <li>
                  <label className="tsr-add">
                    Fotoğraf ekle
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
                  </label>
                </li>
              )}
            </ul>
            <p className="tsr-small">
              {mug && photos.length > 1 ? 'Önizlemede ilk fotoğraf görünür; diğerleri siparişe eklenir. ' : ''}
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
          <button type="submit" className="btn btn-primary btn-block tsr-submit" disabled={saving || print.removing}>
            <CartIcon size={18} /> {saving ? 'Ekleniyor…' : lineKey ? 'Değişikliği kaydet' : 'Sepete ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
