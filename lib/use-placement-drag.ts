'use client';

import { useRef } from 'react';
import { Placement, clampPlacement } from './photo-layout';

const KEY_STEP = 0.02;

/**
 * Fotoğrafı sürükleyerek taşıma, iki parmakla büyütme ve klavye ile ayar.
 * `toSheet` ekran pikselindeki hareketi baskı alanı oranına çevirir.
 */
export function usePlacementDrag(
  placement: Placement,
  onChange: ((next: Placement) => void) | undefined,
  toSheet: (dx: number, dy: number) => { x: number; y: number },
) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: Placement; x: number; y: number; distance: number } | null>(null);
  const latest = useRef(placement);
  latest.current = placement;

  const measure = () => {
    const points = Array.from(pointers.current.values());
    return {
      count: points.length,
      x: points.reduce((s, p) => s + p.x, 0) / (points.length || 1),
      y: points.reduce((s, p) => s + p.y, 0) / (points.length || 1),
      distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
    };
  };

  const restart = () => {
    const m = measure();
    gesture.current = m.count ? { start: latest.current, x: m.x, y: m.y, distance: m.distance } : null;
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    restart();
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restart();
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g || !pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const m = measure();
      const move = toSheet(m.x - g.x, m.y - g.y);
      const zoom = m.count > 1 && g.distance ? m.distance / g.distance : 1;
      onChange?.(clampPlacement({ ...g.start, x: g.start.x + move.x, y: g.start.y + move.y, scale: g.start.scale * zoom }));
    },
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onKeyDown: (e: React.KeyboardEvent) => {
      const p = latest.current;
      const next: Record<string, Placement> = {
        ArrowLeft: { ...p, x: p.x - KEY_STEP },
        ArrowRight: { ...p, x: p.x + KEY_STEP },
        ArrowUp: { ...p, y: p.y - KEY_STEP },
        ArrowDown: { ...p, y: p.y + KEY_STEP },
        '+': { ...p, scale: p.scale * 1.1 },
        '-': { ...p, scale: p.scale / 1.1 },
      };
      if (!next[e.key]) return;
      e.preventDefault();
      onChange?.(clampPlacement(next[e.key]));
    },
  };
}
