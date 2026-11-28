'use client';

import { useEffect, useRef, useState } from 'react';
import { drawPrint } from '@/lib/mug-print';
import { Assets, Geometry, Sheet, hitLayer } from '@/lib/tasarim/ciz';
import { moveTo, normalizeAngle, resize, shownSize, snapAngle } from '@/lib/tasarim/hareket';
import type { Layer } from '@/lib/tasarim/model';

interface Props {
  sheet: Sheet;
  /** Kupa gövdesinin rengi. */
  background: string;
  layers: Layer[];
  assets: Assets;
  geometry: Geometry[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** `tag`: arka arkaya gelen aynı hareket geri almada tek adım olsun. */
  onChange: (id: string, patch: Partial<Layer>, tag: string) => void;
  onRemove: (id: string) => void;
  /** Çift tıklanan öğe (yazıyı değiştirmek için). */
  onEdit?: (id: string) => void;
  label: string;
}

interface Gesture {
  mode: 'move' | 'size' | 'turn' | 'pinch';
  id: string;
  layer: Layer;
  g: Geometry;
  /** Başlangıç noktası (tuval pikseli) ya da iki parmak ölçüsü. */
  x: number;
  y: number;
  distance: number;
  angle: number;
  tag: string;
}

/** Parmakla küçük katman tutulabilsin diye en az yarım dokunma alanı (ekran pikseli). */
const TOUCH_SLACK = 22;

/** Baskı alanının düz görünümü: katmanlar burada tutulup taşınır, büyütülür ve döndürülür. */
export default function Tahta({ sheet, background, layers, assets, geometry, selected, onSelect, onChange, onRemove, onEdit, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState({ x: false, y: false });
  const current = geometry.find((g) => g.id === selected);
  const layer = layers.find((l) => l.id === selected);

  useEffect(() => {
    if (canvas.current) drawPrint(canvas.current, { text: '', font: 'duz', photo: null, layers, assets, base: background });
  }, [layers, assets, background, sheet.width, sheet.height]);

  /** Ekran noktasını tuval pikseline çevirir. */
  const toSheet = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    const ratio = r.width ? sheet.width / r.width : 1;
    return { x: (clientX - r.left) * ratio, y: (clientY - r.top) * ratio, ratio };
  };

  // Katman tutulduğunda sayfa kaymasın; boş yere dokunulunca kaydırma serbest.
  const latest = useRef({ geometry, toSheet });
  latest.current = { geometry, toSheet };
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const guard = (e: TouchEvent) => {
      const touch = e.touches[0];
      const onHandle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle;
      // Sil düğmesi engellenirse dokunuş tıklamaya dönüşmez.
      if (onHandle === 'remove') return;
      const p = latest.current.toSheet(touch.clientX, touch.clientY);
      if (onHandle || e.touches.length > 1 || hitLayer(latest.current.geometry, p.x, p.y, TOUCH_SLACK * p.ratio)) e.preventDefault();
    };
    node.addEventListener('touchstart', guard, { passive: false });
    return () => node.removeEventListener('touchstart', guard);
  }, []);

  const begin = (mode: Gesture['mode'], target: Layer, g: Geometry, x: number, y: number, distance = 0, angle = 0) => {
    gesture.current = { mode, id: target.id, layer: target, g, x, y, distance, angle, tag: `${mode}:${target.id}:${Date.now()}` };
  };

  const pair = () => {
    const [a, b] = Array.from(pointers.current.values());
    return { distance: Math.hypot(b.x - a.x, b.y - a.y), angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle as 'size' | 'turn' | 'remove' | undefined;
    if (handle === 'remove') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toSheet(e.clientX, e.clientY);

    if (pointers.current.size === 2 && current && layer) {
      const { distance, angle } = pair();
      begin('pinch', layer, current, 0, 0, distance, angle);
      return;
    }
    if (handle && current && layer) {
      e.preventDefault();
      begin(handle, layer, current, p.x, p.y,
        Math.hypot(p.x - current.cx, p.y - current.cy),
        (Math.atan2(p.y - current.cy, p.x - current.cx) * 180) / Math.PI);
      return;
    }
    // Seçili katmanın üstündeyse o tutulur (üstünü başka katman örtse de).
    const slack = TOUCH_SLACK * p.ratio;
    const hit = (current && hitLayer([current], p.x, p.y) ? current : null) ?? hitLayer(geometry, p.x, p.y, slack);
    const found = hit && layers.find((l) => l.id === hit.id);
    onSelect(found ? found.id : null);
    if (hit && found) begin('move', found, hit, p.x, p.y);
    else gesture.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = gesture.current;
    if (!s) return;
    const p = toSheet(e.clientX, e.clientY);

    if (s.mode === 'move') {
      const moved = moveTo(s.layer, s.g, sheet, s.g.cx + p.x - s.x, s.g.cy + p.y - s.y);
      setGuides(moved.guides);
      onChange(s.id, moved.patch, s.tag);
    } else if (s.mode === 'size') {
      const factor = Math.hypot(p.x - s.g.cx, p.y - s.g.cy) / (s.distance || 1);
      onChange(s.id, resize(s.layer, s.g, sheet, shownSize(s.layer, s.g) * factor), s.tag);
    } else if (s.mode === 'turn') {
      const angle = (Math.atan2(p.y - s.g.cy, p.x - s.g.cx) * 180) / Math.PI;
      onChange(s.id, { r: snapAngle(s.layer.r + angle - s.angle) }, s.tag);
    } else if (pointers.current.size > 1) {
      const now = pair();
      const turned = normalizeAngle(now.angle - s.angle);
      onChange(s.id, {
        ...resize(s.layer, s.g, sheet, shownSize(s.layer, s.g) * (now.distance / (s.distance || 1))),
        // Küçük titreme döndürme sayılmaz.
        r: Math.abs(turned) > 6 ? snapAngle(s.layer.r + turned) : s.layer.r,
      }, s.tag);
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    // İki parmaktan biri kalkınca kalan parmak katmanı sıçratmasın.
    gesture.current = null;
    setGuides({ x: false, y: false });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!layer || !current) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const nudge = (dx: number, dy: number) =>
      onChange(layer.id, moveTo(layer, current, sheet, current.cx + dx * sheet.width, current.cy + dy * sheet.height, false).patch, `key-move:${layer.id}`);
    const actions: Record<string, () => void> = {
      ArrowLeft: () => nudge(-step, 0),
      ArrowRight: () => nudge(step, 0),
      ArrowUp: () => nudge(0, -step),
      ArrowDown: () => nudge(0, step),
      '+': () => onChange(layer.id, resize(layer, current, sheet, shownSize(layer, current) * 1.1), `key-size:${layer.id}`),
      '-': () => onChange(layer.id, resize(layer, current, sheet, shownSize(layer, current) / 1.1), `key-size:${layer.id}`),
      '[': () => onChange(layer.id, { r: normalizeAngle(layer.r - 5) }, `key-turn:${layer.id}`),
      ']': () => onChange(layer.id, { r: normalizeAngle(layer.r + 5) }, `key-turn:${layer.id}`),
      Delete: () => onRemove(layer.id),
      Backspace: () => onRemove(layer.id),
      Escape: () => onSelect(null),
    };
    if (!actions[e.key]) return;
    e.preventDefault();
    actions[e.key]();
  };

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;

  return (
    <div
      ref={box}
      className="tst"
      role="application"
      tabIndex={0}
      aria-label={`${label}. Bir öğeyi seçmek için dokunun; ok tuşlarıyla taşıyın, artı ve eksiyle boyutlandırın, köşeli parantezlerle döndürün.`}
      style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={(e) => {
        const p = toSheet(e.clientX, e.clientY);
        const hit = hitLayer(geometry, p.x, p.y);
        if (hit) onEdit?.(hit.id);
      }}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvas} width={sheet.width} height={sheet.height} aria-hidden="true" />
      {guides.x && <span className="tst-guide is-v" aria-hidden="true" />}
      {guides.y && <span className="tst-guide is-h" aria-hidden="true" />}
      {current && (
        <div
          className="tst-frame"
          style={{
            left: pct(current.cx - current.w / 2, sheet.width),
            top: pct(current.cy - current.h / 2, sheet.height),
            width: pct(current.w, sheet.width),
            height: pct(current.h, sheet.height),
            transform: `rotate(${current.r}deg)`,
          }}
        >
          <span className="tst-handle is-turn" data-handle="turn" aria-hidden="true"><i>↻</i></span>
          <span className="tst-handle is-size" data-handle="size" aria-hidden="true"><i>⤡</i></span>
          <button type="button" className="tst-handle is-remove" data-handle="remove" aria-label="Seçili öğeyi sil" onClick={() => onRemove(current.id)}><i>×</i></button>
        </div>
      )}
      {!layers.length && <p className="tst-empty">Tasarımınız burada</p>}
    </div>
  );
}
