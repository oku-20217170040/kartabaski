'use client';

import { useEffect, useRef } from 'react';
import type { MugModel } from '@/lib/mug3d';
import { printSize } from '@/lib/mug3d';
import { PrintContent, drawPrint, whenFontReady } from '@/lib/mug-print';
import { DEFAULT_PLACEMENT, Placement } from '@/lib/photo-layout';
import { usePlacementDrag } from '@/lib/use-placement-drag';
import './mug3d.css';

interface Props extends PrintContent {
  model: MugModel;
  background: string;
  /** Verilmezse fotoğraf sürüklenemez (hazır desen). */
  onPlacementChange?: (next: Placement) => void;
  /** İki yüzlü baskıda düzenlenen yüzün adı. */
  side?: string;
}

/** Baskı alanının düz görünümü: fotoğraf burada sürüklenir (kupa üstünde sürükleme döndürür). */
export default function PrintStrip({ model, background, text, font, photo, placement = DEFAULT_PLACEMENT, onPlacementChange, side }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = printSize(model, 900);
  const draggable = Boolean(photo && onPlacementChange);

  useEffect(() => {
    let cancelled = false;
    whenFontReady(font, text, () => {
      if (cancelled || !ref.current) return;
      drawPrint(ref.current, { text, font, photo, placement, base: background });
    });
    return () => { cancelled = true; };
  }, [background, text, font, photo, placement]);

  const drag = usePlacementDrag(placement, onPlacementChange, (dx, dy) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect?.width ? { x: dx / rect.width, y: dy / rect.height } : { x: 0, y: 0 };
  });

  return (
    <div className="strip">
      <canvas
        ref={ref}
        width={size.width}
        height={size.height}
        className={draggable ? 'is-draggable' : undefined}
        role={draggable ? 'application' : 'img'}
        aria-label={draggable
          ? 'Baskı alanı. Fotoğrafı sürükleyerek taşıyın; ok tuşları, artı ve eksi de kullanılabilir.'
          : 'Baskı alanının düz görünümü'}
        tabIndex={draggable ? 0 : -1}
        {...(draggable ? drag : {})}
      />
      <p>
        {draggable
          ? `${side ? `${side} baskı alanı` : 'Baskı alanı'}: fotoğrafı burada sürükleyin.`
          : `${side ? `${side} baskı alanının` : 'Baskı alanının'} düz görünümü`}
      </p>
    </div>
  );
}
