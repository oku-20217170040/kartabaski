// Birden fazla fotoğrafı baskı alanına dizme.
import type { Layer, PhotoLayer } from './model';

export type Collage = 'yan-yana' | 'izgara' | 'buyuk';

export const COLLAGE_LABELS: Record<Collage, string> = { 'yan-yana': 'Yan yana', izgara: 'Izgara', buyuk: 'Biri büyük' };

/** Hücre: merkez, genişlik, yükseklik (alana oran). */
interface Cell { x: number; y: number; w: number; h: number }

const PAD = 0.012;

function cells(kind: Collage, n: number): Cell[] {
  const row = (count: number, top: number, height: number, left = 0, width = 1): Cell[] =>
    Array.from({ length: count }, (_, i) => ({ x: left + (width / count) * (i + 0.5), y: top + height / 2, w: width / count, h: height }));
  if (kind === 'buyuk' && n > 1) {
    const rest = n - 1;
    const cols = rest > 3 ? 2 : 1;
    const rows = Math.ceil(rest / cols);
    const small = Array.from({ length: rest }, (_, i) => {
      const inRow = i >= (rows - 1) * cols ? rest - (rows - 1) * cols : cols;
      const r = Math.floor(i / cols);
      return { x: 0.58 + (0.42 / inRow) * ((i % cols) + 0.5), y: (r + 0.5) / rows, w: 0.42 / inRow, h: 1 / rows };
    });
    return [{ x: 0.29, y: 0.5, w: 0.58, h: 1 }, ...small];
  }
  if (kind === 'izgara' && n > 2) {
    const top = Math.ceil(n / 2);
    return [...row(top, 0, 0.5), ...row(n - top, 0.5, 0.5)];
  }
  return row(n, 0, 1);
}

/** Fotoğraf katmanlarını hücrelere kırpıp yerleştirir; diğer katmanlar yerinde kalır. */
export function arrange(layers: Layer[], kind: Collage, sheet: { width: number; height: number }): Layer[] {
  const photos = layers.filter((l): l is PhotoLayer => l.kind === 'photo');
  if (photos.length < 2) return layers;
  const slots = cells(kind, photos.length);
  const next = new Map(photos.map((p, i) => {
    const c = slots[i];
    const w = (c.w - PAD) * sheet.width;
    const tall = (c.h - PAD * (sheet.width / sheet.height)) * sheet.height;
    const crop = Math.min(5, Math.max(0.2, w / tall));
    // Oran sınıra dayanırsa hücreden taşmaması için boy kısalır.
    const h = Math.min(tall, w / crop);
    // Sığdırma kutusu 0,66×genişlik, yükseklik tam; kırpılmış parça hücreyi dolduracak kat.
    const s = 1 / Math.min((sheet.width * 0.66) / (crop * h), sheet.height / h);
    const circle = p.shape === 'circle' || p.shape === 'heart' || p.shape === 'star' || p.shape === 'hexagon';
    return [p.id, {
      ...p, x: c.x, y: c.y, r: 0, box: undefined, s: Math.round(s * 1000) / 1000,
      crop: Math.round(crop * 1000) / 1000, shape: circle ? 'plain' : p.shape,
    } satisfies PhotoLayer];
  }));
  return layers.map((l) => next.get(l.id) ?? l);
}
