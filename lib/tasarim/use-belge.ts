'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignSide } from '../cart-types';
import type { SideId } from '../design-sides';
import { loadFile, newId, saveFile } from '../cart-files';
import { prepareUpload } from '../siparis-client';
import { Doc, Photo, Side, addPhotos, emptyDoc, removePhoto } from './belge';
import { layersFromLegacy } from './donustur';
import { History, commit, redo, startHistory, undo } from './gecmis';
import type { Layer } from './model';

type Saved = Pick<DesignSide, 'photos' | 'layers' | 'text' | 'font' | 'placement' | 'removeBg' | 'ready'>;

/** Tasarım ekranının iki yüzü, geri alma geçmişi ve fotoğrafların cihazda saklanması. */
export function useDoc() {
  const [history, setHistory] = useState<History<Doc>>(() => startHistory(emptyDoc()));
  const urls = useRef(new Set<string>());

  // Geri alınabildiği için fotoğraf adresleri ekran kapanınca bırakılır.
  useEffect(() => {
    const made = urls.current;
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const change = useCallback((side: SideId, update: (s: Side) => Side, tag?: string) => {
    setHistory((h) => {
      const next = update(h.present[side]);
      return next === h.present[side] ? h : commit(h, { ...h.present, [side]: next }, tag && `${side}:${tag}`);
    });
  }, []);

  const setLayers = useCallback((side: SideId, update: (layers: Layer[]) => Layer[], tag?: string) => {
    change(side, (s) => {
      const layers = update(s.layers);
      return layers === s.layers ? s : { ...s, layers };
    }, tag);
  }, [change]);

  const makePhoto = useCallback((blob: Blob, fileId?: string): Photo => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return { uid: fileId ?? newId(), blob, url, fileId };
  }, []);

  /** Dosyaları küçültüp cihaza kaydeder ve yüze ekler. */
  const addFiles = useCallback(async (side: SideId, files: Blob[], sheet: { width: number; height: number }) => {
    const photos = await Promise.all(files.map(async (file) => {
      const blob = await prepareUpload(file);
      // Gizli modda kayıt olmayabilir; sepete eklerken yeniden denenir.
      const fileId = await saveFile(blob).catch(() => undefined);
      return makePhoto(blob, fileId);
    }));
    change(side, (s) => addPhotos(s, photos, sheet));
  }, [change, makePhoto]);

  const dropPhoto = useCallback((side: SideId, n: number) => change(side, (s) => removePhoto(s, n)), [change]);

  /** Sepetteki ya da taslaktaki kayıttan iki yüzü geri yükler (geçmiş sıfırlanır). */
  const restore = useCallback(async (front: Saved, back?: Saved) => {
    const load = async (d: Saved | undefined): Promise<Side> => {
      if (!d) return { layers: [], photos: [] };
      const found = await Promise.all(d.photos.map(async (fileId) => {
        const blob = await loadFile(fileId).catch(() => null);
        return blob ? makePhoto(blob, fileId) : null;
      }));
      let side: Side = {
        layers: d.layers ?? layersFromLegacy(d),
        photos: found.map((p, i) => p ?? { uid: d.photos[i], blob: new Blob(), url: '' }),
        ready: d.ready,
      };
      // Cihazdan silinmiş fotoğraf yüzden çıkarılır (sondan başlayarak: sıralar kaymasın).
      for (let i = found.length - 1; i >= 0; i -= 1) if (!found[i]) side = removePhoto(side, i);
      return side;
    };
    const doc: Doc = { front: await load(front), back: await load(back) };
    setHistory(startHistory(doc));
  }, [makePhoto]);

  return {
    doc: history.present,
    change,
    setLayers,
    addFiles,
    dropPhoto,
    restore,
    reset: useCallback(() => setHistory(startHistory(emptyDoc())), []),
    undo: useCallback(() => setHistory(undo), []),
    redo: useCallback(() => setHistory(redo), []),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
