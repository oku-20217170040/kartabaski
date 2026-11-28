// Katmanların ölçülmesi ve çizilmesi. Ekran, 3D kupa, sepet görseli ve yönetim baskı dosyası
// aynı işlevleri kullanır. Yazı tipi, fotoğraf ve süs görselleri `Assets` üzerinden gelir.
import type { Layer, PatternLayer, PhotoLayer, ShapeLayer, TextLayer } from './model';
import { MAX_TEXT_LINES } from './model';
import { shapeAspect, shapePath } from './foto';

export type Drawable = CanvasImageSource & { width: number; height: number };
export interface FontSpec { family: string; weight: number; style: 'normal' | 'italic' }

export interface Assets {
  /** Yazı tipi inmediyse tarayıcı yedek tiple çizer; inince sahibi yeniden çizdirir. */
  font: (l: { font: string; bold?: boolean; italic?: boolean }) => FontSpec;
  /** Kesimi ve renk ayarı uygulanmış fotoğraf; hazır değilse null. */
  photo: (l: PhotoLayer) => Drawable | null;
  shape: (l: { set: 'ph' | 'fl'; name: string; color: string }) => Drawable | null;
}

export interface Sheet { width: number; height: number }

/** Bir katmanın baskı alanındaki yeri (piksel). `r` derece. */
export interface Geometry {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  r: number;
  /** Alana sığmadığı için uygulanan küçültme (1: istenen boy). */
  k: number;
}

interface Measured extends Geometry { draw: (ctx: CanvasRenderingContext2D) => void }

/** Yazı ve süs baskı alanının kenarından en az bu kadar içeride kalır (yüksekliğe oran). */
export const EDGE = 0.015;
const LINE_GAP = 1.12;
const MAX_ARC = Math.PI * 1.25;

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (n: number, min: number, max: number) => (min > max ? (min + max) / 2 : Math.min(max, Math.max(min, n)));

/** Döndürülmüş kutunun eksenlere paralel ölçüsü. */
export function rotatedSize(w: number, h: number, deg: number) {
  const c = Math.abs(Math.cos(rad(deg)));
  const s = Math.abs(Math.sin(rad(deg)));
  return { width: w * c + h * s, height: w * s + h * c };
}

/** Kutu alana sığacak biçimde küçültülür ve içeri çekilir. */
export function fitInside(sheet: Sheet, x: number, y: number, w: number, h: number, r: number) {
  const edge = sheet.height * EDGE;
  const outer = rotatedSize(w, h, r);
  const k = Math.min(1, (sheet.width - edge * 2) / (outer.width || 1), (sheet.height - edge * 2) / (outer.height || 1));
  const halfW = (outer.width * k) / 2;
  const halfH = (outer.height * k) / 2;
  return {
    k,
    cx: clamp(x * sheet.width, halfW + edge, sheet.width - halfW - edge),
    cy: clamp(y * sheet.height, halfH + edge, sheet.height - halfH - edge),
  };
}

const cssFont = (f: FontSpec, size: number) => `${f.style === 'italic' ? 'italic ' : ''}${f.weight} ${size}px ${f.family}`;

function metrics(ctx: CanvasRenderingContext2D, text: string, size: number) {
  const m = ctx.measureText(text);
  const left = m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  return {
    advance: m.width,
    // El yazısı tiplerinde harf kuyruğu ilerleme genişliğinin dışına taşar.
    width: Number.isFinite(left) && Number.isFinite(right) ? Math.max(m.width, Math.abs(left) + Math.abs(right)) : m.width,
    ascent: Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : size * 0.8,
    descent: Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : size * 0.2,
  };
}

/** Ölçüm bu harf boyunda yapılır, sonuç istenen boya oranlanır (her çözünürlükte aynı yerleşim). */
const REF = 200;

interface Glyph { text: string; x: number; y: number; angle: number }
interface TextBlock { w: number; h: number; glyphs: Glyph[] }

function straightBlock(ctx: CanvasRenderingContext2D, lines: string[]): TextBlock {
  const measured = lines.map((l) => metrics(ctx, l || ' ', REF));
  const gap = REF * LINE_GAP;
  let top = Infinity;
  let bottom = -Infinity;
  measured.forEach((m, i) => {
    top = Math.min(top, i * gap - m.ascent);
    bottom = Math.max(bottom, i * gap + m.descent);
  });
  const middle = (top + bottom) / 2;
  return {
    w: Math.max(...measured.map((m) => m.width)),
    h: bottom - top,
    glyphs: lines.map((text, i) => ({ text, x: 0, y: i * gap - middle, angle: 0 })),
  };
}

