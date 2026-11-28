/**
 * Kupaya basılacak düz şablon: yazı ve fotoğraf tek bir tuvale çizilir.
 * Hem düz fotoğraf önizlemesi hem üç boyutlu kupa aynı şablonu sarar.
 */
import type { Layer } from './tasarim/model';
import { Assets, renderLayers } from './tasarim/ciz';
import { DEFAULT_PLACEMENT, Placement, photoRect } from './photo-layout';

export type PrintFont = 'duz' | 'el';

export const PRINT_FONTS: Record<PrintFont, { family: string; weight: number }> = {
  duz: { family: "'Archivo Variable', sans-serif", weight: 820 },
  el: { family: "'Shantell Sans Variable', cursive", weight: 700 },
};

/** Metni en fazla 3 satıra, en uzun satır olabildiğince kısa olacak şekilde böler. */
export function toLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const length = words.join(' ').length;
  const count = Math.min(words.length, length <= 11 ? 1 : length <= 24 ? 2 : 3);

  let best: string[] = [];
  let bestLongest = Infinity;
  const split = (from: number, left: number, lines: string[]) => {
    if (left === 1) {
      const candidate = [...lines, words.slice(from).join(' ')];
      const longest = Math.max(...candidate.map((l) => l.length));
      if (longest < bestLongest) { best = candidate; bestLongest = longest; }
      return;
    }
    for (let to = from + 1; to <= words.length - left + 1; to += 1) {
      split(to, left - 1, [...lines, words.slice(from, to).join(' ')]);
    }
  };
  split(0, count, []);
  return best;
}

export interface PrintContent {
  text: string;
  font: PrintFont;
  photo: HTMLImageElement | null;
  placement?: Placement;
  /** Kupa rengi verilirse zemin boyanır ve baskı üstüne çoğaltılır (beyaz mürekkep yoktur). */
  base?: string;
  /** Tasarım ekranının katmanları; verilirse yazı, tip, fotoğraf ve yerleşim yerine bunlar çizilir. */
  layers?: Layer[];
  assets?: Assets;
}

const scratches = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** Hedef tuval başına bir kez açılan ara tuval; her çizimde temizlenir. */
function scratch(target: HTMLCanvasElement, width: number, height: number) {
  let canvas = scratches.get(target);
  if (!canvas) { canvas = document.createElement('canvas'); scratches.set(target, canvas); }
  // Boyut ataması tuvali ve çizim ayarlarını sıfırlar.
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** Şablonu verilen tuvale çizer (`base` yoksa zemin saydam kalır). */
export function drawPrint(canvas: HTMLCanvasElement, { text, font, photo, placement = DEFAULT_PLACEMENT, base, layers, assets }: PrintContent) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width, height } = canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (base) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'multiply';
  }

  if (layers && assets) {
    // Katmanlar önce kendi aralarında (üstteki alttakini örterek) birleşir, sonra kupa rengine basılır.
    const sheet = base ? scratch(canvas, width, height) : null;
    if (sheet) {
      renderLayers(sheet.ctx, layers, { width, height }, assets);
      ctx.drawImage(sheet.canvas, 0, 0);
    } else renderLayers(ctx, layers, { width, height }, assets);
    ctx.restore();
    return canvas;
  }

  const lines = toLines(text);
  const textShare = !lines.length ? 0 : photo ? 0.32 : 1;

  if (photo) {
    const r = photoRect({ width, height }, { width: photo.naturalWidth, height: photo.naturalHeight }, placement, lines.length ? textShare : 0);
    ctx.save();
    ctx.translate(r.cx, r.cy);
    ctx.rotate((r.rotate * Math.PI) / 180);
    ctx.drawImage(photo, -r.width / 2, -r.height / 2, r.width, r.height);
    ctx.restore();
  }

  if (lines.length) {
    const { family, weight } = PRINT_FONTS[font];
    const boxTop = height * (1 - textShare);
    const boxH = height * textShare;
    const maxWidth = width * 0.7;
    let size = Math.min(height * 0.25, boxH / (lines.length * 1.1));
    ctx.font = `${weight} ${size}px ${family}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > maxWidth) size *= maxWidth / widest;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = '#17171A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gap = size * 1.08;
    const first = boxTop + boxH / 2 - ((lines.length - 1) * gap) / 2;
    lines.forEach((l, i) => ctx.fillText(l, width / 2, first + i * gap));
  }

  ctx.restore();
  return canvas;
}

/** Yazı tipi inmeden çizilirse tarayıcı yedek tiple basar; inince `paint` çalışır. */
export function whenFontReady(font: PrintFont, text: string, paint: () => void) {
  const { family, weight } = PRINT_FONTS[font];
  const spec = `${weight} 48px ${family}`;
  if (document.fonts.check(spec, text || 'a')) paint();
  else document.fonts.load(spec, text || 'a').then(paint, paint);
}
