'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Layer } from './model';
import { AssetStore, PhotoSource } from './varliklar';

/**
 * Bir yüzün katmanları için çizim varlıkları. `assets` her yeni görsel hazır olduğunda
 * yeni nesne döner; tuvaller buna bakarak yeniden çizer.
 */
export function useAssets(layers: Layer[] | undefined, sources: PhotoSource[]) {
  const [version, setVersion] = useState(0);
  const alive = useRef(true);
  const [store] = useState(() => new AssetStore(() => { if (alive.current) setVersion((v) => v + 1); }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const sourceKey = sources.map((s) => `${s.n}:${s.key}`).join('|');
  // Kaynak listesi her çizimde yeni dizi olabilir; kimliği anahtarından anlaşılır.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assets = useMemo(() => store.assets(sources), [store, sourceKey, version]);

  const states = (layers ?? []).map((l) => store.status(l, sources));

  return {
    assets,
    version,
    /** Henüz hazırlanmayan bir görsel ya da yazı tipi var. */
    loading: states.some((s) => !s.settled),
    cutting: states.some((s) => s.cutting),
    cutFailed: states.some((s) => s.cutFailed),
    failed: states.some((s) => s.failed),
    photoFailed: states.some((s, i) => s.failed && layers?.[i].kind === 'photo'),
    retry: () => store.retry(),
  };
}
