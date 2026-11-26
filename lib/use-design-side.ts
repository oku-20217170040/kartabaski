'use client';

import { useEffect, useRef, useState } from 'react';
import type { DesignSide, ReadyDesign } from './cart-types';
import type { PrintContent, PrintFont } from './mug-print';
import { loadFile, newId } from './cart-files';
import { READY_PLACEMENT } from './mug3d';
import { usePrintPhoto } from './use-print-photo';
import { useReadyPrint } from './use-ready-print';

export interface Picked {
  uid: string;
  blob: Blob;
  url: string;
  /** Cihazda zaten kayıtlıysa kimliği. */
  fileId?: string;
}

/**
 * Tasarım ekranında bir baskı yüzünün durumu.
 * `live`: fotoğraf kupanın üstünde gösteriliyor; `show3d`: hazır desen de kupaya sarılabiliyor.
 */
export function useDesignSide(live: boolean, show3d: boolean) {
  const [text, setText] = useState('');
  const [font, setFont] = useState<PrintFont>('duz');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [ready, setReady] = useState<ReadyDesign>();
  const [initial, setInitial] = useState<Parameters<typeof usePrintPhoto>[1]>();
  const print = usePrintPhoto(live ? photos[0]?.blob ?? null : null, initial);
  // Fotoğraf yoksa kupada seçilen hazır desen görünür.
  const readyPrint = useReadyPrint(show3d && !photos.length ? ready?.image : null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const content: PrintContent = {
    text,
    font,
    photo: readyPrint ?? print.image,
    placement: readyPrint ? READY_PLACEMENT : print.placement,
  };

  return {
    text, setText, font, setFont, photos, ready, setReady, print, content,
    /** Hazır desen yerinden oynatılamaz. */
    fixed: Boolean(readyPrint),
    empty: !text.trim() && !photos.length && !ready,
    addFiles: (files: File[], room: number) => setPhotos((prev) => [
      ...prev,
      ...files.slice(0, Math.max(0, room - prev.length)).map((blob) => ({ uid: newId(), blob, url: URL.createObjectURL(blob) })),
    ]),
    removePhoto: (uid: string) => {
      if (photos[0]?.uid === uid) setInitial(undefined);
      setPhotos((prev) => prev.filter((p) => {
        if (p.uid === uid) URL.revokeObjectURL(p.url);
        return p.uid !== uid;
      }));
    },
    /** Sepetteki kaydı ve cihazdaki fotoğrafları geri yükler. */
    restore: async (d: DesignSide) => {
      setText(d.text ?? '');
      setFont(d.font ?? 'duz');
      setReady(d.ready);
      const list = await Promise.all(d.photos.map(async (fileId) => {
        const blob = await loadFile(fileId).catch(() => null);
        return blob ? { uid: fileId, fileId, blob, url: URL.createObjectURL(blob) } : null;
      }));
      setInitial({ placement: d.placement, removeBg: d.removeBg });
      setPhotos(list.filter((p): p is NonNullable<typeof p> => p !== null));
    },
  };
}

export type DesignSideState = ReturnType<typeof useDesignSide>;