/** Yay üzerinde yazı: harfler tek tek, teğet açısıyla yerleştirilir. */
function arcBlock(ctx: CanvasRenderingContext2D, text: string, curve: number): TextBlock {
  const chars = Array.from(text);
  const total = metrics(ctx, text, REF).advance || 1;
  const sweep = (Math.abs(curve) / 100) * MAX_ARC;
  const radius = total / sweep;
  const up = curve > 0;
  let before = '';
  let start = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const glyphs = chars.map((c) => {
    before += c;
    const end = ctx.measureText(before).width;
    const m = metrics(ctx, c, REF);
    const along = (start + end) / 2 - total / 2;
    const a = along / radius;
    const x = radius * Math.sin(a);
    const y = (up ? 1 : -1) * radius * (1 - Math.cos(a));
    const angle = up ? a : -a;
    const half = Math.max(end - start, m.width) / 2;
    for (const [dx, dy] of [[-half, -m.ascent], [half, -m.ascent], [-half, m.descent], [half, m.descent]]) {
      const px = x + dx * Math.cos(angle) - dy * Math.sin(angle);
      const py = y + dx * Math.sin(angle) + dy * Math.cos(angle);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    start = end;
    return { text: c, x, y, angle };
  });
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  return { w: maxX - minX, h: maxY - minY, glyphs: glyphs.map((g) => ({ ...g, x: g.x - mx, y: g.y - my })) };
}

export const textLines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, MAX_TEXT_LINES);

function measureText(ctx: CanvasRenderingContext2D, l: TextLayer, sheet: Sheet, assets: Assets): Measured | null {
  const lines = textLines(l.text);
  if (!lines.length) return null;
  const spec = assets.font(l);
  ctx.save();
  ctx.font = cssFont(spec, REF);
  const block = l.curve ? arcBlock(ctx, lines.join(' '), l.curve) : straightBlock(ctx, lines);
  ctx.restore();

  const fx = l.fx && l.fx !== 'none' ? l.fx : undefined;
  const pad = fx ? REF * 0.09 : 0;
  let scale = (l.s * sheet.height) / REF;
  if (l.mw && block.w * scale > l.mw * sheet.width) scale = (l.mw * sheet.width) / block.w;
  const w = (block.w + pad * 2) * scale;
  const h = (block.h + pad * 2) * scale;
  const at = fitInside(sheet, l.x, l.y, w, h, l.r);
  const size = REF * scale * at.k;
  const k = scale * at.k;

  return {
    id: l.id,
    cx: at.cx,
    cy: at.cy,
    w: w * at.k,
    h: h * at.k,
    r: l.r,
    k: at.k,
    draw: (c) => {
      c.font = cssFont(spec, size);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      const paint = (g: Glyph, stroke: boolean, shift: number) => {
        c.save();
        c.translate(g.x * k + shift, g.y * k + shift);
        c.rotate(g.angle);
        if (stroke) c.strokeText(g.text, 0, 0); else c.fillText(g.text, 0, 0);
        c.restore();
      };
      // Önce bütün harflerin efekti, sonra yazı: yaydaki harfler birbirinin üstünü örtmesin.
      if (fx === 'outline') {
        c.strokeStyle = l.fxColor ?? '#F2B200';
        c.lineWidth = size * 0.13;
        block.glyphs.forEach((g) => paint(g, true, 0));
      } else if (fx === 'shadow') {
        c.fillStyle = l.fxColor ?? '#B9B9B3';
        block.glyphs.forEach((g) => paint(g, false, size * 0.06));
      }
      c.fillStyle = l.color;
      block.glyphs.forEach((g) => paint(g, false, 0));
    },
  };
}

function measureShape(l: ShapeLayer, sheet: Sheet, assets: Assets): Measured {
  const side = l.s * sheet.height;
  const at = fitInside(sheet, l.x, l.y, side, side, l.r);
  const size = side * at.k;
  return {
    id: l.id, cx: at.cx, cy: at.cy, w: size, h: size, r: l.r, k: at.k,
    draw: (c) => {
      const img = assets.shape(l);
      if (img) c.drawImage(img, -size / 2, -size / 2, size, size);
    },
  };
}

/** Kaynak fotoğraftan alınacak orta parça (kırpma oranı verilmişse). */
export function cropRect(width: number, height: number, ratio?: number) {
  if (!ratio) return { sx: 0, sy: 0, sw: width, sh: height };
  const sw = Math.min(width, height * ratio);
  const sh = sw / ratio;
  return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh };
}

function drawSoft(c: CanvasRenderingContext2D, img: Drawable, src: ReturnType<typeof cropRect>, w: number, h: number) {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(w));
  layer.height = Math.max(1, Math.round(h));
  const ctx = layer.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, layer.width, layer.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(layer.width / 2, layer.height / 2);
  ctx.scale(layer.width / 2, layer.height / 2);
  const fade = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(-1, -1, 2, 2);
  c.drawImage(layer, -w / 2, -h / 2, w, h);
}

