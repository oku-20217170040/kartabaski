// Katmanı taşıma, büyütme ve döndürme kuralları (tahta, 3D kupa, klavye ve kaydırıcılar ortak).
import { Geometry, Sheet, fitInside, rotatedSize, EDGE } from './ciz';
import type { Layer } from './model';

/** Ortaya bu kadar yaklaşan merkez ortaya yapışır (genişliğe / yüksekliğe oran). */
export const SNAP = 0.018;
const ANGLE_SNAP = 4;

export const SIZE_RANGE = {
  text: { min: 0.04, max: 1.2 },
  shape: { min: 0.06, max: 1.2 },
  photo: { min: 0.15, max: 5 },
  pattern: { min: 0.1, max: 0.6 },
} as const;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(n * 10000) / 10000;

export const normalizeAngle = (deg: number) => ((((Math.round(deg) + 180) % 360) + 360) % 360) - 180;

export function snapAngle(deg: number): number {
  const near = Math.round(deg / 45) * 45;
  return normalizeAngle(Math.abs(deg - near) <= ANGLE_SNAP ? near : deg);
}

/**
 * Merkezi (piksel) istenen yere taşır: ortaya yapışır, yazı ve süs alandan çıkamaz.
 * `guides` hangi orta çizgiye yapışıldığını söyler.
 */
export function moveTo(layer: Layer, g: Geometry, sheet: Sheet, cx: number, cy: number, snap = true) {
  let x = cx / sheet.width;
  let y = cy / sheet.height;
  const guides = { x: false, y: false };
  if (snap && Math.abs(x - 0.5) < SNAP) { x = 0.5; guides.x = true; }
  if (snap && Math.abs(y - 0.5) < SNAP) { y = 0.5; guides.y = true; }
  if (layer.kind === 'text' || layer.kind === 'shape') {
    const at = fitInside(sheet, x, y, g.w, g.h, g.r);
    x = at.cx / sheet.width;
    y = at.cy / sheet.height;
  } else {
    x = clamp(x, 0, 1);
    y = clamp(y, 0, 1);
  }
  return { patch: { x: round(x), y: round(y) }, guides };
}

/** Yazı ve süsün alana sığabileceği en büyük `s`. */
export function maxSize(layer: Layer, g: Geometry | undefined, sheet: Sheet): number {
  const range = SIZE_RANGE[layer.kind];
  if (!g || (layer.kind !== 'text' && layer.kind !== 'shape')) return range.max;
  const outer = rotatedSize(g.w, g.h, g.r);
  const edge = sheet.height * EDGE * 2;
  const room = Math.min((sheet.width - edge) / outer.width, (sheet.height - edge) / outer.height);
  return clamp(layer.s * g.k * room, range.min, range.max);
}

/** Ekranda görünen boy (sığdırma uygulanmış). */
export const shownSize = (layer: Layer, g: Geometry | undefined) => layer.s * (g?.k ?? 1);

export function resize(layer: Layer, g: Geometry | undefined, sheet: Sheet, wanted: number): Partial<Layer> {
  const range = SIZE_RANGE[layer.kind];
  const s = round(clamp(wanted, range.min, maxSize(layer, g, sheet)));
  // Elle boyutlanan yazıda eski genişlik sınırı kalkar.
  return layer.kind === 'text' ? { s, mw: undefined } : { s };
}
