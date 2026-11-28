'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PrintContent } from '@/lib/mug-print';
import { READY_PLACEMENT } from '@/lib/mug3d';
import { DEFAULT_PLACEMENT } from '@/lib/photo-layout';
import { removeBackground } from '@/lib/remove-background';
import { orderImageUrl } from '@/lib/siparis-types';
import type { lineSides } from '@/lib/siparis-types';
import { useImage } from '@/lib/use-image';
import { useReadyPrint } from '@/lib/use-ready-print';
import { cloudinaryUrl } from '@/lib/format';
import { useAssets } from '@/lib/tasarim/use-varliklar';

type Side = ReturnType<typeof lineSides>[number];

/**
 * Bir yüzün baskı içeriği: müşterinin ekranda gördüğü yazı, yerleşim ve fotoğraf
 * (istendiyse arka planı silinmiş) ya da seçtiği hazır desen.
 */
export function useSideContent(token: string, side: Side | null) {
  const layers = side?.layers;
  // Katmanlı tasarımda bütün fotoğraflar kendi katmanlarıyla çizilir.
  const designed = useAssets(layers, layers && side ? [
    ...side.files.map((id, n) => ({ n, key: id, url: orderImageUrl(token, id) })),
    ...(side.ready?.image ? [{ n: -1, key: `ready:${side.ready.image}`, url: cloudinaryUrl(side.ready.image, 'f_auto,q_auto,w_2400,c_limit'), trim: true }] : []),
  ] : []);
  const layered = useMemo<PrintContent>(
    () => ({ text: '', font: 'duz', photo: null, layers, assets: designed.assets }),
    [layers, designed.assets],
  );
  const file = layers ? undefined : side?.files[0];
  const original = useImage(file ? orderImageUrl(token, file) : null);
  const ready = useReadyPrint(side && !file && !layers ? side.ready?.image : null);
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

  if (layers) {
    return {
      content: layered,
      loading: designed.loading,
      cutFailed: designed.cutFailed,
      /** Eksik görsel ya da yazı tipiyle baskı dosyası indirilmesin. */
      failed: designed.failed,
      retry: designed.retry,
      hasContent: layers.length > 0,
    };
  }

  return {
    content,
    /** Görsel henüz inmedi ya da arka plan siliniyor. */
    loading: Boolean((file || side?.ready?.image) && !photo),
    cutFailed: failed,
    failed: false,
    retry: () => {},
    hasContent: Boolean(side && (file || side.text || side.ready?.image)),
  };
}

export type SideContent = ReturnType<typeof useSideContent>;
