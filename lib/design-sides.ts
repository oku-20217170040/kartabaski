// Kupanın baskı yüzleri: istemci ve sunucu ortak (saf).
import type { DesignSide } from './cart-types';
import { countShapes } from './tasarim/model';

export type SideId = 'front' | 'back';

export const SIDES: SideId[] = ['front', 'back'];
export const SIDE_LABELS: Record<SideId, string> = { front: 'Ön yüz', back: 'Arka yüz' };
/** Yüzü tarif eden ipucu: kupa tutulurken kulbun durduğu yön. */
export const SIDE_HINTS: Record<SideId, string> = { front: 'kulp sağda', back: 'kulp solda' };

/** Sepet satırındaki bir yüzün kısa özeti. */
export function sideSummary(s: DesignSide): string {
  return [
    s.ready ? `hazır tasarım: ${s.ready.name}` : '',
    s.text ? `yazı: ${s.text}` : '',
    s.photos.length ? `${s.photos.length} fotoğraf` : '',
    countShapes(s.layers) ? `${countShapes(s.layers)} süs` : '',
    s.removeBg ? 'arka plan silinecek' : '',
  ].filter(Boolean).join(' · ');
}
