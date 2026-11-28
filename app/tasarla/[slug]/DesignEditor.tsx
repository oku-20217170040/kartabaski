'use client';

import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '@/types';
import MugPreview, { MugPreviewHandle } from '@/components/MugPreview';
import Mug3D from '@/components/mug3d/Mug3DLazy';
import type { Mug3DHandle } from '@/components/mug3d/Mug3D';
import Tahta from '@/components/tasarim/Tahta';
import AracCubugu from '@/components/tasarim/AracCubugu';
import Pencere from '@/components/tasarim/Pencere';
import { Menu, MenuItem, Panel, UstCubuk } from '@/components/tasarim/Studyo';
import AracPaneli from '@/components/tasarim/panel/AracPaneli';
import SusPaneli from '@/components/tasarim/panel/SusPaneli';
import { DesenPaneli, DuzenPaneli, YaziPaneli } from '@/components/tasarim/panel/Galeriler';
import { FotoPaneli, KatmanListesi, KupaPaneli } from '@/components/tasarim/panel/KupaFotoKatman';
import {
  ICart, IClear, IClose, ICopy, IDownload, ILayers, IMug, IPattern, IPhoto, IRedo, ISticker, ITemplates, IText, IUndo, MugGlyph,
} from '@/components/tasarim/ikonlar';
import { TAB_TITLES, TOOL_TITLES, Tab, Tool } from '@/components/tasarim/turler';
import { MUG_MODELS, SNAPSHOT_BACKGROUND, mugModelFor, mugPalette, printSize, swatchColor } from '@/lib/mug3d';
import { drawPrint } from '@/lib/mug-print';
import { SIDES, SIDE_HINTS, SIDE_LABELS, SideId } from '@/lib/design-sides';
import { takeDraft } from '@/lib/design-draft';
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
import { useMediaQuery } from '@/lib/use-media-query';
import { Side, copySide, emptySide, insertPhotoLayer, isEmptySide, placePhoto, removePhoto, setReady } from '@/lib/tasarim/belge';
import { hitLayer, Geometry } from '@/lib/tasarim/ciz';
import { PatternStyle, TextStyle, patternFrom } from '@/lib/tasarim/hazir-parcalar';
import { moveTo } from '@/lib/tasarim/hareket';
import { arrange } from '@/lib/tasarim/kolaj';
import {
  Layer, MAX_LAYERS, addLayer, duplicateLayer, layersText, moveLayer, printableLayers, removeLayer,
  shapeLayer, textLayer, updateLayer, wantsCut,
} from '@/lib/tasarim/model';
import { Template, applyTemplate } from '@/lib/tasarim/sablonlar';
import { clearSavedDesign, loadSavedDesign, storeDesign, DraftSide } from '@/lib/tasarim/taslak';
import { useDoc } from '@/lib/tasarim/use-belge';
import { useSide } from '@/lib/tasarim/use-yuz';
import '@/components/cart/cart.css';
import '@/components/tasarim/studyo.css';

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

/** Cihaza kaydedilemeyen fotoğraf taslağa girmez. */
function draftSide(side: Side): DraftSide {
  let kept = side;
  for (let i = side.photos.length - 1; i >= 0; i -= 1) if (!side.photos[i].fileId) kept = removePhoto(kept, i);
  return { layers: kept.layers, photos: kept.photos.map((p) => p.fileId!), ready: kept.ready };
}

