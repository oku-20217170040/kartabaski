'use client';

import { useEffect, useState } from 'react';
import { cloudinaryUrl } from './format';
import { contentBounds } from './trim';
import { useImage } from './use-image';

/**
 * Hazır desenin kupaya sarılacak hali: görselin çevresindeki boş beyaz pay atılır.
 * Küçük resimlerden ayrı adres kullanılır, tarayıcı önbelleği karışmaz.
 */
export function useReadyPrint(publicId: string | null | undefined) {
  const source = useImage(publicId ? cloudinaryUrl(publicId, 'f_auto,q_auto,w_1000,c_limit') : null);
  const [trimmed, setTrimmed] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setTrimmed(null);
    if (!source) return;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { setTrimmed(source); return; }
    ctx.drawImage(source, 0, 0);
    const box = contentBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!box || (box.width === canvas.width && box.height === canvas.height)) { setTrimmed(source); return; }
    const out = document.createElement('canvas');
    out.width = box.width;
    out.height = box.height;
    out.getContext('2d')?.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    const img = new Image();
    img.onload = () => { if (!cancelled) setTrimmed(img); };
    img.src = out.toDataURL('image/png');
    return () => { cancelled = true; };
  }, [source]);

  return trimmed;
}
