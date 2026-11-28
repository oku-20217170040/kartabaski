'use client';

import { useEffect, useRef, useState } from 'react';
import { drawPrint } from '@/lib/mug-print';
import type { Assets } from '@/lib/tasarim/ciz';
import type { Layer } from '@/lib/tasarim/model';
import type { PhotoSource } from '@/lib/tasarim/varliklar';

interface Props {
  layers: Layer[];
  assets: Assets;
  width: number;
  height: number;
  /** Verilmezse zemin saydam kalır. */
  background?: string;
}

/** Katmanların küçük resmi: panellerde yazı yerine sonucun kendisi gösterilir. */
export default function Kucuk({ layers, assets, width, height, background }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPrint(ref.current, { text: '', font: 'duz', photo: null, layers, assets, base: background });
  }, [layers, assets, width, height, background]);
  return <canvas ref={ref} width={width} height={height} aria-hidden="true" />;
}

const small = new Map<string, string>();

/** Küçük resimler her seferinde büyük fotoğrafla çalışmasın diye fotoğrafların küçültülmüş kopyaları. */
export function useThumbSources(sources: PhotoSource[]): PhotoSource[] {
  const [, setDone] = useState(0);

  useEffect(() => {
    let alive = true;
    for (const s of sources) {
      if (small.has(s.key)) continue;
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const k = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          small.set(s.key, canvas.toDataURL('image/png'));
        } catch {
          small.set(s.key, s.url);
        }
        if (alive) setDone((n) => n + 1);
      };
      img.src = s.url;
    }
    return () => { alive = false; };
  });

  return sources.flatMap((s) => {
    const url = small.get(s.key);
    return url ? [{ ...s, key: `kucuk:${s.key}`, url }] : [];
  });
}