/** Sipariş penceresindeki önizleme resmi; görseller hazır olunca bir kez alınır. */
function FinishShot({ make, ready }: { make: () => Promise<Blob | null>; ready: boolean }) {
  const [url, setUrl] = useState('');
  const maker = useRef(make);
  maker.current = make;
  useEffect(() => {
    if (!ready) return;
    let made = '';
    let alive = true;
    maker.current().then((blob) => {
      if (!blob || !alive) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [ready]);
  return (
    <div className="std-finish-shot">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Tasarımınızın önizlemesi" />
      )}
    </div>
  );
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
  /** Açık menü sekmesi ve seçili öğenin açık aracı. */
  const [tab, setTab] = useState<Tab | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [finish, setFinish] = useState(false);
  const desktop = useMediaQuery('(min-width: 900px)') === true;
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

  /** Öğe seçilince telefonda menü paneli kapanır, araç çubuğu görünür. */
  const select = (id: string | null) => {
    setSelected(id);
    setTool(null);
    if (id && !desktop) setTab(null);
  };

  const selectSide = (id: SideId) => {
    setSide(id);
    setView(id);
    select(null);
  };

  const pickTab = (next: Tab) => {
    setTool(null);
    setTab((now) => (now === next && !desktop ? null : next));
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
  const add = (next: Layer, open?: Tool) => {
    if (full && next.kind !== 'pattern') { setError(`En fazla ${MAX_LAYERS} öğe eklenebilir.`); return; }
    store.setLayers(editing, (list) => addLayer(list, next));
    setSelected(next.id);
    setTool(open ?? null);
    if (!desktop || open) setTab(null);
    setError('');
  };

  /** Hazır stille ya da düz yazı ekler ve yazma panelini açar. */
  const addText = (style: TextStyle) => {
    const texts = current.layers.filter((l) => l.kind === 'text').length;
    const withPhoto = photoLayers.length > 0;
    add(textLayer({
      ...style.patch,
      text: style.text,
      y: withPhoto && !texts ? 0.82 : TEXT_SPOTS[texts % TEXT_SPOTS.length],
      s: withPhoto || texts ? 0.15 : 0.22,
    }), 'metin');
  };

  const addShape = (set: 'ph' | 'fl', name: string) => {
    const [x, y] = SHAPE_SPOTS[current.layers.filter((l) => l.kind === 'shape').length % SHAPE_SPOTS.length];
    add(shapeLayer(set, name, { x, y, s: 0.3 }));
  };

  /** Bir yüzde tek desen olur; yenisi eskisinin yerini alır. */
  const addPattern = (style: PatternStyle) => add(patternFrom(style));

  const pickTemplate = (template: Template) => {
    store.change(editing, (s) => ({
      ...s,
      layers: applyTemplate(s.layers, template),
      slot: s.layers.some((l) => l.kind === 'photo') ? undefined : template.photo,
    }));
    select(null);
    if (!desktop) setTab(null);
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
      if (files.length && free) {
        await store.addFiles(editing, files.slice(0, free), sheet);
        if (!desktop) setTab(null);
      }
    } catch {
      setError('Fotoğraf eklenemedi. Başka bir dosya deneyin.');
    } finally {
      setAdding(false);
    }
  };

  /** Fotoğraf listesinden: katmanı varsa seçilir, yoksa baskıya eklenir. */
  const pickPhoto = (n: number) => {
    const found = current.layers.find((l) => l.kind === 'photo' && l.n === n);
    if (found) { select(found.id); return; }
    const next = placePhoto(current, n);
    store.change(editing, (s) => ({ ...s, layers: insertPhotoLayer(s.layers, next) }));
    select(next.id);
  };

  /** Öğeyi siler; fotoğraf katmanında fotoğrafın kendisi de gider. */
  const remove = (id: string) => {
    const target = current.layers.find((l) => l.id === id);
    if (!target) return;
    if (target.kind === 'photo' && target.n >= 0) store.dropPhoto(editing, target.n);
    else if (target.kind === 'photo') store.change(editing, (s) => setReady(s, undefined));
    else store.setLayers(editing, (list) => removeLayer(list, id));
    if (id === selected) select(null);
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
    select(target.id);
    grab.current = { side: hitSide, layer: target, g, x, y, tag: `mug:${target.id}:${Date.now()}` };
    return true;
  };

  const dragOnMug = (u: number, v: number) => {
    const held = grab.current;
    if (!held) return;
    const { patch } = moveTo(held.layer, held.g, sheet, held.g.cx + u * sheet.width - held.x, held.g.cy + v * sheet.height - held.y);
    store.setLayers(held.side, (list) => updateLayer(list, held.layer.id, patch), held.tag);
  };

  /** Tasarımın o anki görüntüsü (indirme ve sipariş penceresi). */
  const makeShot = async (): Promise<Blob | null> => {
    const shot = model
      ? await view3d.current?.snapshot(SNAPSHOT_BACKGROUND, twoSided)
      : mug ? await preview.current?.snapshot(mug.field) : null;
    if (shot) return shot;
    const canvas = document.createElement('canvas');
    canvas.width = sheet.width * 2;
    canvas.height = sheet.height * 2;
    drawPrint(canvas, { ...render.content, base: boardColor });
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  };

  const download = async () => {
    setError('');
    const blob = await makeShot();
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
    select(null);
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

  const names = options.length ? options : mugColors;
  const swatches = names.map((name) => ({ name, hex: swatchColor(printModel, name) }));
  const price = `${formatPriceRange(getPriceMin(product), 0)}’den`;

  /** Açık panel: seçili öğenin aracı ya da menü sekmesi (masaüstünde bir sekme hep açıktır). */
  const shownTool = layer && tool ? tool : null;
  const shownTab: Tab | null = shownTool ? null : tab ?? (desktop ? 'duzen' : null);

  const tabPanel = shownTab === 'kupa' ? (
    <KupaPaneli
      colors={swatches} color={color} onColor={setColor} twoSided={twoSided}
      onSides={(two) => { setTwoSided(two); if (!two) selectSide('front'); }}
      ready={current.ready} onRemoveReady={() => store.change(editing, (s) => setReady(s, undefined))}
    />
  ) : shownTab === 'duzen' ? (
    <DuzenPaneli side={current} sources={render.sources} sheet={sheet} background={boardColor} onPick={pickTemplate} />
  ) : shownTab === 'yazi' ? (
    <YaziPaneli sheet={sheet} background={boardColor} onAdd={addText} />
  ) : shownTab === 'foto' ? (
    <FotoPaneli
      photos={current.photos} layers={current.layers} room={room} busy={adding} onFiles={addPhotos} onPick={pickPhoto}
      onRemove={(n) => { store.dropPhoto(editing, n); select(null); }}
      onCollage={(kind) => store.setLayers(editing, (list) => arrange(list, kind, sheet))}
    />
  ) : shownTab === 'sus' ? (
    <SusPaneli onPick={addShape} />
  ) : shownTab === 'desen' ? (
    <DesenPaneli
      sheet={sheet} background={boardColor} current={current.layers.find((l) => l.kind === 'pattern')} onPick={addPattern}
      onClear={() => { store.setLayers(editing, (list) => list.filter((l) => l.kind !== 'pattern')); select(null); }}
    />
  ) : shownTab === 'katman' ? (
    <KatmanListesi
      layers={current.layers} sources={render.sources} selected={selected} onSelect={select} onRemove={remove}
      onOrder={(id, step) => store.setLayers(editing, (list) => moveLayer(list, id, step))}
    />
  ) : null;

  const menu: MenuItem<Tab>[] = [
    { id: 'duzen', label: 'Düzenler', icon: <ITemplates /> },
    { id: 'yazi', label: 'Yazı', icon: <IText /> },
    { id: 'foto', label: 'Fotoğraf', icon: <IPhoto /> },
    { id: 'sus', label: 'Süsler', icon: <ISticker /> },
    { id: 'desen', label: 'Desen', icon: <IPattern /> },
    { id: 'kupa', label: 'Kupa', icon: <IMug /> },
  ];

  return (
    <div className={`std${layer ? ' has-selection' : ''}${shownTool || shownTab ? ' has-panel' : ''}`}>
      <UstCubuk back={lineHref(slug)} title={title} subtitle={price}>
        <button type="button" className="std-icon-btn" onClick={store.undo} disabled={!store.canUndo} aria-label="Geri al" title="Geri al"><IUndo /></button>
        <button type="button" className="std-icon-btn" onClick={store.redo} disabled={!store.canRedo} aria-label="Yinele" title="Yinele"><IRedo /></button>
        <button type="button" className="std-icon-btn" aria-pressed={shownTab === 'katman'} onClick={() => pickTab('katman')} aria-label="Katmanlar" title="Katmanlar"><ILayers /></button>
        <button type="button" className="std-icon-btn" onClick={download} disabled={!hasContent || loading} aria-label="Görseli indir" title="Görseli indir"><IDownload /></button>
        <button type="button" className="std-buy" onClick={() => { setError(''); select(null); setFinish(true); }} disabled={!hydrated}>
          <ICart size={20} /> <span>{lineKey ? 'Kaydet' : 'Sepete ekle'}</span>
        </button>
      </UstCubuk>

      <Menu items={menu} active={shownTab} onPick={pickTab} label="Tasarım araçları" />

      {(shownTool || shownTab) && (
        <Panel
          title={shownTool ? TOOL_TITLES[shownTool] : TAB_TITLES[shownTab!]}
          onBack={shownTool && desktop ? () => setTool(null) : undefined}
          onClose={shownTool ? () => setTool(null) : () => setTab(null)}
        >
          {shownTool && layer ? (
            <AracPaneli
              tool={shownTool} layer={layer} geometry={render.geometry.find((g) => g.id === layer.id)} sheet={sheet}
              sources={render.sources} background={boardColor} sharp={render.sharp.get(layer.id)} cutFailed={render.cutFailed}
              onChange={(patch, tag) => change(layer.id, patch, tag && `${tag}:${layer.id}`)}
              onOrder={(step) => store.setLayers(editing, (list) => moveLayer(list, layer.id, step))}
            />
          ) : tabPanel}
        </Panel>
      )}

      {layer ? (
        <AracCubugu
          layer={layer} tool={tool} onTool={(next) => { setTab(null); setTool((now) => (now === next ? null : next)); }}
          cutting={render.cutting}
          onToggleCut={() => layer.kind === 'photo' && change(layer.id, { cut: !layer.cut || undefined })}
          onDuplicate={() => {
            const copy = duplicateLayer(current.layers, layer.id);
            if (!copy.id) return;
            store.setLayers(editing, () => copy.layers);
            select(copy.id);
          }}
          onRemove={() => remove(layer.id)}
          onDone={() => select(null)}
        />
      ) : (
        <div className="std-context is-idle">
          <div className="std-quick" role="group" aria-label="Kupa rengi">
            {swatches.map((c) => (
              <button key={c.name} type="button" aria-pressed={same(c.name, color)} aria-label={c.name} title={c.name} onClick={() => setColor(c.name)}>
                <i style={{ background: c.hex }} />
              </button>
            ))}
          </div>
          {current.layers.length > 0 && (
            <button type="button" className="std-tool" onClick={() => { store.change(editing, () => emptySide()); select(null); }}><IClear /><span>Temizle</span></button>
          )}
          {twoSided && !isEmptySide(current) && (
            <button type="button" className="std-tool" onClick={() => { store.change(other, () => copySide(current, MAX_LINE_PHOTOS - current.photos.length)); selectSide(other); }}>
              <ICopy /><span>{SIDE_LABELS[other]}e kopyala</span>
            </button>
          )}
        </div>
      )}

      <div className="std-work">
        {twoSided && (
          <div className="std-sides" role="group" aria-label="Hazırladığınız yüz">
            {SIDES.map((id) => (
              <button key={id} type="button" aria-pressed={side === id} onClick={() => selectSide(id)} title={SIDE_HINTS[id]}>
                <MugGlyph face={id} size={30} /> {SIDE_LABELS[id]}
                <i className={isEmptySide(store.doc[id]) ? undefined : 'is-full'} role="img" aria-label={isEmptySide(store.doc[id]) ? 'boş' : 'hazır'} />
              </button>
            ))}
          </div>
        )}

        <div className={`std-mug${mug ? ' is-field' : ''}`} style={mug ? { ['--field' as string]: mug.field, ['--on-field' as string]: mug.onField } : undefined}>
          {model && colors3d ? (
            <Mug3D
              handle={view3d}
              compact
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
              ref={preview} mug={mug} text="" font="duz" photo={null}
              layers={render.content.layers} assets={render.content.assets} mirrored={editing === 'back'}
            />
          ) : colorImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="std-product" src={cartImageSrc(colorImage) ?? ''} alt={`${title}${color ? `, ${color}` : ''}`} />
          ) : null}
        </div>

        <div className="std-board" style={{ ['--ratio' as string]: String(sheet.width / sheet.height) }}>
          <Tahta
            sheet={sheet}
            background={boardColor}
            layers={current.layers}
            assets={render.assets}
            geometry={render.geometry}
            selected={selected}
            onSelect={select}
            onEdit={(id) => { if (current.layers.find((l) => l.id === id)?.kind === 'text') { setSelected(id); setTab(null); setTool('metin'); } }}
            onChange={change}
            onRemove={remove}
            label={sideName ? `${sideName} baskı alanı` : 'Baskı alanı'}
          />
        </div>

        <div className="std-toasts">
          {restored && (
            <p className="std-toast" role="status">
              Yarım kalan tasarımınız yüklendi.
              <button type="button" onClick={startOver}>Baştan başla</button>
              <button type="button" className="std-icon-btn" onClick={() => setRestored(false)} aria-label="Bildirimi kapat"><IClose size={18} /></button>
            </p>
          )}
          {error && !finish && (
            <p className="std-toast is-error" role="alert">
              {error}
              <button type="button" className="std-icon-btn" onClick={() => setError('')} aria-label="Bildirimi kapat"><IClose size={18} /></button>
            </p>
          )}
          {adding && <p className="std-toast" role="status">Fotoğraf ekleniyor…</p>}
          {render.cutting && <p className="std-toast" role="status">Arka plan siliniyor…</p>}
          {render.photoFailed && (
            <p className="std-toast is-error" role="status">Bir fotoğraf bu tarayıcıda gösterilemiyor. Siparişe eklenir, baskıda biz yerleştiririz.</p>
          )}
          {render.failed && !render.photoFailed && (
            <p className="std-toast is-error" role="alert">
              Bir yazı tipi ya da görsel yüklenemedi.
              <button type="button" onClick={render.retry}>Yeniden dene</button>
            </p>
          )}
          {current.slot && !current.photos.length && <p className="std-toast" role="status">Bu düzende fotoğraf yeri var: fotoğraf eklediğinizde oturur.</p>}
        </div>
      </div>

      {finish && (
        <Pencere title={lineKey ? 'Değişikliği kaydedin' : 'Sepete ekleyin'} onClose={() => setFinish(false)}>
          <form className="std-finish" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            <FinishShot make={makeShot} ready={!loading} />
            <p className="std-finish-price"><b>{title}</b> {color} · {price}</p>

            <div className="std-finish-row">
              <span>Adet</span>
              <div className="cart-qty" role="group" aria-label="Adet">
                <button type="button" onClick={() => setQty(clampQty(qty - 1))} disabled={qty <= 1} aria-label="Adedi azalt">−</button>
                <input type="text" inputMode="numeric" aria-label="Adet" value={qty} onChange={(e) => setQty(clampQty(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 1))} />
                <button type="button" onClick={() => setQty(clampQty(qty + 1))} disabled={qty >= MAX_QTY} aria-label="Adedi artır">+</button>
              </div>
            </div>

            <textarea className="std-input" rows={2} maxLength={NOTE_MAX} value={note} aria-label="Not (isteğe bağlı)" placeholder="Not (isteğe bağlı): teslim tarihi, özel isteğiniz…" onChange={(e) => setNote(e.target.value)} />

            <label className="std-check">
              <input type="checkbox" checked={needsDesign} onChange={(e) => setNeedsDesign(e.target.checked)} />
              Tasarımım yok, siz hazırlayın
            </label>

            {blurry && (
              <p className="std-warn" role="status">
                {twoSided ? `${SIDE_LABELS[blurry]}deki` : 'Tasarımdaki'} bir fotoğraf bulanık basılabilir. Küçültün ya da daha büyüğünü yükleyin.
              </p>
            )}
            {error && <p className="std-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block std-submit" disabled={saving || adding || loading || !hydrated}>
              <ICart size={20} /> {saving ? 'Ekleniyor…' : loading ? 'Tasarım hazırlanıyor…' : lineKey ? 'Değişikliği kaydet' : 'Sepete ekle'}
            </button>
          </form>
        </Pencere>
      )}
    </div>
  );
}
