'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Geometry, Sheet } from '@/lib/tasarim/ciz';
import { FILTER_LABELS, SHAPE_LABELS } from '@/lib/tasarim/foto';
import { SIZE_RANGE, maxSize, moveTo, resize, shownSize } from '@/lib/tasarim/hareket';
import {
  Layer, MAX_LAYER_TEXT, MAX_PATTERN_TEXT, PHOTO_FILTERS, PHOTO_SHAPES, PhotoLayer, TEXT_EFFECTS, TextEffect, TextLayer,
  photoLayer, textLayer,
} from '@/lib/tasarim/model';
import { SHARPNESS_TEXT, Sharpness } from '@/lib/tasarim/netlik';
import { useAssets } from '@/lib/tasarim/use-varliklar';
import type { PhotoSource } from '@/lib/tasarim/varliklar';
import { fontInfo } from '@/lib/tasarim/yazi-tipleri';
import Kucuk, { useThumbSources } from '../Kucuk';
import RenkSecici from '../RenkSecici';
import { IAlignH, IAlignV, IBehind, IBold, ICenter, IFront, IItalic, IMinus, IPlus } from '../ikonlar';
import type { Tool } from '../turler';
import SusPaneli from './SusPaneli';
import YaziTipiPaneli from './YaziTipiPaneli';

interface Props {
  tool: Tool;
  layer: Layer;
  geometry: Geometry | undefined;
  sheet: Sheet;
  sources: PhotoSource[];
  background: string;
  sharp?: Sharpness;
  cutFailed: boolean;
  onChange: (patch: Partial<Layer>, tag?: string) => void;
  onOrder: (step: 1 | -1) => void;
}

const EFFECT_LABELS: Record<TextEffect, string> = { none: 'Yok', outline: 'Çerçeve', shadow: 'Gölge' };
const CROPS: [string, number | undefined][] = [['Tamamı', undefined], ['Kare', 1], ['Yatay', 1.5], ['Dikey', 0.75]];

function Range({ label, min, max, value, output, onChange }: { label: string; min: number; max: number; value: number; output: string; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const step = Math.max(1, Math.round((max - min) / 20));
  return (
    <div className="std-range">
      <button type="button" className="std-icon-btn is-boxed" aria-label={`${label}: azalt`} onClick={() => set(Math.round(value) - step)}><IMinus /></button>
      <input type="range" aria-label={label} min={min} max={max} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} />
      <button type="button" className="std-icon-btn is-boxed" aria-label={`${label}: artır`} onClick={() => set(Math.round(value) + step)}><IPlus /></button>
      <output>{output}</output>
    </div>
  );
}