function measurePhoto(l: PhotoLayer, sheet: Sheet, assets: Assets): Measured | null {
  const img = assets.photo(l);
  if (!img || !img.width || !img.height) return null;
  const src = cropRect(img.width, img.height, l.crop ?? shapeAspect(l.shape));
  const fit = Math.min((sheet.width * 0.66) / src.sw, (sheet.height * (l.box ?? 1)) / src.sh) * l.s;
  const w = src.sw * fit;
  const h = src.sh * fit;
  return {
    id: l.id,
    // Fotoğraf kenardan taşabilir (kırpılır) ama merkezi alanın içinde kalır.
    cx: clamp(l.x * sheet.width, 0, sheet.width),
    cy: clamp(l.y * sheet.height, 0, sheet.height),
    w,
    h,
    r: l.r,
    k: 1,
    draw: (c) => {
      if (l.shape === 'soft') drawSoft(c, img, src, w, h);
      else {
        c.save();
        if (l.shape !== 'plain') { shapePath(c, l.shape, w, h); c.clip(); }
        c.drawImage(img, src.sx, src.sy, src.sw, src.sh, -w / 2, -h / 2, w, h);
        c.restore();
      }
      if (l.border && l.shape !== 'soft') {
        shapePath(c, l.shape, w, h);
        c.strokeStyle = l.border;
        c.lineWidth = sheet.height * 0.022;
        c.lineJoin = 'round';
        c.stroke();
      }
    },
  };
}

function drawPattern(ctx: CanvasRenderingContext2D, l: PatternLayer, sheet: Sheet, assets: Assets) {
  const tile = l.s * sheet.height;
  const text = l.text?.trim();
  const img = !text && l.set && l.name ? assets.shape({ set: l.set, name: l.name, color: l.color }) : null;
  if (!text && !img) return;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  const spec = assets.font(l);
  let itemWidth = tile * 0.62;
  if (text) {
    ctx.font = cssFont(spec, tile * 0.46);
    itemWidth = ctx.measureText(text).width;
    ctx.fillStyle = l.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  const stepX = itemWidth + tile * 0.4;
  const stepY = tile * 0.82;
  const reach = Math.hypot(sheet.width, sheet.height) / 2;
  ctx.translate(sheet.width / 2, sheet.height / 2);
  ctx.rotate(rad(l.r));
  const rows = Math.ceil(reach / stepY) + 1;
  const cols = Math.ceil(reach / stepX) + 1;
  for (let row = -rows; row <= rows; row += 1) {
    const shift = row % 2 ? stepX / 2 : 0;
    for (let col = -cols; col <= cols; col += 1) {
      const x = col * stepX + shift;
      const y = row * stepY;
      if (text) ctx.fillText(text, x, y);
      else if (img) ctx.drawImage(img, x - itemWidth / 2, y - itemWidth / 2, itemWidth, itemWidth);
    }
  }
  ctx.restore();
}

function measure(ctx: CanvasRenderingContext2D, l: Layer, sheet: Sheet, assets: Assets): Measured | null {
  if (l.kind === 'text') return measureText(ctx, l, sheet, assets);
  if (l.kind === 'shape') return measureShape(l, sheet, assets);
  if (l.kind === 'photo') return measurePhoto(l, sheet, assets);
  return null;
}

/** Taşınabilir katmanların yerleri (alttan üste). Desen tüm alanı kapladığı için listede yoktur. */
export function layerGeometry(ctx: CanvasRenderingContext2D, layers: Layer[], sheet: Sheet, assets: Assets): Geometry[] {
  return layers.flatMap((l) => {
    const m = measure(ctx, l, sheet, assets);
    return m ? [{ id: m.id, cx: m.cx, cy: m.cy, w: m.w, h: m.h, r: m.r, k: m.k }] : [];
  });
}

export function renderLayers(ctx: CanvasRenderingContext2D, layers: Layer[], sheet: Sheet, assets: Assets) {
  for (const l of layers) {
    if (l.kind === 'pattern') { drawPattern(ctx, l, sheet, assets); continue; }
    const m = measure(ctx, l, sheet, assets);
    if (!m) continue;
    ctx.save();
    ctx.translate(m.cx, m.cy);
    ctx.rotate(rad(m.r));
    m.draw(ctx);
    ctx.restore();
  }
}

/** Noktadaki en üstteki katman; küçük katman parmakla tutulabilsin diye kutu `slack` kadar genişletilir. */
export function hitLayer(geometry: Geometry[], x: number, y: number, slack = 0): Geometry | null {
  for (let i = geometry.length - 1; i >= 0; i -= 1) {
    const g = geometry[i];
    const a = -rad(g.r);
    const dx = (x - g.cx) * Math.cos(a) - (y - g.cy) * Math.sin(a);
    const dy = (x - g.cx) * Math.sin(a) + (y - g.cy) * Math.cos(a);
    if (Math.abs(dx) <= Math.max(g.w / 2, slack) && Math.abs(dy) <= Math.max(g.h / 2, slack)) return g;
  }
  return null;
}
