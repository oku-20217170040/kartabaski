'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PLACEMENT, Placement } from './photo-layout';
import { removeBackground } from './remove-background';

interface Initial { placement?: Placement; removeBg?: boolean }

/**
 * Kupanın üstüne basılan tek fotoğrafın durumu: yükleme, yerleşim ve arka plan silme.
 * `file` değişince yerleşim sıfırlanır; `initial` yalnız ilk fotoğrafa uygulanır (satır düzenleme).
 */
export function usePrintPhoto(file: Blob | null, initial?: Initial) {
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [cutout, setCutout] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [removeBg, setRemoveBg] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<HTMLImageElement | null>(null);
  const pending = useRef<Initial | undefined>(initial);
  if (initial && pending.current === undefined && !original) pending.current = initial;

  const cut = async (source: HTMLImageElement) => {
    setRemoving(true);
    try {
      const result = await removeBackground(source);
      // İşlem sürerken fotoğraf değiştiyse sonucu at.
      if (current.current !== source) { URL.revokeObjectURL(result.src); return; }
      setCutout(result);
      setRemoveBg(true);
    } catch {
      setError('Arka plan silinemedi. Siparişte belirtirseniz biz sileriz.');
    } finally {
      setRemoving(false);
    }
  };

  useEffect(() => {
    setOriginal(null);
    setCutout(null);
    setRemoveBg(false);
    setPlacement(DEFAULT_PLACEMENT);
    setError('');
    current.current = null;
    if (!file) return;

    const img = new window.Image();
    img.onload = () => {
      current.current = img;
      setOriginal(img);
      const start = pending.current;
      pending.current = undefined;
      if (start?.placement) setPlacement(start.placement);
      if (start?.removeBg) cut(img);
    };
    img.onerror = () => setError('Bu dosya açılamadı. JPG veya PNG bir fotoğraf deneyin.');
    const url = URL.createObjectURL(file);
    img.src = url;
    return () => { URL.revokeObjectURL(url); };
    // cut yalnız referansları kullanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => () => { if (cutout) URL.revokeObjectURL(cutout.src); }, [cutout]);

  const toggleBackground = () => {
    if (!original) return;
    setError('');
    if (removeBg) setRemoveBg(false);
    else if (cutout) setRemoveBg(true);
    else cut(original);
  };

  return {
    image: removeBg && cutout ? cutout : original,
    placement,
    setPlacement,
    removeBg,
    removing,
    toggleBackground,
    error,
  };
}
