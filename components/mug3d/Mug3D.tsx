'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { MugColors, MugModel } from '@/lib/mug3d';
import { PrintContent, drawPrint, whenFontReady } from '@/lib/mug-print';
import { DEFAULT_PLACEMENT } from '@/lib/photo-layout';
import { SideId } from '@/lib/design-sides';
import { MugScene, VIEWS, createMugScene } from './scene';

export interface Mug3DHandle {
  snapshot: (background: string, twoSided?: boolean) => Promise<Blob | null>;
}

export interface Mug3DProps extends PrintContent {
  model: MugModel;
  colors: MugColors;
  label: string;
  /** Arka yüz baskısı (iki yüzlü üründe). */
  back?: PrintContent;
  /** Değişince kupa bu yüzü döner. */
  view?: SideId;
  /** "Ön" / "Arka" düğmesine basılınca. */
  onView?: (side: SideId) => void;
  /** Üç boyut açılamazsa (eski cihaz) çağrılır; üst bileşen düz önizlemeye döner. */
  onUnsupported?: () => void;
  /**
   * Kupadaki baskıya dokunulunca sorulur (u, v: baskı alanında 0–1). `true` dönerse
   * sürükleme kupayı çevirmez, `onDrag` ile öğe taşınır.
   */
  onGrab?: (side: SideId, u: number, v: number) => boolean;
  /** Seçim yapmadan "burada tutulacak bir öğe var mı" sorusu (dokunmatikte kaydırmayı durdurmak için). */
  canGrab?: (side: SideId, u: number, v: number) => boolean;
  onDrag?: (u: number, v: number) => void;
  onDrop?: () => void;
}

