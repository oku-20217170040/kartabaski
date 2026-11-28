'use client';

import { INKS, isTooLight } from '@/lib/tasarim/palet';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/** Hazır renkler ve istenen herhangi bir renk. */
export default function RenkSecici({ label, value, onChange }: Props) {
  const same = (hex: string) => hex.toLowerCase() === value.toLowerCase();
  const custom = !INKS.some((i) => same(i.hex));

  return (
    <div className="tsk-row">
      <span className="tsk-label">{label}</span>
      <div className="tsc-grid" role="group" aria-label={label}>
        {INKS.map((ink) => (
          <button
            key={ink.hex} type="button" className="tsc-dot" aria-pressed={same(ink.hex)}
            aria-label={ink.ad} title={ink.ad} style={{ background: ink.hex }} onClick={() => onChange(ink.hex)}
          />
        ))}
        <label className={`tsc-dot tsc-custom${custom ? ' is-on' : ''}`} style={custom ? { background: value } : undefined} title="Başka renk">
          <span className="sr-only">{label}: başka renk</span>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
      </div>
      {isTooLight(value) && <p className="tsk-warn" role="status">Bu kadar açık renk baskıda görünmez; beyaz mürekkep yoktur.</p>}
    </div>
  );
}
