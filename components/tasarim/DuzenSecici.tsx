'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { drawPrint } from '@/lib/mug-print';
import { Side } from '@/lib/tasarim/belge';
import { TEMPLATES, TEMPLATE_GROUPS, Template, applyTemplate } from '@/lib/tasarim/sablonlar';
import { useAssets } from '@/lib/tasarim/use-varliklar';
import type { PhotoSource } from '@/lib/tasarim/varliklar';
import Pencere from './Pencere';
import { useInView } from './use-in-view';

interface CardProps {
  template: Template;
  side: Side;
  sources: PhotoSource[];
  sheet: { width: number; height: number };
  background: string;
  onPick: () => void;
}

function Preview({ template, side, sources, sheet, background }: Omit<CardProps, 'onPick'>) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Arka plan silme ağır iştir; küçük resimde fotoğraf olduğu gibi gösterilir.
  const layers = useMemo(
    () => applyTemplate(side.layers, template).map((l) => (l.kind === 'photo' ? { ...l, cut: undefined } : l)),
    [side.layers, template],
  );
  const { assets } = useAssets(layers, sources);
  useEffect(() => {
    if (ref.current) drawPrint(ref.current, { text: '', font: 'duz', photo: null, layers, assets, base: background });
  }, [layers, assets, background]);
  return <canvas ref={ref} width={sheet.width} height={sheet.height} aria-hidden="true" />;
}

/** Görünmeden önce yazı tipi ve süs indirilmez. */
function Card(props: CardProps) {
  const [ref, seen] = useInView<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" className="tsd-card" onClick={props.onPick}>
      {seen
        ? <Preview {...props} />
        : <canvas width={props.sheet.width} height={props.sheet.height} aria-hidden="true" />}
      <span>{props.template.ad}</span>
    </button>
  );
}

interface Props {
  side: Side;
  sources: PhotoSource[];
  /** Küçük resim ölçüsü (baskı alanı oranında). */
  sheet: { width: number; height: number };
  background: string;
  onPick: (template: Template) => void;
  onClose: () => void;
}

export default function DuzenSecici({ onPick, onClose, ...card }: Props) {
  const [group, setGroup] = useState('');
  return (
    <Pencere
      title="Hazır düzen seçin"
      onClose={onClose}
      tools={(
        <div className="tsp-tabs" role="group" aria-label="Düzen grubu">
          <button type="button" className="tsr-chip" aria-pressed={!group} onClick={() => setGroup('')}>Hepsi</button>
          {TEMPLATE_GROUPS.map((g) => (
            <button key={g} type="button" className="tsr-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
      )}
    >
      <p className="tsr-small">Yazıları sonra kendi yazınızla değiştirin. Fotoğraflarınız kalır; yazı ve süsler yenilenir.</p>
      <div className="tsd-grid">
        {TEMPLATES.filter((t) => !group || t.grup === group).map((t) => (
          <Card key={t.id} {...card} template={t} onPick={() => onPick(t)} />
        ))}
      </div>
    </Pencere>
  );
}