const Mug3D = forwardRef<Mug3DHandle, Mug3DProps>(function Mug3D(
  { model, colors, label, onUnsupported, text, font, photo, placement = DEFAULT_PLACEMENT, layers, assets, back, view: shown, onView, onGrab, canGrab, onDrag, onDrop },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<MugScene | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [cold, setCold] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const unsupported = useRef(onUnsupported);
  unsupported.current = onUnsupported;

  useEffect(() => {
    if (!host.current) return;
    let made: MugScene;
    try {
      made = createMugScene(host.current, model);
    } catch {
      unsupported.current?.();
      return;
    }
    setScene(made);
    return () => { made.dispose(); setScene(null); };
  }, [model]);

  useImperativeHandle(ref, () => ({ snapshot: (bg, two) => scene?.snapshot(bg, two) ?? Promise.resolve(null) }), [scene]);

  useEffect(() => { scene?.setColors(colors); }, [scene, colors]);
  useEffect(() => { scene?.setCold(cold); }, [scene, cold]);
  useEffect(() => { setCold(false); }, [model]);

  useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      drawPrint(scene.sheets.front, { text, font, photo, placement, layers, assets, base: colors.body });
      scene.printChanged('front');
    };
    // Katmanlı tasarımda yazı tipleri `assets` ile gelir.
    if (layers) paint(); else whenFontReady(font, text, paint);
    return () => { cancelled = true; };
  }, [scene, text, font, photo, placement, layers, assets, colors.body]);

  const hasBack = Boolean(back);
  const backText = back?.text ?? '';
  const backFont = back?.font ?? 'duz';
  const backPhoto = back?.photo ?? null;
  const backPlacement = back?.placement ?? DEFAULT_PLACEMENT;
  const backLayers = back?.layers;
  const backAssets = back?.assets;
  useEffect(() => {
    if (!scene) return;
    scene.setBackVisible(hasBack);
    if (!hasBack) return;
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      drawPrint(scene.sheets.back, {
        text: backText, font: backFont, photo: backPhoto, placement: backPlacement, layers: backLayers, assets: backAssets, base: colors.body,
      });
      scene.printChanged('back');
    };
    if (backLayers) paint(); else whenFontReady(backFont, backText, paint);
    return () => { cancelled = true; };
  }, [scene, hasBack, backText, backFont, backPhoto, backPlacement, backLayers, backAssets, colors.body]);

  // Baskıdaki bir öğe tutulursa dokunma sayfayı kaydırmasın.
  const grabbing = useRef<{ pointer: number; side: SideId } | null>(null);
  const grabbable = useRef(canGrab);
  grabbable.current = canGrab;
  useEffect(() => {
    const node = host.current;
    if (!node || !scene) return;
    const guard = (e: TouchEvent) => {
      const hit = grabbable.current && e.touches.length === 1 ? scene.pick(e.touches[0].clientX, e.touches[0].clientY) : null;
      if (hit && grabbable.current?.(hit.side, hit.u, hit.v)) e.preventDefault();
    };
    node.addEventListener('touchstart', guard, { passive: false });
    return () => node.removeEventListener('touchstart', guard);
  }, [scene]);

  useEffect(() => {
    if (!shown) return;
    setSpinning(false);
    scene?.show(VIEWS[shown]);
  }, [scene, shown]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSpinning(false);
    if (onGrab && scene && !pointers.current.size) {
      const hit = scene.pick(e.clientX, e.clientY);
      if (hit && onGrab(hit.side, hit.u, hit.v)) {
        scene.setSpinning(false);
        grabbing.current = { pointer: e.pointerId, side: hit.side };
        return;
      }
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const held = grabbing.current;
    if (held) {
      const hit = held.pointer === e.pointerId ? scene?.pick(e.clientX, e.clientY) : null;
      if (hit && hit.side === held.side) onDrag?.(hit.u, hit.v);
      return;
    }
    const before = pointers.current.get(e.pointerId);
    if (!before || !scene) return;
    const others = Array.from(pointers.current.entries()).filter(([id]) => id !== e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (others.length) {
      // İki parmak: aralarındaki mesafe yakınlaştırır.
      const [, o] = others[0];
      const was = Math.hypot(before.x - o.x, before.y - o.y);
      if (was) scene.zoomBy(Math.hypot(e.clientX - o.x, e.clientY - o.y) / was);
      return;
    }
    // Dokunmatikte dikey hareket sayfayı kaydırır; eğim yalnız fareyle.
    scene.turnBy((e.clientX - before.x) * 0.012, e.pointerType === 'mouse' ? (e.clientY - before.y) * 0.006 : 0);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    if (grabbing.current?.pointer === e.pointerId) { grabbing.current = null; onDrop?.(); }
    pointers.current.delete(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => scene?.turnBy(-0.25, 0),
      ArrowRight: () => scene?.turnBy(0.25, 0),
      ArrowUp: () => scene?.turnBy(0, 0.1),
      ArrowDown: () => scene?.turnBy(0, -0.1),
      '+': () => scene?.zoomBy(1.15),
      '-': () => scene?.zoomBy(1 / 1.15),
    };
    if (!actions[e.key]) return;
    e.preventDefault();
    setSpinning(false);
    actions[e.key]();
  };

  const view = (v: keyof typeof VIEWS) => {
    setSpinning(false);
    scene?.show(VIEWS[v]);
    if (v !== 'handle') onView?.(v);
  };

  return (
    <div className="m3d">
      <div
        ref={host}
        className="m3d-stage"
        role="application"
        tabIndex={0}
        aria-label={`${label}. Döndürmek için sürükleyin ya da ok tuşlarını kullanın.`}
        data-ready={scene ? 'true' : 'false'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      />
      <p className="m3d-hint">
        {model.finish === 'magic' ? 'Soğukken siyah görünür; sıcak içecek koyunca baskı ortaya çıkar.' : onGrab ? 'Yazıyı ya da süsü kupanın üstünde sürükleyin; boş yerden tutup kupayı çevirin.' : 'Çevirmek için kupayı sürükleyin.'}
      </p>
      <div className="m3d-buttons" role="group" aria-label="Kupa görünümü">
        <button type="button" onClick={() => view('front')}>Ön</button>
        <button type="button" onClick={() => view('back')}>Arka</button>
        <button type="button" onClick={() => view('handle')}>Kulp</button>
        <button type="button" aria-pressed={spinning} onClick={() => { scene?.setSpinning(!spinning); setSpinning(!spinning); }}>Döndür</button>
        <button type="button" aria-label="Uzaklaştır" onClick={() => scene?.zoomBy(1 / 1.2)}>−</button>
        <button type="button" aria-label="Yakınlaştır" onClick={() => scene?.zoomBy(1.2)}>+</button>
        {model.finish === 'magic' && (
          <button type="button" className="m3d-magic" aria-pressed={cold} onClick={() => setCold(!cold)}>Soğuk hali</button>
        )}
      </div>
    </div>
  );
});

export default Mug3D;
