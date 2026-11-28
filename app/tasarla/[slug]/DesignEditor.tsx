'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '@/types';
import MugPreview, { MugPreviewHandle } from '@/components/MugPreview';
import Mug3D from '@/components/mug3d/Mug3DLazy';
import type { Mug3DHandle } from '@/components/mug3d/Mug3D';
import Tahta from '@/components/tasarim/Tahta';
import KatmanPaneli from '@/components/tasarim/KatmanPaneli';
import SusSecici from '@/components/tasarim/SusSecici';
import DuzenSecici from '@/components/tasarim/DuzenSecici';
import { MUG_MODELS, SNAPSHOT_BACKGROUND, mugModelFor, mugPalette, printSize } from '@/lib/mug3d';
import { drawPrint } from '@/lib/mug-print';
import { SIDES, SIDE_HINTS, SIDE_LABELS, SideId } from '@/lib/design-sides';
import { takeDraft } from '@/lib/design-draft';
import { CartIcon } from '@/components/cart/CartLink';
import { CloseIcon } from '@/components/icons';
import { useCart } from '@/lib/cart-context';
import { saveFile } from '@/lib/cart-files';
import { cartImageSrc, productToCartItem } from '@/lib/cart-products';
import { MAX_QTY, NOTE_MAX, clampQty } from '@/lib/cart';
import { isUsableImage } from '@/lib/siparis-client';
import { MAX_LINE_PHOTOS } from '@/lib/siparis-types';
import { VITRIN_MUGS, VITRIN_PRODUCT_SLUG } from '@/lib/vitrin';
import { displayTitle, formatPriceRange } from '@/lib/format';
import { getPriceMin, getSlug, getTitle } from '@/lib/product-utils';
import { lineHref } from '@/lib/configurator-lines';
import type { DesignSide } from '@/lib/cart-types';
import { trackEvent } from '@/lib/analytics-client';
import { Side, copySide, emptySide, insertPhotoLayer, isEmptySide, placePhoto, removePhoto, setReady } from '@/lib/tasarim/belge';
import { hitLayer, Geometry } from '@/lib/tasarim/ciz';
import { moveTo } from '@/lib/tasarim/hareket';
import { COLLAGE_LABELS, Collage, arrange } from '@/lib/tasarim/kolaj';
import {
  Layer, MAX_LAYERS, addLayer, duplicateLayer, layersText, moveLayer, patternLayer, printableLayers, removeLayer,
  shapeLayer, textLayer, updateLayer, wantsCut,
} from '@/lib/tasarim/model';
import { Template, applyTemplate } from '@/lib/tasarim/sablonlar';
import { clearSavedDesign, loadSavedDesign, storeDesign, DraftSide } from '@/lib/tasarim/taslak';
import { useDoc } from '@/lib/tasarim/use-belge';
import { useSide } from '@/lib/tasarim/use-yuz';
import '@/components/cart/cart.css';
import '@/components/tasarim/tasarim.css';

interface Props {
  product: Product;
  initialColor?: string;
  /** Sepetteki satır düzenleniyorsa anahtarı. */
  lineKey?: string;
}

interface Grab { side: SideId; layer: Layer; g: Geometry; x: number; y: number; tag: string }

const same = (a: string, b: string) => a.toLocaleLowerCase('tr-TR') === b.toLocaleLowerCase('tr-TR');
/** Yeni yazı ve süsler üst üste binmesin diye sırayla bu yerlere konur. */
const TEXT_SPOTS = [0.5, 0.8, 0.2, 0.65, 0.35];
const SHAPE_SPOTS: [number, number][] = [[0.14, 0.3], [0.86, 0.3], [0.14, 0.72], [0.86, 0.72], [0.5, 0.2], [0.5, 0.8], [0.32, 0.5], [0.68, 0.5]];

