'use client';

import { useEffect, useState } from 'react';
import type { PrintContent } from '@/lib/mug-print';
import { READY_PLACEMENT } from '@/lib/mug3d';
import { DEFAULT_PLACEMENT } from '@/lib/photo-layout';
import { removeBackground } from '@/lib/remove-background';
import { orderImageUrl } from '@/lib/siparis-types';
import type { lineSides } from '@/lib/siparis-types';
import { useImage } from '@/lib/use-image';
import { useReadyPrint } from '@/lib/use-ready-print';

type Side = ReturnType<typeof lineSides>[number];

/**
 * Bir yüzün baskı içeriği: müşterinin ekranda gördüğü yazı, yerleşim ve fotoğraf
 * (istendiyse arka planı silinmiş) ya da seçtiği hazır desen.
 */
export function useSideContent(token: string, side: Side | null) {
  const file = side?.files[0];
  const original = useImage(file ? orderImageUrl(token, file) : null);
  const ready = useReadyPrint(side && !file ? side.ready?.image : null);
  const [cutout, setCutout] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const wantsCut = Boolean(side?.removeBg);

  useEffect(() => {
    setCutout(null);
    setFailed(false);
    if (!original || !wantsCut) return;
    let alive = true;
    removeBackground(original)
      .then((img) => { if (alive) setCutout(img); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [original, wantsCut]);

  const photo = ready ?? (wantsCut && !failed ? cutout : original);
  const content: PrintContent = {
    text: side?.text ?? '',
    font: side?.font ?? 'duz',
    photo,
    placement: ready ? READY_PLACEMENT : side?.placement ?? DEFAULT_PLACEMENT,
  };

  return {
    content,
    /** Görsel henüz inmedi ya da arka plan siliniyor. */
    loading: Boolean((file || side?.ready?.image) && !photo),
    cutFailed: failed,
    hasContent: Boolean(side && (file || side.text || side.ready?.image)),
  };
}

export type SideContent = ReturnType<typeof useSideContent>;
