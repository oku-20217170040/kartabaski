// Fotoğraf katmanının kesim şekilleri ve renk ayarları.
import type { PhotoFilter, PhotoShape } from './model';

/** Merkezi (0,0) olan w×h kutusuna kesim yolunu çizer. */
export function shapePath(ctx: CanvasRenderingContext2D, shape: PhotoShape, w: number, h: number) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    const radius = Math.min(w, h) * 0.14;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  } else if (shape === 'heart') {
    const px = (u: number) => x + u * w;
    const py = (v: number) => y + v * h;
    ctx.moveTo(px(0.5), py(0.22));
    ctx.bezierCurveTo(px(0.62), py(-0.04), px(1), py(0), px(1), py(0.32));
    ctx.bezierCurveTo(px(1), py(0.58), px(0.72), py(0.76), px(0.5), py(1));
    ctx.bezierCurveTo(px(0.28), py(0.76), px(0), py(0.58), px(0), py(0.32));
    ctx.bezierCurveTo(px(0), py(0), px(0.38), py(-0.04), px(0.5), py(0.22));
  } else if (shape === 'star' || shape === 'hexagon') {
    const points = shape === 'star' ? 10 : 6;
    for (let i = 0; i < points; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / points;
      const reach = shape === 'star' && i % 2 ? 0.52 : 1;
      // Yıldızın alt boşluğu dengelensin diye merkez biraz aşağıdadır.
      const cy = shape === 'star' ? h * 0.05 : 0;
      const px = Math.cos(angle) * (w / 2) * reach * (shape === 'star' ? 1.05 : 1);
      const py = Math.sin(angle) * (h / 2) * reach * (shape === 'star' ? 1.05 : 1) + cy;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
}

/** Kesim şekli kare isteyenler. */
export const shapeAspect = (shape: PhotoShape): number | undefined =>
  shape === 'circle' || shape === 'heart' || shape === 'star' ? 1 : shape === 'hexagon' ? 0.9 : undefined;

const clamp = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);

/** RGBA dizisini yerinde dönüştürür; saydamlık korunur. (Safari `ctx.filter` desteklemez.) */
export function filterPixels(data: Uint8ClampedArray, filter: PhotoFilter) {
  if (filter === 'none') return data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const grey = 0.299 * r + 0.587 * g + 0.114 * b;
    let nr = r;
    let ng = g;
    let nb = b;
    if (filter === 'bw') {
      nr = ng = nb = (grey - 128) * 1.12 + 128;
    } else if (filter === 'sepia') {
      nr = grey * 1.07 + 22;
      ng = grey * 0.92 + 12;
      nb = grey * 0.72 + 2;
    } else if (filter === 'vivid') {
      const boost = (c: number) => (grey + (c - grey) * 1.35 - 128) * 1.1 + 128;
      nr = boost(r);
      ng = boost(g);
      nb = boost(b);
    } else if (filter === 'warm') {
      nr = r * 1.09 + 8;
      ng = g * 1.02 + 2;
      nb = b * 0.9;
    } else if (filter === 'cool') {
      nr = r * 0.91;
      ng = g * 1.01 + 2;
      nb = b * 1.09 + 8;
    } else if (filter === 'fade') {
      const soft = (c: number) => (grey + (c - grey) * 0.75) * 0.82 + 42;
      nr = soft(r);
      ng = soft(g);
      nb = soft(b);
    }
    data[i] = clamp(nr);
    data[i + 1] = clamp(ng);
    data[i + 2] = clamp(nb);
  }
  return data;
}

export const SHAPE_LABELS: Record<PhotoShape, string> = {
  plain: 'Düz', rounded: 'Yuvarlak köşe', circle: 'Daire', heart: 'Kalp', star: 'Yıldız', hexagon: 'Altıgen', soft: 'Yumuşak kenar',
};
export const FILTER_LABELS: Record<PhotoFilter, string> = {
  none: 'Renkli', bw: 'Siyah beyaz', sepia: 'Sepya', vivid: 'Canlı', warm: 'Sıcak', cool: 'Serin', fade: 'Soluk',
};