function layerName(l: Layer): string {
  if (l.kind === 'text') return l.text.trim().split('\n')[0].slice(0, 18) || 'Boş yazı';
  if (l.kind === 'photo') return l.n < 0 ? 'Hazır desen' : `Fotoğraf ${l.n + 1}`;
  if (l.kind === 'shape') return 'Süs';
  return 'Desen';
}

/** Cihaza kaydedilemeyen fotoğraf taslağa girmez. */
function draftSide(side: Side): DraftSide {
  let kept = side;
  for (let i = side.photos.length - 1; i >= 0; i -= 1) if (!side.photos[i].fileId) kept = removePhoto(kept, i);
  return { layers: kept.layers, photos: kept.photos.map((p) => p.fileId!), ready: kept.ready };
}

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
  /** Üç boyutlu kupanın döndüğü yüz: kupadan tutarken değişmez, yoksa parmağın altından kayar. */
  const [view, setView] = useState<SideId>('front');
  const [needsDesign, setNeedsDesign] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [picker, setPicker] = useState<'shape' | 'template' | null>(null);
  const [restored, setRestored] = useState(false);
  /** Kayıtlı tasarım yüklenmeden üzerine yazılmasın. */
  const [hydrated, setHydrated] = useState(false);
  const preview = useRef<MugPreviewHandle>(null);
  const view3d = useRef<Mug3DHandle>(null);
  const grab = useRef<Grab | null>(null);
  const loaded = useRef(false);
  const finished = useRef(false);

  const options = Array.from(new Set([...colors, ...(color && !colors.some((c) => same(c, color)) ? [color] : [])]));
  const [flat, setFlat] = useState(false);
  const model = flat ? null : mugModelFor(getTitle(product));
  // Üç boyut yoksa (eski cihaz) fotoğraflı düz önizlemeye dönülür.
  const mug = !model && slug === VITRIN_PRODUCT_SLUG ? VITRIN_MUGS.find((m) => same(m.color, color)) : undefined;
  const colors3d = useMemo(() => (model ? mugPalette(model, color) : null), [model, color]);
  const printModel = mugModelFor(getTitle(product)) ?? MUG_MODELS.luks;
  const sheet = useMemo(() => printSize(printModel, 900), [printModel]);
  const boardColor = mugPalette(printModel, color).body;

  const store = useDoc();
  const front = useSide(store.doc.front, sheet, printModel);
  const back = useSide(store.doc.back, sheet, printModel);
  const renders = { front, back };
  const editing: SideId = twoSided ? side : 'front';
  const current = store.doc[editing];
  const render = renders[editing];
  const layer = current.layers.find((l) => l.id === selected);
  const other: SideId = editing === 'front' ? 'back' : 'front';
  /** Fotoğraf sınırı iki yüzün toplamıdır. */
  const room = MAX_LINE_PHOTOS - (twoSided ? store.doc[other].photos.length : 0);
  const sideName = twoSided ? SIDE_LABELS[editing] : '';
  const colorImage = product.colors?.find((c) => same(c.name, color))?.images?.[0] ?? product.images?.[0];
  const photoLayers = current.layers.filter((l) => l.kind === 'photo');
  const hasContent = !isEmptySide(store.doc.front) || (twoSided && !isEmptySide(store.doc.back));
  const blurry = (twoSided ? SIDES : (['front'] as SideId[])).find((id) => Array.from(renders[id].sharp.values()).includes('zayif'));
  const loading = front.loading || (twoSided && back.loading);

  const selectSide = (id: SideId) => {
    setSide(id);
    setView(id);
    setSelected(null);
  };

  // Sepetten "Düzenle", konfigüratörden seçim ya da yarım kalan tasarım: biri yüklenir.
  useEffect(() => {
    if (!cart.ready || loaded.current) return;
    loaded.current = true;
    const load = async () => {
      if (lineKey) {
        const line = cart.items.find((i) => i.key === lineKey);
        if (!line) return;
        const d = line.design;
        setColor(line.color ?? '');
        setQty(line.qty);
        setNote(line.note ?? '');
        setNeedsDesign(Boolean(d?.needsDesign));
        setTwoSided(Boolean(d?.back));
        if (d) await store.restore(d, d.back);
        return;
      }
      const picked = takeDraft(slug);
      if (picked) {
        setTwoSided(picked.twoSided);
        if (picked.front) store.change('front', (s) => setReady(s, picked.front));
        if (picked.back) store.change('back', (s) => setReady(s, picked.back));
        if (picked.twoSided && picked.front && !picked.back) selectSide('back');
        return;
      }
      const saved = loadSavedDesign(slug);
      if (!saved) return;
      if (!initialColor && saved.color) setColor(saved.color);
      setQty(clampQty(saved.qty));
      setNote(saved.note.slice(0, NOTE_MAX));
      setNeedsDesign(saved.needsDesign);
      setTwoSided(saved.twoSided);
      await store.restore(saved.front, saved.back);
      setRestored(true);
    };
    load().catch(() => setError('Kayıtlı tasarım yüklenemedi.')).finally(() => setHydrated(true));
    // Bir kez yüklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  // Yarım kalan tasarım cihazda saklanır (sepet satırı düzenlenirken saklanmaz).
  useEffect(() => {
    if (!hydrated || lineKey || finished.current) return;
    const timer = setTimeout(() => {
      if (finished.current) return;
      if (isEmptySide(store.doc.front) && isEmptySide(store.doc.back) && !note.trim()) { clearSavedDesign(slug); return; }
      storeDesign(slug, {
        at: Date.now(), color, qty, twoSided, needsDesign, note,
        front: draftSide(store.doc.front), back: draftSide(store.doc.back),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [hydrated, lineKey, slug, store.doc, color, qty, twoSided, needsDesign, note]);

  // Geri al / yinele kısayolları; yazı kutusunda tarayıcınınki çalışır.
  const { undo, redo } = store;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea, dialog')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const full = current.layers.length >= MAX_LAYERS;
  const add = (next: Layer) => {
    store.setLayers(editing, (list) => addLayer(list, next));
    setSelected(next.id);
    setFresh(next.kind === 'text' ? next.id : null);
    setError('');
  };

  const addText = () => {
    const texts = current.layers.filter((l) => l.kind === 'text').length;
    const withPhoto = photoLayers.length > 0;
    add(textLayer({
      text: 'Yazınız',
      y: withPhoto && !texts ? 0.82 : TEXT_SPOTS[texts % TEXT_SPOTS.length],
      s: withPhoto || texts ? 0.15 : 0.22,
    }));
  };

  const addShape = (set: 'ph' | 'fl', name: string) => {
    const [x, y] = SHAPE_SPOTS[current.layers.filter((l) => l.kind === 'shape').length % SHAPE_SPOTS.length];
    add(shapeLayer(set, name, { x, y, s: 0.3 }));
    setPicker(null);
  };

  const addPattern = () => {
    const found = current.layers.find((l) => l.kind === 'pattern');
    if (found) setSelected(found.id);
    else add(patternLayer({ set: 'ph', name: 'heart', color: '#E0306E' }));
  };

  const pickTemplate = (template: Template) => {
    store.change(editing, (s) => ({
      ...s,
      layers: applyTemplate(s.layers, template),
      slot: s.layers.some((l) => l.kind === 'photo') ? undefined : template.photo,
    }));
    setSelected(null);
    setPicker(null);
  };

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    setError('');
    setAdding(true);
    try {
      const usable = await Promise.all(picked.map((f) => isUsableImage(f, true).catch(() => false)));
      const files = picked.filter((_, i) => usable[i]);
      const rejected = picked.filter((_, i) => !usable[i]).map((f) => f.name);
      const free = Math.max(0, room - current.photos.length);
      if (rejected.length) setError(`Açılamayan dosya eklenmedi: ${rejected.join(', ')}. JPG veya PNG deneyin.`);
      else if (files.length > free) setError(`En fazla ${MAX_LINE_PHOTOS} fotoğraf eklenebilir.`);
      if (files.length && free) await store.addFiles(editing, files.slice(0, free), sheet);
    } catch {
      setError('Fotoğraf eklenemedi. Başka bir dosya deneyin.');
    } finally {
      setAdding(false);
    }
  };

  /** Fotoğraf listesinden: katmanı varsa seçilir, yoksa baskıya eklenir. */
  const pickPhoto = (n: number) => {
    const found = current.layers.find((l) => l.kind === 'photo' && l.n === n);
    if (found) { setSelected(found.id); return; }
    const next = placePhoto(current, n);
    store.change(editing, (s) => ({ ...s, layers: insertPhotoLayer(s.layers, next) }));
    setSelected(next.id);
  };

  /** Öğeyi siler; fotoğraf katmanında fotoğrafın kendisi de gider. */
  const remove = (id: string) => {
    const target = current.layers.find((l) => l.id === id);
    if (!target) return;
    if (target.kind === 'photo' && target.n >= 0) store.dropPhoto(editing, target.n);
    else if (target.kind === 'photo') store.change(editing, (s) => setReady(s, undefined));
    else store.setLayers(editing, (list) => removeLayer(list, id));
    setSelected(null);
  };

  const change = (id: string, patch: Partial<Layer>, tag?: string) =>
    store.setLayers(editing, (list) => updateLayer(list, id, patch), tag);

  /** Kupanın üstündeki noktada tutulabilecek öğe. */
  const underMug = (hitSide: SideId, u: number, v: number) =>
    !twoSided && hitSide === 'back' ? null : hitLayer(renders[hitSide].geometry, u * sheet.width, v * sheet.height, sheet.width * 0.025);

  const grabFromMug = (hitSide: SideId, u: number, v: number) => {
    const x = u * sheet.width;
    const y = v * sheet.height;
    const g = underMug(hitSide, u, v);
    const target = g && store.doc[hitSide].layers.find((l) => l.id === g.id);
    if (!g || !target) return false;
    if (twoSided) setSide(hitSide);
    setSelected(target.id);
    setFresh(null);
    grab.current = { side: hitSide, layer: target, g, x, y, tag: `mug:${target.id}:${Date.now()}` };
    return true;
  };

  const dragOnMug = (u: number, v: number) => {
    const held = grab.current;
    if (!held) return;
    const { patch } = moveTo(held.layer, held.g, sheet, held.g.cx + u * sheet.width - held.x, held.g.cy + v * sheet.height - held.y);
    store.setLayers(held.side, (list) => updateLayer(list, held.layer.id, patch), held.tag);
  };

  const download = async () => {
    setError('');
    let blob: Blob | null | undefined = model
      ? await view3d.current?.snapshot(SNAPSHOT_BACKGROUND, twoSided)
      : mug ? await preview.current?.snapshot(mug.field) : null;
    if (!blob) {
      const canvas = document.createElement('canvas');
      canvas.width = sheet.width * 2;
      canvas.height = sheet.height * 2;
      drawPrint(canvas, { ...render.content, base: boardColor });
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    }
    if (!blob) { setError('Görsel hazırlanamadı.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kar-ta-tasarim-${slug}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const startOver = () => {
    store.reset();
    clearSavedDesign(slug);
    setSelected(null);
    setRestored(false);
    setNote('');
    setNeedsDesign(false);
    setTwoSided(false);
    selectSide('front');
  };

  /** Bir yüzün fotoğraflarını cihaza kaydedip sepet biçimine çevirir. */
  const saveSide = async (s: Side): Promise<DesignSide> => {
    const ids: string[] = [];
    for (const p of s.photos) ids.push(p.fileId ?? await saveFile(p.blob));
    const layers = printableLayers(s.layers);
    return { photos: ids, ready: s.ready, layers, text: layersText(layers) || undefined, removeBg: wantsCut(layers) || undefined };
  };

  const submit = async () => {
    setError('');
    const blank = twoSided ? SIDES.find((id) => isEmptySide(store.doc[id])) : undefined;
    if (blank && !needsDesign) {
      selectSide(blank);
      setError(`${SIDE_LABELS[blank]} boş. Bir yazı, fotoğraf ya da süs ekleyin, ya da “Tek yüz” seçin.`);
      return;
    }
    if (!twoSided && isEmptySide(store.doc.front) && !needsDesign && !note.trim()) {
      setError('Bir yazı, fotoğraf ya da süs ekleyin, ya da “Tasarımım yok” seçin.');
      return;
    }
    if (twoSided && store.doc.front.photos.length + store.doc.back.photos.length > MAX_LINE_PHOTOS) {
      setError(`İki yüz için toplam en fazla ${MAX_LINE_PHOTOS} fotoğraf ekleyebilirsiniz.`);
      return;
    }
    setSaving(true);
    setSelected(null);
    try {
      const frontSide = await saveSide(store.doc.front);
      const backSide = twoSided ? await saveSide(store.doc.back) : undefined;
      const wanted = hasContent;
      // Düz önizleme tek yüzü gösterdiği için iki yüzlü satırda küçük resim yalnız üç boyutta alınır.
      const shot = !wanted ? null : model
        ? await view3d.current?.snapshot(SNAPSHOT_BACKGROUND, twoSided)
        : mug && !twoSided ? await preview.current?.snapshot(mug.field) : null;
      const previewId = shot ? await saveFile(shot) : undefined;
      finished.current = true;
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
      if (!lineKey) clearSavedDesign(slug);
      trackEvent('cart_add', { slug, qty });
      router.push('/sepet');
    } catch {
      finished.current = false;
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

      {restored && (
        <p className="tsr-restored" role="status">
          Yarım kalan tasarımınız yüklendi.
          <button type="button" className="tsr-chip" onClick={startOver}>Baştan başla</button>
        </p>
      )}

      <div className="tsr-grid">
        <div
          className={`tsr-stage${mug ? ' is-live' : ''}${model ? ' is-3d' : ''}`}
          style={mug ? { ['--field' as string]: mug.field, ['--on-field' as string]: mug.onField } : undefined}
        >
          {model && colors3d ? (
            <Mug3D
              handle={view3d}
              model={model}
              colors={colors3d}
              label={`${title}${color ? `, ${color}` : ''}`}
              {...front.content}
              back={twoSided ? back.content : undefined}
              view={view}
              onView={twoSided ? selectSide : undefined}
              onUnsupported={() => setFlat(true)}
              onGrab={grabFromMug}
              canGrab={(hitSide, u, v) => Boolean(underMug(hitSide, u, v))}
              onDrag={dragOnMug}
              onDrop={() => { grab.current = null; }}
            />
          ) : mug ? (
            <MugPreview
              ref={preview}
              mug={mug}
              text=""
              font="duz"
              photo={null}
              layers={render.content.layers}
              assets={render.content.assets}
              mirrored={editing === 'back'}
            />
          ) : (
            <>
              {colorImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="tsr-product" src={cartImageSrc(colorImage) ?? ''} alt={`${title}${color ? `, ${color}` : ''}`} />
              )}
              <p className="tsr-hint">
                {mugColors.length
                  ? `${color} renginde canlı kupa görünümü yok; tasarımınızı baskı alanında hazırlayabilirsiniz.`
                  : 'Baskıdan önce nasıl duracağını size göndeririz.'}
              </p>
            </>
          )}
          {hasContent && (
            <button type="button" className="tsr-chip" disabled={loading} onClick={download}>Görseli indir</button>
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
              <button type="button" className="tsr-chip" aria-pressed={!twoSided} onClick={() => { setTwoSided(false); selectSide('front'); }}>Tek yüz</button>
              <button type="button" className="tsr-chip" aria-pressed={twoSided} onClick={() => setTwoSided(true)}>İki yüze ayrı baskı</button>
            </div>
          </fieldset>

          {twoSided && (
            <div className="tsr-sides" role="group" aria-label="Hazırladığınız yüz">
              {SIDES.map((id) => (
                <button key={id} type="button" aria-pressed={side === id} onClick={() => selectSide(id)}>
                  <b>{SIDE_LABELS[id]}</b>
                  <span>{SIDE_HINTS[id]} · {isEmptySide(store.doc[id]) ? 'boş' : 'hazır'}</span>
                </button>
              ))}
            </div>
          )}

          {current.ready && (
            <div className="tsr-ready">
              {current.ready.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cartImageSrc(current.ready.image) ?? ''} alt="" />
              )}
              <p>Hazır tasarım: <b>{current.ready.name}</b></p>
              <button type="button" className="tsr-chip" onClick={() => store.change(editing, (s) => setReady(s, undefined))}>Kaldır</button>
            </div>
          )}

          <section className={`tsr-studio${layer ? ' is-editing' : ''}`} aria-label={sideName ? `${sideName} tasarımı` : 'Tasarım'}>
            <div className="tsr-add-bar" role="group" aria-label="Ekle">
              <button type="button" className="tsr-tool" onClick={addText} disabled={full}>Yazı ekle</button>
              <label className={`tsr-tool${adding || current.photos.length >= room ? ' is-off' : ''}`}>
                {adding ? 'Ekleniyor…' : 'Fotoğraf ekle'}
                <input type="file" accept="image/*" multiple className="sr-only" disabled={adding || current.photos.length >= room} onChange={addPhotos} />
              </label>
              <button type="button" className="tsr-tool" onClick={() => setPicker('shape')} disabled={full}>Süs ekle</button>
              <button type="button" className="tsr-tool" onClick={addPattern}>Desen</button>
              <button type="button" className="tsr-tool is-wide" onClick={() => setPicker('template')}>Hazır düzenler</button>
            </div>

            <Tahta
              sheet={sheet}
              background={boardColor}
              layers={current.layers}
              assets={render.assets}
              geometry={render.geometry}
              selected={selected}
              onSelect={(id) => { setSelected(id); setFresh(null); }}
              onChange={change}
              onRemove={remove}
              label={sideName ? `${sideName} baskı alanı` : 'Baskı alanı'}
            />

            <div className="tsr-history">
              <button type="button" className="tsr-chip" onClick={store.undo} disabled={!store.canUndo}>Geri al</button>
              <button type="button" className="tsr-chip" onClick={store.redo} disabled={!store.canRedo}>Yinele</button>
              {current.layers.length > 0 && (
                <button type="button" className="tsr-chip" onClick={() => { store.change(editing, () => emptySide()); setSelected(null); }}>Temizle</button>
              )}
              {twoSided && !isEmptySide(current) && (
                <button
                  type="button" className="tsr-chip"
                  onClick={() => { store.change(other, () => copySide(current, MAX_LINE_PHOTOS - current.photos.length)); selectSide(other); }}
                >
                  {SIDE_LABELS[other]}e kopyala
                </button>
              )}
            </div>

            {render.photoFailed && (
              <p className="tsk-warn" role="status">
                Bir fotoğraf bu tarayıcıda gösterilemiyor. Siparişe eklenir, baskıda biz yerleştiririz; burada görmek için JPG ya da PNG yükleyin.
              </p>
            )}
            {render.failed && !render.photoFailed && (
              <p className="tsr-error" role="alert">
                Bir yazı tipi ya da görsel yüklenemedi. <button type="button" className="tsr-chip" onClick={render.retry}>Yeniden dene</button>
              </p>
            )}
            {current.slot && !current.photos.length && <p className="tsr-small" role="status">Bu düzende fotoğraf yeri var: fotoğraf eklediğinizde yerine oturur.</p>}

            {current.layers.length > 1 && (
              <ul className="tsr-layers" aria-label="Eklenenler">
                {current.layers.map((l) => (
                  <li key={l.id}>
                    <button type="button" className="tsr-chip" aria-pressed={selected === l.id} onClick={() => { setSelected(l.id); setFresh(null); }}>{layerName(l)}</button>
                  </li>
                ))}
              </ul>
            )}

            {layer && (
              <KatmanPaneli
                layer={layer}
                geometry={render.geometry.find((g) => g.id === layer.id)}
                sheet={sheet}
                sharp={render.sharp.get(layer.id)}
                cutting={render.cutting}
                cutFailed={render.cutFailed}
                focusText={fresh === layer.id}
                onChange={(patch, tag) => change(layer.id, patch, tag)}
                onDuplicate={() => {
                  const copy = duplicateLayer(current.layers, layer.id);
                  if (!copy.id) return;
                  store.setLayers(editing, () => copy.layers);
                  setSelected(copy.id);
                }}
                onOrder={(step) => store.setLayers(editing, (list) => moveLayer(list, layer.id, step))}
                onRemove={() => remove(layer.id)}
                onDone={() => setSelected(null)}
              />
            )}

            {current.photos.length > 0 && (
              <div className="tsr-field">
                <span className="tsr-label">Fotoğraflar ({current.photos.length}/{room})</span>
                <ul className="tsr-photos">
                  {current.photos.map((p, i) => {
                    const placed = current.layers.some((l) => l.kind === 'photo' && l.n === i);
                    return (
                      <li key={p.uid}>
                        <button type="button" className="tsr-photo" onClick={() => pickPhoto(i)} aria-label={placed ? `${i + 1}. fotoğrafı seç` : `${i + 1}. fotoğrafı baskıya ekle`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" />
                          {!placed && <span>Baskıya ekle</span>}
                        </button>
                        <button type="button" className="tsr-photo-remove" onClick={() => { store.dropPhoto(editing, i); setSelected(null); }} aria-label={`${i + 1}. fotoğrafı kaldır`}><CloseIcon size={16} /></button>
                      </li>
                    );
                  })}
                </ul>
                {photoLayers.length > 1 && (
                  <div className="tsr-chips" role="group" aria-label="Fotoğrafları diz">
                    {(Object.entries(COLLAGE_LABELS) as [Collage, string][]).map(([kind, name]) => (
                      <button key={kind} type="button" className="tsr-chip" onClick={() => store.setLayers(editing, (list) => arrange(list, kind, sheet))}>{name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="tsr-small">Fotoğraflar siparişi oluşturana kadar cihazınızda kalır.</p>
          </section>

          <label className="tsr-check">
            <input type="checkbox" checked={needsDesign} onChange={(e) => setNeedsDesign(e.target.checked)} />
            Tasarımım yok, siz hazırlayın
          </label>

          <div className="tsr-field">
            <label htmlFor="tsr-not">Not <span>(isteğe bağlı)</span></label>
            <textarea id="tsr-not" className="cart-input" rows={3} maxLength={NOTE_MAX} value={note} placeholder="Teslim tarihi, özel isteğiniz…" onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="tsr-field">
            <span className="tsr-label">Adet</span>
            <div className="cart-qty" role="group" aria-label="Adet">
              <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
              <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
              <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
            </div>
          </div>

          {blurry && (
            <p className="tsk-warn" role="status">
              {twoSided ? `${SIDE_LABELS[blurry]}deki` : 'Tasarımdaki'} bir fotoğraf bulanık basılabilir. Küçültün ya da daha büyüğünü yükleyin.
            </p>
          )}
          <p className="tsr-error" role="alert">{error}</p>
          <button type="submit" className="btn btn-primary btn-block tsr-submit" disabled={saving || adding || loading || !hydrated}>
            <CartIcon size={18} /> {saving ? 'Ekleniyor…' : loading ? 'Tasarım hazırlanıyor…' : lineKey ? 'Değişikliği kaydet' : 'Sepete ekle'}
          </button>
        </form>
      </div>

      {picker === 'shape' && <SusSecici onPick={addShape} onClose={() => setPicker(null)} />}
      {picker === 'template' && (
        <DuzenSecici side={current} sources={render.sources} sheet={sheet} background={boardColor} onPick={pickTemplate} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
