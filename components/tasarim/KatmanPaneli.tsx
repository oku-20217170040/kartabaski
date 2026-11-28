'use client';

import { useEffect, useRef, useState } from 'react';
import type { Geometry, Sheet } from '@/lib/tasarim/ciz';
import { FILTER_LABELS, SHAPE_LABELS } from '@/lib/tasarim/foto';
import { SIZE_RANGE, maxSize, moveTo, resize, shownSize } from '@/lib/tasarim/hareket';
import {
  Layer, MAX_LAYER_TEXT, MAX_PATTERN_TEXT, PHOTO_FILTERS, PHOTO_SHAPES, TEXT_EFFECTS, TextEffect,
} from '@/lib/tasarim/model';
import { SHARPNESS_TEXT, Sharpness } from '@/lib/tasarim/netlik';
import { shapeUrl } from '@/lib/tasarim/susler';
import { fontInfo, fontSpec, loadFont } from '@/lib/tasarim/yazi-tipleri';
import RenkSecici from './RenkSecici';
import SusSecici from './SusSecici';
import YaziTipiSecici from './YaziTipiSecici';

interface Props {
  layer: Layer;
  geometry: Geometry | undefined;
  sheet: Sheet;
  sharp?: Sharpness;
  /** Arka plan siliniyor. */
  cutting: boolean;
  cutFailed: boolean;
  /** Yeni eklenen boş yazıda imleç kutuya gitsin. */
  focusText: boolean;
  onChange: (patch: Partial<Layer>, tag?: string) => void;
  onDuplicate: () => void;
  onOrder: (step: 1 | -1) => void;
  onRemove: () => void;
  onDone: () => void;
}

const EFFECT_LABELS: Record<TextEffect, string> = { none: 'Yok', outline: 'Çerçeve', shadow: 'Gölge' };
const CROPS: [string, number | undefined][] = [['Tamamı', undefined], ['Kare', 1], ['Yatay', 1.5], ['Dikey', 0.75]];
const TITLES = { text: 'Yazı', photo: 'Fotoğraf', shape: 'Süs', pattern: 'Desen' } as const;

function Slider({ label, min, max, value, onChange, output }: { label: string; min: number; max: number; value: number; onChange: (n: number) => void; output: string }) {
  return (
    <label className="tsk-slider">
      <span className="tsk-label">{label}</span>
      <input type="range" min={min} max={max} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{output}</output>
    </label>
  );
}

