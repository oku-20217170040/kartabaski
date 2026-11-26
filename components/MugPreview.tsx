'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VitrinMug } from '@/lib/vitrin';
import { Placement, DEFAULT_PLACEMENT, clampPlacement, photoRect } from '@/lib/photo-layout';

export type PrintFont = 'duz' | 'el';

interface Props {
  mug: VitrinMug;
  text: string;
  font: PrintFont;
  photo: HTMLImageElement | null;
  placement?: Placement;
  /** Verilirse fotoğraf kupanın üstünde sürüklenip iki parmakla büyütülebilir. */
  onPlacementChange?: (next: Placement) => void;
}

export interface MugPreviewHandle {
  /** Ekrandaki kupayı (zemin rengiyle) JPEG olarak verir. */
  snapshot: (background: string) => Promise<Blob | null>;
}

const FONTS: Record<PrintFont, { family: string; weight: number }> = {
  duz: { family: "'Archivo Variable', sans-serif", weight: 820 },
  el: { family: "'Shantell Sans Variable', cursive", weight: 700 },
};

/** Baskı yüzeyi kupanın ön yüzünde bu açıya kadar (radyan) sarılır. */
const WRAP_ANGLE = 1.05;
const CANVAS_SCALE = 2;
const KEY_STEP = 0.02;

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

function sheetSize(mug: VitrinMug) {
  const radius = ((mug.bodyRight - mug.bodyLeft) * mug.width * CANVAS_SCALE) / 2;
  return {
    radius,
    width: Math.round(radius * WRAP_ANGLE * 2),
    height: Math.round((mug.printBottom - mug.printTop) * mug.height * CANVAS_SCALE),
  };
}

/** Yazı ve fotoğrafı düz bir baskı kâğıdına çizer. */
function drawSheet(
  width: number,
  height: number,
  lines: string[],
  font: PrintFont,
  photo: HTMLImageElement | null,
  placement: Placement,
) {
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;

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
    const { family, weight } = FONTS[font];
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

  return sheet;
}

/** Gerçek kupa fotoğrafı; üstüne yazılan yazı ve eklenen fotoğraf silindire sarılarak basılır. */
const MugPreview = forwardRef<MugPreviewHandle, Props>(function MugPreview(
  { mug, text, font, photo, placement = DEFAULT_PLACEMENT, onPlacementChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: Placement; x: number; y: number; distance: number } | null>(null);
  const latest = useRef(placement);
  latest.current = placement;

  const draggable = Boolean(photo && onPlacementChange);

  useImperativeHandle(ref, () => ({
    snapshot: async (background: string) => {
      const img = imgRef.current;
      const overlay = canvasRef.current;
      if (!img || !overlay) return null;
      await img.decode().catch(() => {});
      const pad = Math.round(overlay.width * 0.06);
      const out = document.createElement('canvas');
      out.width = overlay.width + pad * 2;
      out.height = overlay.height + pad * 2;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, pad, pad, overlay.width, overlay.height);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(overlay, pad, pad);
      return new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9));
    },
  }), []);

  useEffect(() => {
    let cancelled = false;

    const paint = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (cancelled || !canvas || !ctx) return;

      const W = mug.width * CANVAS_SCALE;
      const H = mug.height * CANVAS_SCALE;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      const { radius, width: sheetW, height: sheetH } = sheetSize(mug);
      const centerX = mug.bodyLeft * W + radius;
      const top = mug.printTop * H;
      const sheet = drawSheet(sheetW, sheetH, toLines(text), font, photo, placement);
      /* Fotoğraf hafif yukarıdan çekildiği için yatay çizgiler ortada aşağı sarkar. */
      const sag = mug.sag * H;
      const half = Math.round(radius * Math.sin(WRAP_ANGLE));

      for (let dx = -half; dx < half; dx += 1) {
        const angle = Math.asin(dx / radius);
        const cos = Math.cos(angle);
        const sourceWidth = 1 / cos;
        const sourceX = sheetW / 2 + radius * angle;
        ctx.globalAlpha = 0.72 + 0.28 * cos;
        ctx.drawImage(sheet, sourceX, 0, sourceWidth, sheetH, centerX + dx, top + sag * (cos - 1), 1, sheetH);
      }
    };

    const { family, weight } = FONTS[font];
    const spec = `${weight} 48px ${family}`;
    // Yazı tipi inmeden çizilirse tarayıcı yedek tiple basar. İnmişse sürüklerken beklemeden çiz.
    if (document.fonts.check(spec, text || 'a')) paint();
    else document.fonts.load(spec, text || 'a').then(paint, paint);
    return () => { cancelled = true; };
  }, [mug, text, font, photo, placement]);

  /** Ekran pikselini baskı alanı oranına çevirir. */
  const toSheet = (dx: number, dy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return { x: 0, y: 0 };
    const ratio = (mug.width * CANVAS_SCALE) / rect.width;
    const { width, height } = sheetSize(mug);
    return { x: (dx * ratio) / width, y: (dy * ratio) / height };
  };

  const startGesture = () => {
    const points = Array.from(pointers.current.values());
    if (!points.length) { gesture.current = null; return; }
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    gesture.current = { start: latest.current, x, y, distance };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = Array.from(pointers.current.values());
    const g = gesture.current;
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    const move = toSheet(x - g.x, y - g.y);
    const zoom = points.length > 1 && g.distance
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / g.distance
      : 1;
    onPlacementChange?.(clampPlacement({
      ...g.start,
      x: g.start.x + move.x,
      y: g.start.y + move.y,
      scale: g.start.scale * zoom,
    }));
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    startGesture();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
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
    onPlacementChange?.(clampPlacement(next[e.key]));
  };

  const label = text.trim()
    ? `${mug.color} kulplu kupa, üzerinde "${text.trim()}" yazıyor`
    : `${mug.color} kulplu kupa`;

  return (
    <div className="mug mug-swap" key={mug.file}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={`/vitrin/${mug.file}.webp`} alt={label} width={mug.width} height={mug.height} fetchPriority="high" />
      <canvas ref={canvasRef} aria-hidden="true" />
      {draggable && (
        <div
          className="mug-drag"
          style={{
            top: `${mug.printTop * 100}%`,
            height: `${(mug.printBottom - mug.printTop) * 100}%`,
            left: `${mug.bodyLeft * 100}%`,
            width: `${(mug.bodyRight - mug.bodyLeft) * 100}%`,
          }}
          role="application"
          aria-label="Fotoğrafı sürükleyerek taşıyın. Ok tuşlarıyla taşıyabilir, artı ve eksi ile boyutlandırabilirsiniz."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
});

export default MugPreview;
