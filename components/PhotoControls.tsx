'use client';

import { CloseIcon } from '@/components/icons';
import { DEFAULT_PLACEMENT, MAX_SCALE, MIN_SCALE, Placement, clampPlacement } from '@/lib/photo-layout';

interface Props {
  placement: Placement;
  onChange: (next: Placement) => void;
  removeBg: boolean;
  removing: boolean;
  onToggleBg: () => void;
  onRemove: () => void;
  /** Fotoğraf kupanın üstünde sürüklenemiyorsa ipucu gizlenir. */
  dragHint?: boolean;
}

/** Kupadaki fotoğrafı büyütme, döndürme, ortalama ve arka plan silme düğmeleri. */
export default function PhotoControls({ placement, onChange, removeBg, removing, onToggleBg, onRemove, dragHint = true }: Props) {
  const set = (patch: Partial<Placement>) => onChange(clampPlacement({ ...placement, ...patch }));

  return (
    <div className="foto">
      {dragHint && <p className="foto-ipucu">Fotoğrafı kupanın üstünde sürükleyerek taşıyın.</p>}

      <div className="foto-boyut">
        <button type="button" className="vitrin-tool foto-kare" aria-label="Küçült" onClick={() => set({ scale: placement.scale / 1.15 })}>−</button>
        <input
          type="range"
          aria-label="Fotoğraf boyutu"
          min={MIN_SCALE * 100}
          max={MAX_SCALE * 100}
          value={Math.round(placement.scale * 100)}
          onChange={(e) => set({ scale: Number(e.target.value) / 100 })}
        />
        <button type="button" className="vitrin-tool foto-kare" aria-label="Büyüt" onClick={() => set({ scale: placement.scale * 1.15 })}>+</button>
      </div>

      <div className="foto-dugmeler">
        <button type="button" className="vitrin-tool foto-arka" aria-pressed={removeBg} disabled={removing} onClick={onToggleBg}>
          {removing ? 'Arka plan siliniyor…' : removeBg ? 'Arka planı geri getir' : 'Arka planı kaldır'}
        </button>
        <button type="button" className="vitrin-tool foto-kare" onClick={() => set({ rotate: placement.rotate - 15 })} aria-label="Sola döndür" title="Sola döndür">↺</button>
        <button type="button" className="vitrin-tool foto-kare" onClick={() => set({ rotate: placement.rotate + 15 })} aria-label="Sağa döndür" title="Sağa döndür">↻</button>
        <button type="button" className="vitrin-tool" onClick={() => onChange(DEFAULT_PLACEMENT)}>Ortala</button>
        <button type="button" className="vitrin-tool foto-kare" onClick={onRemove} aria-label="Fotoğrafı kaldır" title="Fotoğrafı kaldır"><CloseIcon size={20} /></button>
      </div>
    </div>
  );
}
