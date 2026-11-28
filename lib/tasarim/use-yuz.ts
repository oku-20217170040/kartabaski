'use client';

import { useMemo, useState } from 'react';
import { cloudinaryUrl } from '../format';
import type { MugModel } from '../mug3d';
import type { PrintContent } from '../mug-print';
import { Side } from './belge';
import { Geometry, Sheet, cropRect, layerGeometry } from './ciz';
import { shapeAspect } from './foto';
import { Sharpness, dpiOf, printWidthMm, sharpness } from './netlik';
import { useAssets } from './use-varliklar';
import type { PhotoSource } from './varliklar';

export function sourcesOf(side: Side): PhotoSource[] {
  return [
    ...side.photos.map((p, n) => ({ n, key: p.uid, url: p.url })),
    ...(side.ready?.image
      ? [{ n: -1, key: `ready:${side.ready.image}`, url: cloudinaryUrl(side.ready.image, 'f_auto,q_auto,w_1000,c_limit'), trim: true }]
      : []),
  ];
}

/** Bir yüzün çizim içeriği, öğe yerleri ve fotoğraf netlikleri. */
export function useSide(side: Side, sheet: Sheet, model: MugModel) {
  const sources = sourcesOf(side);
  const { assets, version, loading, cutting, cutFailed, failed, photoFailed, retry } = useAssets(side.layers, sources);
  const [measure] = useState(() => (typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')));

  const geometry: Geometry[] = useMemo(
    () => (measure ? layerGeometry(measure, side.layers, sheet, assets) : []),
    [measure, side.layers, sheet, assets],
  );

  const content: PrintContent = useMemo(
    () => ({ text: '', font: 'duz', photo: null, layers: side.layers, assets }),
    [side.layers, assets],
  );

  const sharp = useMemo(() => {
    const out = new Map<string, Sharpness>();
    for (const l of side.layers) {
      if (l.kind !== 'photo' || l.n < 0) continue;
      const img = assets.photo(l);
      const g = geometry.find((x) => x.id === l.id);
      if (!img || !g) continue;
      const { sw } = cropRect(img.width, img.height, l.crop ?? shapeAspect(l.shape));
      out.set(l.id, sharpness(dpiOf(sw, g.w / sheet.width, printWidthMm(model))));
    }
    return out;
  }, [side.layers, assets, geometry, sheet, model]);

  return { sources, assets, version, loading, cutting, cutFailed, failed, photoFailed, retry, geometry, content, sharp };
}
