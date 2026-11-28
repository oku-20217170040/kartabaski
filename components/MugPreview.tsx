'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { VitrinMug } from '@/lib/vitrin';
import { Placement, DEFAULT_PLACEMENT } from '@/lib/photo-layout';
import { PrintFont, drawPrint, whenFontReady } from '@/lib/mug-print';
import { usePlacementDrag } from '@/lib/use-placement-drag';
import type { Assets } from '@/lib/tasarim/ciz';
import { Layer, layersText } from '@/lib/tasarim/model';

export { toLines } from '@/lib/mug-print';
export type { PrintFont } from '@/lib/mug-print';

interface Props {
  mug: VitrinMug;
  text: string;
  font: PrintFont;
  photo: HTMLImageElement | null;
  placement?: Placement;
  /** Verilirse fotoğraf kupanın üstünde sürüklenip iki parmakla büyütülebilir. */
  onPlacementChange?: (next: Placement) => void;
  /** Arka yüz: kupa fotoğrafı aynalanır (kulp solda), baskı düz kalır. */
  mirrored?: boolean;
  /** Tasarım ekranının katmanları (verilirse yazı ve fotoğraf yerine). */
  layers?: Layer[];
  assets?: Assets;
}

export interface MugPreviewHandle {
  /** Ekrandaki kupayı (zemin rengiyle) JPEG olarak verir. */
  snapshot: (background: string) => Promise<Blob | null>;
}

/** Baskı yüzeyi kupanın ön yüzünde bu açıya kadar (radyan) sarılır. */
const WRAP_ANGLE = 1.05;
const CANVAS_SCALE = 2;

function sheetSize(mug: VitrinMug) {
  const radius = ((mug.bodyRight - mug.bodyLeft) * mug.width * CANVAS_SCALE) / 2;
  return {
    radius,
    width: Math.round(radius * WRAP_ANGLE * 2),
    height: Math.round((mug.printBottom - mug.printTop) * mug.height * CANVAS_SCALE),
  };
}

/** Gerçek kupa fotoğrafı; üstüne yazılan yazı ve eklenen fotoğraf silindire sarılarak basılır. */
const MugPreview = forwardRef<MugPreviewHandle, Props>(function MugPreview(
  { mug, text, font, photo, placement = DEFAULT_PLACEMENT, onPlacementChange, mirrored, layers, assets },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
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
      const centerX = (mirrored ? 1 - mug.bodyRight : mug.bodyLeft) * W + radius;
      const top = mug.printTop * H;
      const sheet = document.createElement('canvas');
      sheet.width = sheetW;
      sheet.height = sheetH;
      drawPrint(sheet, { text, font, photo, placement, layers, assets });
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

    if (layers) paint(); else whenFontReady(font, text, paint);
    return () => { cancelled = true; };
  }, [mug, text, font, photo, placement, mirrored, layers, assets]);

  /** Ekran pikselini baskı alanı oranına çevirir. */
  const drag = usePlacementDrag(placement, onPlacementChange, (dx, dy) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return { x: 0, y: 0 };
    const ratio = (mug.width * CANVAS_SCALE) / rect.width;
    const { width, height } = sheetSize(mug);
    return { x: (dx * ratio) / width, y: (dy * ratio) / height };
  });

  const written = layers ? layersText(layers) : text.trim();
  const label = written
    ? `${mug.color} kulplu kupa, üzerinde "${written}" yazıyor`
    : `${mug.color} kulplu kupa`;

  return (
    <div className={`mug mug-swap${mirrored ? ' is-mirrored' : ''}`} key={mug.file}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={`/vitrin/${mug.file}.webp`} alt={label} width={mug.width} height={mug.height} fetchPriority="high" />
      <canvas ref={canvasRef} aria-hidden="true" />
      {draggable && (
        <div
          className="mug-drag"
          style={{
            top: `${mug.printTop * 100}%`,
            height: `${(mug.printBottom - mug.printTop) * 100}%`,
            left: `${(mirrored ? 1 - mug.bodyRight : mug.bodyLeft) * 100}%`,
            width: `${(mug.bodyRight - mug.bodyLeft) * 100}%`,
          }}
          role="application"
          aria-label="Fotoğrafı sürükleyerek taşıyın. Ok tuşlarıyla taşıyabilir, artı ve eksi ile boyutlandırabilirsiniz."
          tabIndex={0}
          {...drag}
        />
      )}
    </div>
  );
});

export default MugPreview;
