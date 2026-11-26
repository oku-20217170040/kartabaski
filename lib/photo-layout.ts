/**
 * Kupa önizlemesinde müşterinin fotoğrafının yeri. Değerler baskı alanına oranlıdır,
 * böylece ekran boyutundan bağımsız kaydedilip yönetim panelinde okunabilir.
 */

export interface Placement {
  /** Merkezden kayma, baskı alanı genişliğine oran. */
  x: number;
  /** Merkezden kayma, baskı alanı yüksekliğine oran. */
  y: number;
  scale: number;
  /** Derece. */
  rotate: number;
}

export const DEFAULT_PLACEMENT: Placement = { x: 0, y: 0, scale: 1, rotate: 0 };

export const MIN_SCALE = 0.3;
export const MAX_SCALE = 3;
export const MAX_OFFSET = 0.6;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));

export function clampPlacement(p: Placement): Placement {
  const rotate = Number.isFinite(p.rotate) ? ((((p.rotate + 180) % 360) + 360) % 360) - 180 : 0;
  return {
    x: clamp(p.x, -MAX_OFFSET, MAX_OFFSET),
    y: clamp(p.y, -MAX_OFFSET, MAX_OFFSET),
    scale: clamp(p.scale || 1, MIN_SCALE, MAX_SCALE),
    rotate,
  };
}

/**
 * Fotoğrafın baskı alanındaki dikdörtgeni (merkez + boyut).
 * `textShare`: alt tarafta yazıya ayrılan oran; ölçek 1 iken fotoğraf kalan alana sığar.
 */
export function photoRect(
  sheet: { width: number; height: number },
  photo: { width: number; height: number },
  placement: Placement,
  textShare = 0,
) {
  const p = clampPlacement(placement);
  const boxW = sheet.width * 0.66;
  const boxH = sheet.height * (1 - textShare);
  const fit = Math.min(boxW / photo.width, boxH / photo.height) * p.scale;
  return {
    cx: sheet.width / 2 + p.x * sheet.width,
    cy: boxH / 2 + p.y * sheet.height,
    width: photo.width * fit,
    height: photo.height * fit,
    rotate: p.rotate,
  };
}
