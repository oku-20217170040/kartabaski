// Tarayıcıda katmanların çizim için ihtiyaç duyduğu görseller: fotoğraf (kesim, arka plan, renk),
// süs çizimi ve yazı tipi. Her biri bir kez hazırlanır; hazır oldukça sahibi yeniden çizdirir.
import { removeBackground } from '../remove-background';
import { trimmedImage } from '../use-ready-print';
import type { Assets, Drawable } from './ciz';
import { filterPixels } from './foto';
import type { Layer, PhotoFilter, PhotoLayer, ShapeSet } from './model';
import { shapeUrl } from './susler';
import { fontSpec, loadFont } from './yazi-tipleri';

export interface PhotoSource {
  /** Yüzün fotoğraf sırası; -1 hazır desen. */
  n: number;
  key: string;
  url: string;
  /** Çevresindeki boş beyaz pay atılsın (hazır desen). */
  trim?: boolean;
}

type Slot<T> = { state: 'busy' } | { state: 'done'; value: T } | { state: 'failed' };

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new window.Image();
  // Hazır desen başka alan adından gelir; tuval kirlenmesin.
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('görsel açılamadı'));
  img.src = url;
});

function filtered(source: Drawable, filter: PhotoFilter): Drawable {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  filterPixels(pixels.data, filter);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/** Arka plan silme modeli aynı anda tek iş yapar. */
let cutQueue: Promise<unknown> = Promise.resolve();
const queuedCut = (img: HTMLImageElement) => {
  const job = cutQueue.then(() => removeBackground(img));
  cutQueue = job.catch(() => {});
  return job;
};

export class AssetStore {
  private slots = new Map<string, Slot<unknown>>();

  constructor(private onChange: () => void) {}

  private get<T>(key: string): Slot<T> | undefined {
    return this.slots.get(key) as Slot<T> | undefined;
  }

  private value<T>(key: string): T | null {
    const slot = this.get<T>(key);
    return slot?.state === 'done' ? slot.value : null;
  }

  private start<T>(key: string, job: () => Promise<T>) {
    if (this.slots.has(key)) return;
    this.slots.set(key, { state: 'busy' });
    job().then(
      (value) => { this.slots.set(key, { state: 'done', value }); this.onChange(); },
      () => { this.slots.set(key, { state: 'failed' }); this.onChange(); },
    );
  }

  /** Bir fotoğraf katmanının hazırlık adımları; eldeki en son aşamayı döner. */
  private photo(layer: PhotoLayer, source: PhotoSource | undefined): { image: Drawable | null; settled: boolean; cutting: boolean; cutFailed: boolean; failed: boolean } {
    const none = { image: null, settled: true, cutting: false, cutFailed: false, failed: false };
    if (!source) return none;
    const base = `img:${source.key}`;
    this.start(base, async () => {
      const img = await loadImage(source.url);
      return source.trim ? trimmedImage(img) : img;
    });
    const original = this.value<HTMLImageElement>(base);
    if (!original) {
      const failed = this.get(base)?.state === 'failed';
      return { ...none, settled: failed, failed };
    }

    let image: Drawable = original;
    let stage = base;
    let cutFailed = false;
    if (layer.cut) {
      const key = `cut:${source.key}`;
      this.start(key, () => queuedCut(original));
      const done = this.value<HTMLImageElement>(key);
      if (done) { image = done; stage = key; } else if (this.get(key)?.state === 'failed') cutFailed = true;
      else return { ...none, image, settled: false, cutting: true };
    }
    if (layer.filter !== 'none') {
      const key = `${stage}|${layer.filter}`;
      const ready = image;
      this.start(key, () => new Promise<Drawable>((resolve) => { setTimeout(() => resolve(filtered(ready, layer.filter)), 0); }));
      const done = this.value<Drawable>(key);
      if (!done) return { ...none, image, settled: this.get(key)?.state === 'failed', cutFailed };
      image = done;
    }
    return { ...none, image, cutFailed };
  }

  private shape(l: { set: ShapeSet; name: string; color: string }) {
    // Renkli set boyanmaz; renk anahtara girmez.
    const color = l.set === 'ph' ? l.color : '';
    const key = `svg:${l.set}/${l.name}${color}`;
    this.start(key, async () => {
      const res = await fetch(shapeUrl(l.set, l.name));
      if (!res.ok) throw new Error('süs alınamadı');
      let svg = await res.text();
      if (color) svg = svg.split('currentColor').join(color);
      return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return key;
  }

  private font(l: { font: string; bold?: boolean; italic?: boolean }) {
    const { weight, style } = fontSpec(l.font, l.bold, l.italic);
    const key = `font:${l.font}:${weight}:${style}`;
    this.start(key, () => loadFont(l.font, l.bold, l.italic));
    return key;
  }

  /** Katman için gerekenleri başlatır ve durumunu söyler. */
  status(layer: Layer, sources: PhotoSource[]) {
    if (layer.kind === 'photo') {
      const r = this.photo(layer, sources.find((s) => s.n === layer.n));
      return { settled: r.settled, cutting: r.cutting, cutFailed: r.cutFailed, failed: r.failed };
    }
    const keys: string[] = [];
    if (layer.kind === 'shape') keys.push(this.shape(layer));
    else {
      keys.push(this.font(layer));
      if (layer.kind === 'pattern' && !layer.text?.trim() && layer.set && layer.name) {
        keys.push(this.shape({ set: layer.set, name: layer.name, color: layer.color }));
      }
    }
    const states = keys.map((k) => this.get(k)?.state);
    return { settled: !states.includes('busy'), cutting: false, cutFailed: false, failed: states.includes('failed') };
  }

  assets(sources: PhotoSource[]): Assets {
    return {
      font: (l) => { this.font(l); return fontSpec(l.font, l.bold, l.italic); },
      photo: (l) => this.photo(l, sources.find((s) => s.n === l.n)).image,
      shape: (l) => this.value<HTMLImageElement>(this.shape(l)),
    };
  }

  /** Hata veren hazırlıklar yeniden denenebilsin. */
  retry() {
    this.slots.forEach((slot, key) => { if (slot.state === 'failed') this.slots.delete(key); });
    this.onChange();
  }
}
