'use client';

import { useEffect, useState } from 'react';

/** Başka alan adındaki bir görseli tuvale ve dokuya çizilebilir biçimde yükler. */
export function useImage(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setImage(img); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return image;
}
