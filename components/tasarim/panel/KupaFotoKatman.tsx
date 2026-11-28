'use client';

import type { ReadyDesign } from '@/lib/cart-types';
import { cartImageSrc } from '@/lib/cart-products';
import type { Photo } from '@/lib/tasarim/belge';
import { Collage } from '@/lib/tasarim/kolaj';
import type { Layer } from '@/lib/tasarim/model';
import { useAssets } from '@/lib/tasarim/use-varliklar';
import type { PhotoSource } from '@/lib/tasarim/varliklar';
import Kucuk, { useThumbSources } from '../Kucuk';
import { IBehind, IClose, IFront, ITrash, IUpload, MugGlyph } from '../ikonlar';

interface MugProps {
  colors: { name: string; hex: string }[];
  color: string;
  onColor: (name: string) => void;
  twoSided: boolean;
  onSides: (two: boolean) => void;
  ready?: ReadyDesign;
  onRemoveReady: () => void;
}

/** Kupa rengi yuvarlaklarla, tek / iki yüz kupa çizimiyle seçilir. */
export function KupaPaneli({ colors, color, onColor, twoSided, onSides, ready, onRemoveReady }: MugProps) {
  const same = (a: string, b: string) => a.toLocaleLowerCase('tr-TR') === b.toLocaleLowerCase('tr-TR');
  return (
    <>
      {colors.length > 0 && (
        <>
          <h3 className="std-sub">Renk: <b>{color}</b></h3>
          <div className="std-swatches" role="group" aria-label="Kupa rengi">
            {colors.map((c) => (
              <button key={c.name} type="button" aria-pressed={same(c.name, color)} aria-label={c.name} title={c.name} onClick={() => onColor(c.name)}>
                <i style={{ background: c.hex }} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="std-sub">Baskı yüzü</h3>
      <div className="std-choice" role="group" aria-label="Baskı">
        <button type="button" aria-pressed={!twoSided} onClick={() => onSides(false)}><MugGlyph face="front" size={52} /> Tek yüz</button>
        <button type="button" aria-pressed={twoSided} onClick={() => onSides(true)}><MugGlyph face="both" size={52} /> İki yüz</button>
      </div>

      {ready && (
        <>
          <h3 className="std-sub">Hazır desen</h3>
          <div className="std-ready">
            {ready.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cartImageSrc(ready.image) ?? ''} alt="" />
            )}
            <b>{ready.name}</b>
            <button type="button" className="std-icon-btn is-boxed" onClick={onRemoveReady} aria-label="Hazır deseni kaldır"><IClose /></button>
          </div>
        </>
      )}
    </>
  );
}

/** Kolaj düzeninin şeması. */
function CollageGlyph({ kind }: { kind: Collage }) {
  const cells: [number, number, number, number][] = kind === 'yan-yana'
    ? [[0, 0, 19, 40], [21, 0, 19, 40], [42, 0, 18, 40]]
    : kind === 'izgara'
      ? [[0, 0, 29, 19], [31, 0, 29, 19], [0, 21, 29, 19], [31, 21, 29, 19]]
      : [[0, 0, 36, 40], [38, 0, 22, 19], [38, 21, 22, 19]];
  return (
    <svg viewBox="0 0 60 40" width="60" height="40" fill="currentColor" aria-hidden="true">
      {cells.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="2" />)}
    </svg>
  );
}

const COLLAGES: [Collage, string][] = [['yan-yana', 'Yan yana'], ['izgara', 'Izgara'], ['buyuk', 'Biri büyük']];

interface PhotoProps {
  photos: Photo[];
  layers: Layer[];
  room: number;
  busy: boolean;
  onFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPick: (n: number) => void;
  onRemove: (n: number) => void;
  onCollage: (kind: Collage) => void;
}

export function FotoPaneli({ photos, layers, room, busy, onFiles, onPick, onRemove, onCollage }: PhotoProps) {
  const full = photos.length >= room;
  return (
    <>
      <label className={`std-upload${busy || full ? ' is-off' : ''}`}>
        <IUpload size={36} />
        <b>{busy ? 'Ekleniyor…' : 'Fotoğraf yükle'}</b>
        <span>{photos.length}/{room} · fotoğraf, logo ya da çizim</span>
        <input type="file" accept="image/*" multiple className="sr-only" disabled={busy || full} onChange={onFiles} />
      </label>

      {photos.length > 0 && (
        <ul className="std-photos">
          {photos.map((p, i) => {
            const placed = layers.some((l) => l.kind === 'photo' && l.n === i);
            return (
              <li key={p.uid}>
                <button type="button" className="std-photo" onClick={() => onPick(i)} aria-label={placed ? `${i + 1}. fotoğrafı seç` : `${i + 1}. fotoğrafı baskıya ekle`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" />
                  {!placed && <span>Ekle</span>}
                </button>
                <button type="button" className="std-photo-remove" onClick={() => onRemove(i)} aria-label={`${i + 1}. fotoğrafı kaldır`}><IClose size={18} /></button>
              </li>
            );
          })}
        </ul>
      )}

      {layers.filter((l) => l.kind === 'photo').length > 1 && (
        <>
          <h3 className="std-sub">Fotoğrafları diz</h3>
          <div className="std-choice is-three" role="group" aria-label="Fotoğrafları diz">
            {COLLAGES.map(([kind, name]) => (
              <button key={kind} type="button" onClick={() => onCollage(kind)}><CollageGlyph kind={kind} /> {name}</button>
            ))}
          </div>
        </>
      )}
      <p className="std-note">Fotoğraflar siparişi oluşturana kadar cihazınızda kalır.</p>
    </>
  );
}

export function layerName(l: Layer): string {
  if (l.kind === 'text') return l.text.trim().split('\n')[0].slice(0, 24) || 'Boş yazı';
  if (l.kind === 'photo') return l.n < 0 ? 'Hazır desen' : `Fotoğraf ${l.n + 1}`;
  if (l.kind === 'shape') return 'Süs';
  return 'Desen';
}

interface ListProps {
  layers: Layer[];
  sources: PhotoSource[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOrder: (id: string, step: 1 | -1) => void;
  onRemove: (id: string) => void;
}

/** Üstteki en başta: her satırda öğenin resmi. */
export function KatmanListesi({ layers, sources, selected, onSelect, onOrder, onRemove }: ListProps) {
  const smallSources = useThumbSources(sources);
  const items = layers.map((l) => ({
    layer: l,
    shown: (l.kind === 'pattern' ? l : { ...l, x: 0.5, y: 0.5, r: 0, s: l.kind === 'photo' ? 1.4 : 0.7, ...(l.kind === 'photo' ? { cut: undefined, crop: 1, box: undefined } : {}), ...(l.kind === 'text' ? { s: 0.4, curve: undefined } : {}) }) as Layer,
  })).reverse();
  const { assets } = useAssets(items.map((i) => i.shown), smallSources);

  if (!layers.length) return <p className="std-empty">Henüz bir şey eklemediniz.</p>;
  return (
    <ol className="std-layers">
      {items.map(({ layer, shown }) => (
        <li key={layer.id} className={selected === layer.id ? 'is-on' : undefined}>
          <button type="button" className="std-layer" aria-pressed={selected === layer.id} onClick={() => onSelect(layer.id)}>
            <Kucuk layers={[shown]} assets={assets} width={112} height={112} />
            <span>{layerName(layer)}</span>
          </button>
          {layer.kind !== 'pattern' && (
            <>
              <button type="button" className="std-icon-btn" onClick={() => onOrder(layer.id, 1)} aria-label={`${layerName(layer)}: öne al`}><IFront /></button>
              <button type="button" className="std-icon-btn" onClick={() => onOrder(layer.id, -1)} aria-label={`${layerName(layer)}: arkaya al`}><IBehind /></button>
            </>
          )}
          <button type="button" className="std-icon-btn" onClick={() => onRemove(layer.id)} aria-label={`${layerName(layer)}: sil`}><ITrash /></button>
        </li>
      ))}
    </ol>
  );
}
