'use client';

import { useMemo } from 'react';
import Mug3D from '@/components/mug3d/Mug3DLazy';
import { MugModel, READY_PLACEMENT, mugPalette } from '@/lib/mug3d';
import { useReadyPrint } from '@/lib/use-ready-print';
import type { SideId } from '@/lib/design-sides';

interface Props {
  model: MugModel;
  color?: string;
  label: string;
  /** Seçili hazır desenin Cloudinary kimliği. */
  design?: string;
  twoSided: boolean;
  /** Arka yüzdeki hazır desenin Cloudinary kimliği. */
  backDesign?: string;
  view: SideId;
  onView?: (side: SideId) => void;
  onUnsupported: () => void;
}

/** Konfigüratörde seçilen kupa ve desen, döndürülebilir olarak. */
export default function Cup3D({ model, color, label, design, twoSided, backDesign, view, onView, onUnsupported }: Props) {
  const colors = useMemo(() => mugPalette(model, color), [model, color]);
  const photo = useReadyPrint(design);
  const backPhoto = useReadyPrint(twoSided ? backDesign : null);
  return (
    <Mug3D
      model={model}
      colors={colors}
      label={label}
      text=""
      font="duz"
      photo={photo}
      placement={READY_PLACEMENT}
      back={twoSided ? { text: '', font: 'duz', photo: backPhoto, placement: READY_PLACEMENT } : undefined}
      view={view}
      onView={onView}
      onUnsupported={onUnsupported}
    />
  );
}
