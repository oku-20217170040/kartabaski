'use client';

import { INKS, isTooLight } from '@/lib/tasarim/palet';
import { IPlus } from './ikonlar';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/** Hazır renkler ve istenen herhangi bir renk; yuvarlak renk kutuları. */
export default function RenkSecici({ label, value, onChange }: Props) {
  const same = (hex: string) => hex.toLowerCase() === value.toLowerCase();
  const custom = !INKS.some((i) => same(i.hex));

  return (
    <>
      <div className="std-colors" role="group" aria-label={label}>
        <label className={`std-color is-custom${custom ? ' is-on' : ''}`} title="Başka renk">
          <span className="sr-only">{label}: başka renk</span>
          {custom ? <i style={{ background: value }} /> : <IPlus size={22} />}
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
        {INKS.map((ink) => (
          <button key={ink.hex} type="button" className="std-color" aria-pressed={same(ink.hex)} aria-label={ink.ad} title={ink.ad} onClick={() => onChange(ink.hex)}>
            <i style={{ background: ink.hex }} />
          </button>
        ))}
      </div>
      {isTooLight(value) && <p className="std-warn" role="status">Bu kadar açık renk baskıda görünmez; beyaz mürekkep yoktur.</p>}
    </>
  );
}
