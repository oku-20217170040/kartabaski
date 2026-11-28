'use client';

import { useMemo, useState } from 'react';
import type { Side } from '@/lib/tasarim/belge';
import { PATTERN_STYLES, PatternStyle, TEXT_BASICS, TEXT_STYLES, TextStyle, patternFrom } from '@/lib/tasarim/hazir-parcalar';
import { Layer, textLayer } from '@/lib/tasarim/model';
import { TEMPLATES, TEMPLATE_GROUPS, Template, applyTemplate } from '@/lib/tasarim/sablonlar';
import { useAssets } from '@/lib/tasarim/use-varliklar';
import type { PhotoSource } from '@/lib/tasarim/varliklar';
import Kucuk, { useThumbSources } from '../Kucuk';
import { IPlus } from '../ikonlar';

interface Sheet { width: number; height: number }

/** Küçük resim ölçüsü: baskı alanıyla aynı oran. */
const thumb = (sheet: Sheet, width = 300) => ({ width, height: Math.round((width * sheet.height) / sheet.width) });

interface TemplateProps {
  side: Side;
  sources: PhotoSource[];
  sheet: Sheet;
  background: string;
  onPick: (template: Template) => void;
}

/** Hazır düzenler: müşterinin fotoğrafıyla birlikte görünür. */
export function DuzenPaneli({ side, sources, sheet, background, onPick }: TemplateProps) {
  const [group, setGroup] = useState('');
  const smallSources = useThumbSources(sources);
  const items = useMemo(() => TEMPLATES.map((t) => ({
    t,
    // Arka plan silme ağır iştir; küçük resimde fotoğraf olduğu gibi gösterilir.
    layers: applyTemplate(side.layers, t).map((l) => (l.kind === 'photo' ? { ...l, cut: undefined } : l)),
  })), [side.layers]);
  const shown = items.filter(({ t }) => !group || t.grup === group);
  const { assets } = useAssets(shown.flatMap((i) => i.layers), smallSources);
  const size = thumb(sheet);

  return (
    <>
      <div className="std-sticky">
        <div className="std-chips" role="group" aria-label="Düzen grubu">
          <button type="button" className="std-chip" aria-pressed={!group} onClick={() => setGroup('')}>Hepsi</button>
          {TEMPLATE_GROUPS.map((g) => (
            <button key={g} type="button" className="std-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className="std-cards">
        {shown.map(({ t, layers }) => (
          <button key={t.id} type="button" className="std-card" aria-label={t.ad} title={t.ad} onClick={() => onPick(t)}>
            <Kucuk layers={layers} assets={assets} background={background} {...size} />
          </button>
        ))}
      </div>
    </>
  );
}

const place = (style: TextStyle) => textLayer({ id: `st-${style.id}`, text: style.text, x: 0.5, y: 0.5, s: 0.42, ...style.patch });

/** Yazı: hazır stiller resim olarak; dokununca o stille yazı eklenir. */
export function YaziPaneli({ sheet, background, onAdd }: { sheet: Sheet; background: string; onAdd: (style: TextStyle) => void }) {
  const layers = useMemo(() => TEXT_STYLES.map(place), []);
  const basics = useMemo(() => TEXT_BASICS.map(place), []);
  const { assets } = useAssets([...layers, ...basics], []);
  const size = thumb(sheet, 240);

  return (
    <>
      <div className="std-basics">
        {TEXT_BASICS.map((style) => (
          <button key={style.id} type="button" className={style.id === 'el' ? 'is-hand' : undefined} onClick={() => onAdd(style)}>
            <IPlus size={20} /> {style.ad}
          </button>
        ))}
      </div>
      <div className="std-cards">
        {TEXT_STYLES.map((style, i) => (
          <button key={style.id} type="button" className="std-card" aria-label={`${style.ad} yazı ekle`} title={style.ad} onClick={() => onAdd(style)}>
            <Kucuk layers={[layers[i]]} assets={assets} background={background} {...size} />
          </button>
        ))}
      </div>
    </>
  );
}

interface PatternProps {
  sheet: Sheet;
  background: string;
  current?: Layer;
  onPick: (style: PatternStyle) => void;
  onClear: () => void;
}

export function DesenPaneli({ sheet, background, current, onPick, onClear }: PatternProps) {
  const layers = useMemo(() => PATTERN_STYLES.map((s) => ({ ...patternFrom(s), id: `ds-${s.id}`, s: (s.patch.s ?? 0.26) * 1.6 })), []);
  const { assets } = useAssets(layers, []);
  const size = thumb(sheet, 240);

  return (
    <div className="std-cards">
      <button type="button" className="std-card is-none" aria-pressed={!current} onClick={onClear}>Desensiz</button>
      {PATTERN_STYLES.map((style, i) => (
        <button key={style.id} type="button" className="std-card" aria-label={style.ad} title={style.ad} onClick={() => onPick(style)}>
          <Kucuk layers={[layers[i]]} assets={assets} background={background} {...size} />
        </button>
      ))}
    </div>
  );
}
