'use client';

import type { Layer } from '@/lib/tasarim/model';
import {
  ICheck, ICopy, ICrop, ICurve, IEffect, IFilter, IFont, IFrame, IKeyboard, IOpacity, IPalette, IPattern, IPosition,
  IRotate, IShapes, ISize, ISwap, ITrash, IWand,
} from './ikonlar';
import type { Tool } from './turler';

interface Props {
  layer: Layer;
  tool: Tool | null;
  onTool: (tool: Tool) => void;
  cutting: boolean;
  onToggleCut: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDone: () => void;
}

interface Item { id: string; label: string; icon: React.ReactNode; tool?: Tool; run?: () => void; pressed?: boolean; disabled?: boolean; danger?: boolean }

/** Seçili öğenin simge düğmeleri (telefonda alt çubuk, masaüstünde tuvalin üstü). */
export default function AracCubugu({ layer, tool, onTool, cutting, onToggleCut, onDuplicate, onRemove, onDone }: Props) {
  const swatch = (hex: string) => <i className="std-dot" style={{ background: hex }} />;
  const t = (id: Tool, label: string, icon: React.ReactNode): Item => ({ id, label, icon, tool: id });
  const common = [t('boyut', 'Boyut', <ISize />), t('dondur', 'Döndür', <IRotate />), t('konum', 'Konum', <IPosition />)];

  const items: Item[] = layer.kind === 'text' ? [
    t('metin', 'Yazı', <IKeyboard />), t('font', 'Yazı tipi', <IFont />), t('renk', 'Renk', swatch(layer.color)),
    t('efekt', 'Efekt', <IEffect />), t('kavis', 'Kavis', <ICurve />), ...common,
  ] : layer.kind === 'photo' ? [
    t('sekil', 'Şekil', <IShapes />),
    { id: 'kes', label: cutting ? 'Siliniyor' : 'Arka plan', icon: <IWand />, run: onToggleCut, pressed: Boolean(layer.cut), disabled: cutting },
    t('filtre', 'Filtre', <IFilter />), t('kirp', 'Kırp', <ICrop />),
    ...(layer.shape === 'soft' ? [] : [t('kenarlik', 'Kenarlık', <IFrame />)]), ...common,
  ] : layer.kind === 'shape' ? [
    t('degistir', 'Değiştir', <ISwap />), ...(layer.set === 'ph' ? [t('renk', 'Renk', swatch(layer.color))] : []), ...common,
  ] : [
    t('icerik', 'İçerik', <IPattern />), ...(layer.text?.trim() ? [t('font', 'Yazı tipi', <IFont />)] : []),
    ...(layer.text?.trim() || layer.set === 'ph' ? [t('renk', 'Renk', swatch(layer.color))] : []),
    t('siklik', 'Sıklık', <ISize />), t('dondur', 'Açı', <IRotate />), t('belirgin', 'Belirginlik', <IOpacity />),
  ];

  if (layer.kind === 'text' || layer.kind === 'shape') items.push({ id: 'cogalt', label: 'Çoğalt', icon: <ICopy />, run: onDuplicate });
  items.push({ id: 'sil', label: 'Sil', icon: <ITrash />, run: onRemove, danger: true });

  return (
    <div className="std-context" role="toolbar" aria-label="Seçili öğenin araçları">
      <button type="button" className="std-tool is-done" onClick={onDone}><ICheck /><span>Tamam</span></button>
      <div className="std-context-scroll">
        {items.map((item) => (
          <button
            key={item.id} type="button" className={`std-tool${item.danger ? ' is-danger' : ''}`}
            aria-pressed={item.tool ? tool === item.tool : item.pressed} disabled={item.disabled}
            onClick={() => (item.tool ? onTool(item.tool) : item.run?.())}
          >
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
