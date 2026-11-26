'use client';

import { useEffect, useRef } from 'react';
import type { VitrinMug } from '@/lib/vitrin';

export type PrintFont = 'duz' | 'el';

interface Props {
  mug: VitrinMug;
  text: string;
  font: PrintFont;
  photo: HTMLImageElement | null;
}

const FONTS: Record<PrintFont, { family: string; weight: number }> = {
  duz: { family: "'Archivo Variable', sans-serif", weight: 820 },
  el: { family: "'Shantell Sans Variable', cursive", weight: 700 },
};

/** Baskı yüzeyi kupanın ön yüzünde bu açıya kadar (radyan) sarılır. */
const WRAP_ANGLE = 1.05;

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

/** Yazı ve fotoğrafı düz bir baskı kâğıdına çizer. */
function drawSheet(width: number, height: number, lines: string[], font: PrintFont, photo: HTMLImageElement | null) {
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;

  const textShare = !lines.length ? 0 : photo ? 0.32 : 1;

  if (photo) {
    const boxW = width * 0.66;
    const boxH = height * (1 - textShare);
    const scale = Math.min(boxW / photo.naturalWidth, boxH / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    ctx.drawImage(photo, (width - w) / 2, (boxH - h) / 2, w, h);
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

/** Gerçek kupa fotoğrafı; üstüne yazılan yazı silindire sarılarak basılır. */
export default function MugPreview({ mug, text, font, photo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    const paint = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (cancelled || !canvas || !ctx) return;

      const scale = 2;
      const W = mug.width * scale;
      const H = mug.height * scale;
      canvas.width = W;
      canvas.height = H;

      const radius = ((mug.bodyRight - mug.bodyLeft) * W) / 2;
      const centerX = mug.bodyLeft * W + radius;
      const top = mug.printTop * H;
      const sheetH = Math.round((mug.printBottom - mug.printTop) * H);
      const sheetW = Math.round(radius * WRAP_ANGLE * 2);
      const sheet = drawSheet(sheetW, sheetH, toLines(text), font, photo);
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
    // Yazı tipi inmeden çizilirse tarayıcı yedek tiple basar.
    document.fonts.load(`${weight} 48px ${family}`, text || 'a').then(paint, paint);
    return () => { cancelled = true; };
  }, [mug, text, font, photo]);

  const label = text.trim()
    ? `${mug.color} kulplu kupa, üzerinde "${text.trim()}" yazıyor`
    : `${mug.color} kulplu kupa`;

  return (
    <div className="mug mug-swap" key={mug.file} role="img" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/vitrin/${mug.file}.webp`} alt="" width={mug.width} height={mug.height} fetchPriority="high" />
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
