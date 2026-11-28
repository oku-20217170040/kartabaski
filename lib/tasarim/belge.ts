// Tasarım ekranında bir kupanın iki yüzünün içeriği ve üzerindeki saf işlemler.
import type { ReadyDesign } from '../cart-types';
import type { SideId } from '../design-sides';
import { Layer, PhotoLayer, addLayer, photoLayer, removePhotoAt } from './model';
import { arrange } from './kolaj';
import type { Template } from './sablonlar';

export interface Photo {
  uid: string;
  blob: Blob;
  url: string;
  /** Cihazda (IndexedDB) kayıtlıysa kimliği. */
  fileId?: string;
}

export interface Side {
  layers: Layer[];
  photos: Photo[];
  ready?: ReadyDesign;
  /** Hazır düzenin bekleyen fotoğraf yeri: ilk fotoğraf buraya oturur. */
  slot?: Template['photo'];
}

export type Doc = Record<SideId, Side>;

export const emptySide = (): Side => ({ layers: [], photos: [] });
export const emptyDoc = (): Doc => ({ front: emptySide(), back: emptySide() });

export const isEmptySide = (s: Side) =>
  !s.photos.length && !s.ready && !s.layers.some((l) => (l.kind === 'text' ? l.text.trim() : l.kind !== 'photo'));

/** Fotoğraf katmanı yazı ve süslerin altına, önceki fotoğrafların üstüne girer. */
export function insertPhotoLayer(layers: Layer[], layer: PhotoLayer): Layer[] {
  const above = layers.findIndex((l) => l.kind === 'text' || l.kind === 'shape');
  return above < 0 ? [...layers, layer] : [...layers.slice(0, above), layer, ...layers.slice(above)];
}

/** `n` sıradaki fotoğraf için başlangıç yerleşimi. */
export function placePhoto(side: Side, n: number): PhotoLayer {
  const others = side.layers.filter((l) => l.kind === 'photo').length;
  if (!others && side.slot) return photoLayer(n, { ...side.slot });
  if (others) return photoLayer(n, { x: others % 2 ? 0.76 : 0.24, y: 0.5, s: 0.62 });
  const hasText = side.layers.some((l) => l.kind === 'text' && l.text.trim());
  return photoLayer(n, hasText ? { y: 0.36, s: 0.68 } : {});
}

/** Yeni fotoğrafları ekler; boş yüze birden fazlası birden gelirse yan yana ya da ızgara dizer. */
export function addPhotos(side: Side, added: Photo[], sheet: { width: number; height: number }): Side {
  const wasEmpty = !side.layers.some((l) => l.kind === 'photo');
  let next = side;
  for (const photo of added) {
    const n = next.photos.length;
    const layer = placePhoto(next, n);
    next = { ...next, photos: [...next.photos, photo], layers: insertPhotoLayer(next.layers, layer), slot: undefined };
  }
  // Yazı ya da süs varsa fotoğraflar alanı boydan boya kaplamaz.
  if (wasEmpty && added.length > 1 && !side.layers.some((l) => l.kind === 'text' || l.kind === 'shape')) {
    next = { ...next, layers: arrange(next.layers, next.photos.length > 3 ? 'izgara' : 'yan-yana', sheet) };
  }
  return next;
}

export function removePhoto(side: Side, n: number): Side {
  return { ...side, photos: side.photos.filter((_, i) => i !== n), layers: removePhotoAt(side.layers, n) };
}

/** Konfigüratörden seçilen hazır desen: kaldırılınca katmanı da gider. */
export function setReady(side: Side, ready: ReadyDesign | undefined): Side {
  const layers = side.layers.filter((l) => !(l.kind === 'photo' && l.n === -1));
  return { ...side, ready, layers: ready?.image ? addLayer(layers, photoLayer(-1, { s: 0.8 })) : layers };
}

/** Bir yüzün tasarımını diğerine kopyalar; fotoğraf sınırı aşılıyorsa sığmayanlar atlanır. */
export function copySide(from: Side, room: number): Side {
  const photos = from.photos.slice(0, Math.max(0, room)).map((p) => ({ ...p }));
  return {
    photos,
    ready: from.ready,
    layers: from.layers.filter((l) => l.kind !== 'photo' || l.n < photos.length),
  };
}