/** Seçeneklerin her biri sonucu gösteren küçük resim olan ızgara. */
function Variants({ items, sources, background, width, height, active, onPick }: {
  items: { id: string; label: string; layer: Layer }[];
  sources: PhotoSource[];
  background?: string;
  width: number;
  height: number;
  active: string;
  onPick: (id: string) => void;
}) {
  const { assets } = useAssets(items.map((i) => i.layer), sources);
  return (
    <div className="std-variants">
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={active === item.id} onClick={() => onPick(item.id)}>
          <Kucuk layers={[item.layer]} assets={assets} width={width} height={height} background={background} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Fotoğraf seçenekleri müşterinin kendi fotoğrafıyla gösterilir. */
function PhotoVariants({ layer, sources, tool, onChange }: { layer: PhotoLayer; sources: PhotoSource[]; tool: 'sekil' | 'filtre' | 'kirp'; onChange: Props['onChange'] }) {
  const small = useThumbSources(sources);
  const base = (id: string, patch: Partial<PhotoLayer>) => photoLayer(layer.n, { id: `v-${id}`, s: 1.42, shape: layer.shape, filter: layer.filter, crop: 1, ...patch });
  const items = useMemo(() => {
    if (tool === 'sekil') return PHOTO_SHAPES.map((shape) => ({ id: shape, label: SHAPE_LABELS[shape], layer: base(shape, { shape, filter: layer.filter }) }));
    if (tool === 'filtre') return PHOTO_FILTERS.map((filter) => ({ id: filter, label: FILTER_LABELS[filter], layer: base(filter, { filter }) }));
    return CROPS.map(([label, crop]) => ({ id: label, label, layer: base(label, { crop, s: crop === 0.75 ? 1 : crop === 1 ? 1.3 : 1.45, shape: 'plain' }) }));
    // base yalnız katmanın şekil, renk ve sırasına bağlıdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, layer.n, layer.shape, layer.filter]);
  const active = tool === 'sekil' ? layer.shape : tool === 'filtre' ? layer.filter : CROPS.find(([, c]) => c === layer.crop)?.[0] ?? '';

  return (
    <Variants
      items={items} sources={small} width={144} height={144} active={active}
      onPick={(id) => onChange(tool === 'sekil' ? { shape: id as PhotoLayer['shape'] } : tool === 'filtre' ? { filter: id as PhotoLayer['filter'] } : { crop: CROPS.find(([l]) => l === id)?.[1] })}
    />
  );
}

function TextVariants({ layer, tool, background, onChange }: { layer: TextLayer; tool: 'efekt' | 'kavis'; background: string; onChange: Props['onChange'] }) {
  const sample = layer.text.trim().split('\n')[0].slice(0, 8) || 'Örnek';
  const base = (id: string, patch: Partial<TextLayer>) => textLayer({ ...layer, id: `v-${id}`, text: sample, x: 0.5, y: 0.5, r: 0, s: 0.34, mw: undefined, curve: undefined, ...patch });
  const effectColor = layer.fxColor ?? '#F2B200';
  const items = tool === 'efekt'
    ? TEXT_EFFECTS.map((fx) => ({ id: fx, label: EFFECT_LABELS[fx], layer: base(fx, { fx: fx === 'none' ? undefined : fx, fxColor: effectColor }) }))
    : ([['yukari', 'Yukarı yay', 55], ['duz', 'Düz', 0], ['asagi', 'Aşağı yay', -55]] as const).map(([id, label, curve]) => ({ id, label, layer: base(id, { curve: curve || undefined }) }));
  const active = tool === 'efekt' ? layer.fx ?? 'none' : !layer.curve ? 'duz' : layer.curve > 0 ? 'yukari' : 'asagi';

  return (
    <>
      <Variants
        items={items} sources={[]} background={background} width={200} height={140} active={active}
        onPick={(id) => {
          if (tool === 'kavis') onChange({ curve: id === 'yukari' ? 45 : id === 'asagi' ? -45 : undefined });
          else onChange({ fx: id === 'none' ? undefined : (id as TextEffect), fxColor: id === 'none' ? undefined : layer.fxColor ?? (id === 'shadow' ? '#9C7FD1' : '#F2B200') });
        }}
      />
      {tool === 'kavis' && (
        <Range label="Kavis" min={-100} max={100} value={layer.curve ?? 0} output={`${layer.curve ?? 0}`} onChange={(n) => onChange({ curve: Math.abs(n) < 6 ? undefined : n }, 'curve')} />
      )}
      {tool === 'efekt' && layer.fx && layer.fx !== 'none' && (
        <RenkSecici label="Efekt rengi" value={effectColor} onChange={(fxColor) => onChange({ fxColor }, 'fx')} />
      )}
    </>
  );
}

/** Araç çubuğunda seçilen tek bir ayar. */
export default function AracPaneli({ tool, layer, geometry, sheet, sources, background, sharp, cutFailed, onChange, onOrder }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (tool === 'metin') { input.current?.focus({ preventScroll: true }); input.current?.select(); }
    // Yalnız araç ya da öğe değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, layer.id]);

  const warn = (
    <>
      {layer.kind === 'photo' && sharp && sharp !== 'iyi' && <p className="std-warn" role="status">{SHARPNESS_TEXT[sharp]}</p>}
      {layer.kind === 'photo' && cutFailed && layer.cut && <p className="std-warn" role="alert">Arka plan burada silinemedi; baskıdan önce biz sileriz.</p>}
    </>
  );

  if (tool === 'metin' && layer.kind === 'text') {
    const info = fontInfo(layer.font);
    return (
      <>
        <textarea
          ref={input} className="std-input std-text" rows={2} maxLength={MAX_LAYER_TEXT} value={layer.text}
          aria-label="Yazınız" placeholder="İyi ki doğdun Elif" onChange={(e) => onChange({ text: e.target.value }, 'text')}
        />
        {(info.b || info.i) && (
          <div className="std-row">
            {info.b && <button type="button" className="std-icon-btn is-boxed" aria-label="Kalın" aria-pressed={Boolean(layer.bold)} onClick={() => onChange({ bold: !layer.bold || undefined })}><IBold /></button>}
            {info.i && <button type="button" className="std-icon-btn is-boxed" aria-label="Eğik" aria-pressed={Boolean(layer.italic)} onClick={() => onChange({ italic: !layer.italic || undefined })}><IItalic /></button>}
          </div>
        )}
      </>
    );
  }
  if (tool === 'font' && (layer.kind === 'text' || layer.kind === 'pattern')) {
    return <YaziTipiPaneli value={layer.font} text={layer.text ?? ''} onPick={(font) => onChange({ font, bold: undefined, italic: undefined })} />;
  }
  if (tool === 'renk' && layer.kind !== 'photo') {
    return <RenkSecici label="Renk" value={layer.color} onChange={(color) => onChange({ color }, 'color')} />;
  }
  if (tool === 'boyut' || tool === 'siklik') {
    const range = SIZE_RANGE[layer.kind];
    const min = Math.round(range.min * 100);
    const size = layer.kind === 'pattern' ? layer.s : shownSize(layer, geometry);
    return (
      <>
        <Range
          label={tool === 'siklik' ? 'Sıklık' : 'Boyut'} min={min} max={Math.max(min + 1, Math.round(maxSize(layer, geometry, sheet) * 100))}
          value={size * 100} output={`${Math.round(size * 100)}`}
          onChange={(n) => onChange(layer.kind === 'pattern' ? { s: n / 100 } : resize(layer, geometry, sheet, n / 100), 'size')}
        />
        {warn}
      </>
    );
  }
  if (tool === 'dondur') {
    return (
      <>
        <Range label="Açı" min={-180} max={180} value={layer.r} output={`${Math.round(layer.r)}°`} onChange={(r) => onChange({ r }, 'turn')} />
        <div className="std-row">
          {[-45, -15, 0, 15, 45].map((r) => (
            <button key={r} type="button" className="std-chip" aria-pressed={layer.r === r} onClick={() => onChange({ r })}>{r}°</button>
          ))}
        </div>
      </>
    );
  }
  if (tool === 'belirgin' && layer.kind === 'pattern') {
    return <Range label="Belirginlik" min={10} max={100} value={layer.opacity * 100} output={`${Math.round(layer.opacity * 100)}%`} onChange={(n) => onChange({ opacity: n / 100 }, 'opacity')} />;
  }
  if ((tool === 'efekt' || tool === 'kavis') && layer.kind === 'text') {
    return <TextVariants layer={layer} tool={tool} background={background} onChange={onChange} />;
  }
  if (tool === 'konum') {
    const center = (axis: 'x' | 'y' | 'both') => {
      if (!geometry) return;
      const cx = axis === 'y' ? geometry.cx : sheet.width / 2;
      const cy = axis === 'x' ? geometry.cy : sheet.height / 2;
      onChange(moveTo(layer, geometry, sheet, cx, cy, false).patch);
    };
    return (
      <div className="std-choice is-three">
        <button type="button" onClick={() => center('x')}><IAlignH size={30} /> Yatayda ortala</button>
        <button type="button" onClick={() => center('y')}><IAlignV size={30} /> Dikeyde ortala</button>
        <button type="button" onClick={() => center('both')}><ICenter size={30} /> Tam ortala</button>
        <button type="button" onClick={() => onOrder(1)}><IFront size={30} /> Öne al</button>
        <button type="button" onClick={() => onOrder(-1)}><IBehind size={30} /> Arkaya al</button>
      </div>
    );
  }
  if ((tool === 'sekil' || tool === 'filtre' || tool === 'kirp') && layer.kind === 'photo') {
    return (
      <>
        {warn}
        <PhotoVariants layer={layer} sources={sources} tool={tool} onChange={onChange} />
      </>
    );
  }
  if (tool === 'kenarlik' && layer.kind === 'photo') {
    return (
      <>
        <div className="std-segment" role="group" aria-label="Kenarlık">
          <button type="button" aria-pressed={!layer.border} onClick={() => onChange({ border: undefined })}>Yok</button>
          <button type="button" aria-pressed={Boolean(layer.border)} onClick={() => onChange({ border: layer.border ?? '#F2B200' })}>Kenarlık</button>
        </div>
        {layer.border && <RenkSecici label="Kenarlık rengi" value={layer.border} onChange={(border) => onChange({ border }, 'border')} />}
      </>
    );
  }
  if (tool === 'icerik' && layer.kind === 'pattern') {
    return (
      <>
        <input
          className="std-input" maxLength={MAX_PATTERN_TEXT} value={layer.text ?? ''} aria-label="Tekrarlanacak yazı"
          placeholder="Tekrarlanacak yazı (isim)" onChange={(e) => onChange({ text: e.target.value || undefined }, 'text')}
        />
        {!layer.text?.trim() && <SusPaneli onPick={(set, name) => onChange({ set, name })} />}
      </>
    );
  }
  if (tool === 'degistir' && layer.kind === 'shape') {
    return <SusPaneli onPick={(set, name) => onChange({ set, name })} />;
  }
  return null;
}
