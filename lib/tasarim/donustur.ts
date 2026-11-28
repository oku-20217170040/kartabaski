// Katman sisteminden önce kaydedilen tasarımı (tek yazı + tek fotoğraf) katmanlara çevirir.
import type { DesignSide } from '../cart-types';
import { toLines } from '../mug-print';
import { DEFAULT_PLACEMENT, clampPlacement } from '../photo-layout';
import { READY_PLACEMENT } from '../mug3d';
import { DEFAULT_INK, Layer, photoLayer, textLayer } from './model';

export function layersFromLegacy(d: Pick<DesignSide, 'text' | 'font' | 'placement' | 'removeBg' | 'ready' | 'photos'>): Layer[] {
  const lines = toLines(d.text ?? '');
  const share = lines.length ? 0.32 : 0;
  const layers: Layer[] = [];
  const hasPhoto = d.photos.length > 0;
  if (hasPhoto || d.ready?.image) {
    const p = hasPhoto ? clampPlacement(d.placement ?? DEFAULT_PLACEMENT) : READY_PLACEMENT;
    const box = 1 - share;
    layers.push(photoLayer(hasPhoto ? 0 : -1, {
      x: 0.5 + p.x, y: box / 2 + p.y, s: p.scale, r: p.rotate,
      ...(box < 1 ? { box } : {}),
      ...(hasPhoto && d.removeBg ? { cut: true } : {}),
    }));
  }
  if (lines.length) {
    const textShare = layers.length ? 0.32 : 1;
    layers.push(textLayer({
      text: lines.join('\n'),
      font: d.font ?? 'duz',
      color: DEFAULT_INK,
      x: 0.5,
      y: 1 - textShare / 2,
      s: Math.min(0.25, textShare / (lines.length * 1.1)),
      mw: 0.7,
    }));
  }
  return layers;
}
