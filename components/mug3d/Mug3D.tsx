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
}

const Mug3D = forwardRef<Mug3DHandle, Mug3DProps>(function Mug3D(
  { model, colors, label, onUnsupported, text, font, photo, placement = DEFAULT_PLACEMENT, back, view: shown, onView },
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
    whenFontReady(font, text, () => {
      if (cancelled) return;
      drawPrint(scene.sheets.front, { text, font, photo, placement, base: colors.body });
      scene.printChanged('front');
    });
    return () => { cancelled = true; };
  }, [scene, text, font, photo, placement, colors.body]);

  const hasBack = Boolean(back);
  const backText = back?.text ?? '';
  const backFont = back?.font ?? 'duz';
  const backPhoto = back?.photo ?? null;
  const backPlacement = back?.placement ?? DEFAULT_PLACEMENT;
  useEffect(() => {
    if (!scene) return;
    scene.setBackVisible(hasBack);
    if (!hasBack) return;
    let cancelled = false;
    whenFontReady(backFont, backText, () => {
      if (cancelled) return;
      drawPrint(scene.sheets.back, { text: backText, font: backFont, photo: backPhoto, placement: backPlacement, base: colors.body });
      scene.printChanged('back');
    });
    return () => { cancelled = true; };
  }, [scene, hasBack, backText, backFont, backPhoto, backPlacement, colors.body]);

  useEffect(() => {
    if (!shown) return;
    setSpinning(false);
    scene?.show(VIEWS[shown]);
  }, [scene, shown]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSpinning(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
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
  const onPointerEnd = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); };

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
        {model.finish === 'magic' ? 'Soğukken siyah görünür; sıcak içecek koyunca baskı ortaya çıkar.' : 'Çevirmek için kupayı sürükleyin.'}
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