/** Seçili öğenin ayarları. */
export default function KatmanPaneli({
  layer, geometry, sheet, sharp, cutting, cutFailed, focusText, onChange, onDuplicate, onOrder, onRemove, onDone,
}: Props) {
  const [picker, setPicker] = useState<'font' | 'shape' | null>(null);
  const [fontReady, setFontReady] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const font = layer.kind === 'text' || layer.kind === 'pattern' ? layer.font : null;

  useEffect(() => {
    if (!font) return;
    let alive = true;
    loadFont(font).then(() => { if (alive) setFontReady(font); }).catch(() => {});
    return () => { alive = false; };
  }, [font]);

  useEffect(() => {
    setPicker(null);
    if (focusText) { input.current?.focus({ preventScroll: true }); input.current?.select(); }
    // Yalnız seçim değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id]);

  const set = (patch: Partial<Layer>, tag?: string) => onChange(patch, tag && `${tag}:${layer.id}`);
  const range = SIZE_RANGE[layer.kind];
  const sizeMax = maxSize(layer, geometry, sheet);
  const size = layer.kind === 'pattern' ? layer.s : shownSize(layer, geometry);
  const center = (axis: 'x' | 'y' | 'both') => {
    if (!geometry) return;
    const cx = axis === 'y' ? geometry.cx : sheet.width / 2;
    const cy = axis === 'x' ? geometry.cy : sheet.height / 2;
    set(moveTo(layer, geometry, sheet, cx, cy, false).patch);
  };
  const fontButton = font && (
    <div className="tsk-row">
      <span className="tsk-label">Yazı tipi</span>
      <button type="button" className="tsk-font" onClick={() => setPicker('font')}>
        <span style={fontReady === font ? { fontFamily: fontSpec(font).family, fontWeight: fontSpec(font).weight } : undefined}>{fontInfo(font).ad}</span>
        <b>Değiştir</b>
      </button>
    </div>
  );

  return (
    <div className="tsk" aria-label={`${TITLES[layer.kind]} ayarları`} role="group">
      <div className="tsk-head">
        <h3>{TITLES[layer.kind]}</h3>
        <button type="button" className="tsr-chip" onClick={onDone}>Tamam</button>
      </div>

      {layer.kind === 'text' && (
        <>
          <label className="tsk-row">
            <span className="tsk-label">Yazınız <small>(alt satır için Enter)</small></span>
            <textarea
              ref={input} className="cart-input" rows={2} maxLength={MAX_LAYER_TEXT} value={layer.text} placeholder="İyi ki doğdun Elif"
              onChange={(e) => set({ text: e.target.value }, 'text')}
            />
          </label>
          {fontButton}
          {(fontInfo(layer.font).b || fontInfo(layer.font).i) && (
            <div className="tsr-chips" role="group" aria-label="Biçim">
              {fontInfo(layer.font).b && <button type="button" className="tsr-chip" aria-pressed={Boolean(layer.bold)} onClick={() => set({ bold: !layer.bold || undefined })}>Kalın</button>}
              {fontInfo(layer.font).i && <button type="button" className="tsr-chip" aria-pressed={Boolean(layer.italic)} onClick={() => set({ italic: !layer.italic || undefined })}>Eğik</button>}
            </div>
          )}
          <RenkSecici label="Renk" value={layer.color} onChange={(color) => set({ color }, 'color')} />
        </>
      )}

      {layer.kind === 'shape' && (
        <>
          {layer.set === 'ph' && <RenkSecici label="Renk" value={layer.color} onChange={(color) => set({ color }, 'color')} />}
          <button type="button" className="tsr-chip" onClick={() => setPicker('shape')}>Süsü değiştir</button>
        </>
      )}

      {layer.kind === 'pattern' && (
        <>
          <label className="tsk-row">
            <span className="tsk-label">Tekrarlanacak yazı <small>(boşsa süs tekrarlanır)</small></span>
            <input className="cart-input" maxLength={MAX_PATTERN_TEXT} value={layer.text ?? ''} placeholder="Elif" onChange={(e) => set({ text: e.target.value || undefined }, 'text')} />
          </label>
          {layer.text?.trim() ? fontButton : (
            <button type="button" className="tsr-chip tsk-shape" onClick={() => setPicker('shape')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {layer.set && layer.name && <img src={shapeUrl(layer.set, layer.name)} alt="" width={28} height={28} />}
              Süs seç
            </button>
          )}
          {(layer.text?.trim() || layer.set === 'ph') && <RenkSecici label="Renk" value={layer.color} onChange={(color) => set({ color }, 'color')} />}
          <Slider label="Belirginlik" min={10} max={100} value={layer.opacity * 100} output={`${Math.round(layer.opacity * 100)}%`} onChange={(n) => set({ opacity: n / 100 }, 'opacity')} />
        </>
      )}

      <Slider
        label={layer.kind === 'pattern' ? 'Sıklık' : 'Boyut'}
        min={Math.round(range.min * 100)} max={Math.max(Math.round(range.min * 100) + 1, Math.round(sizeMax * 100))}
        value={size * 100} output={`${Math.round(size * 100)}`}
        onChange={(n) => set(layer.kind === 'pattern' ? { s: n / 100 } : resize(layer, geometry, sheet, n / 100), 'size')}
      />
      <Slider label="Açı" min={-180} max={180} value={layer.r} output={`${Math.round(layer.r)}°`} onChange={(r) => set({ r }, 'turn')} />

      {layer.kind === 'text' && (
        <>
          <Slider
            label="Kavis" min={-100} max={100} value={layer.curve ?? 0} output={`${layer.curve ?? 0}`}
            onChange={(n) => set({ curve: Math.abs(n) < 6 ? undefined : n }, 'curve')}
          />
          <div className="tsk-row">
            <span className="tsk-label">Efekt</span>
            <div className="tsr-chips">
              {TEXT_EFFECTS.map((fx) => (
                <button
                  key={fx} type="button" className="tsr-chip" aria-pressed={(layer.fx ?? 'none') === fx}
                  onClick={() => set({ fx: fx === 'none' ? undefined : fx, fxColor: fx === 'none' ? undefined : layer.fxColor ?? (fx === 'shadow' ? '#9C7FD1' : '#F2B200') })}
                >
                  {EFFECT_LABELS[fx]}
                </button>
              ))}
            </div>
          </div>
          {layer.fx && layer.fx !== 'none' && (
            <RenkSecici label="Efekt rengi" value={layer.fxColor ?? '#F2B200'} onChange={(fxColor) => set({ fxColor }, 'fx')} />
          )}
        </>
      )}

      {layer.kind === 'photo' && (
        <>
          {sharp && sharp !== 'iyi' && <p className="tsk-warn" role="status">{SHARPNESS_TEXT[sharp]}</p>}
          <button type="button" className="tsr-chip" aria-pressed={Boolean(layer.cut)} disabled={cutting} onClick={() => set({ cut: !layer.cut || undefined })}>
            {cutting ? 'Arka plan siliniyor…' : layer.cut ? 'Arka planı geri getir' : 'Arka planı kaldır'}
          </button>
          {cutFailed && layer.cut && <p className="tsk-warn" role="alert">Arka plan burada silinemedi; baskıdan önce biz sileriz.</p>}
          <div className="tsk-row">
            <span className="tsk-label">Şekil</span>
            <div className="tsr-chips">
              {PHOTO_SHAPES.map((shape) => (
                <button key={shape} type="button" className="tsr-chip" aria-pressed={layer.shape === shape} onClick={() => set({ shape })}>{SHAPE_LABELS[shape]}</button>
              ))}
            </div>
          </div>
          <div className="tsk-row">
            <span className="tsk-label">Kırpma</span>
            <div className="tsr-chips">
              {CROPS.map(([name, crop]) => (
                <button key={name} type="button" className="tsr-chip" aria-pressed={layer.crop === crop} onClick={() => set({ crop })}>{name}</button>
              ))}
            </div>
          </div>
          <div className="tsk-row">
            <span className="tsk-label">Renk ayarı</span>
            <div className="tsr-chips">
              {PHOTO_FILTERS.map((filter) => (
                <button key={filter} type="button" className="tsr-chip" aria-pressed={layer.filter === filter} onClick={() => set({ filter })}>{FILTER_LABELS[filter]}</button>
              ))}
            </div>
          </div>
          {layer.shape !== 'soft' && (
            <>
              <button type="button" className="tsr-chip" aria-pressed={Boolean(layer.border)} onClick={() => set({ border: layer.border ? undefined : '#F2B200' })}>Kenarlık</button>
              {layer.border && <RenkSecici label="Kenarlık rengi" value={layer.border} onChange={(border) => set({ border }, 'border')} />}
            </>
          )}
        </>
      )}

      <div className="tsk-actions" role="group" aria-label="Öğe işlemleri">
        {layer.kind !== 'pattern' && (
          <>
            <button type="button" className="tsr-chip" onClick={() => center('x')}>Yatayda ortala</button>
            <button type="button" className="tsr-chip" onClick={() => center('y')}>Dikeyde ortala</button>
            <button type="button" className="tsr-chip" onClick={() => onOrder(1)}>Öne al</button>
            <button type="button" className="tsr-chip" onClick={() => onOrder(-1)}>Arkaya al</button>
            {layer.kind !== 'photo' && <button type="button" className="tsr-chip" onClick={onDuplicate}>Çoğalt</button>}
          </>
        )}
        <button type="button" className="tsr-chip is-danger" onClick={onRemove}>Sil</button>
      </div>

      {picker === 'font' && font && (
        <YaziTipiSecici
          value={font}
          text={layer.kind === 'text' || layer.kind === 'pattern' ? layer.text ?? '' : ''}
          onPick={(id) => { set({ font: id, bold: undefined, italic: undefined }); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'shape' && (
        <SusSecici onPick={(shapeSet, name) => { set({ set: shapeSet, name }); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
