// Fotoğrafın baskıda ne kadar net çıkacağı (inç başına gerçek piksel).
import type { MugModel } from '../mug3d';

/** Kupa gövdesinin gerçek çapı (mm); model ölçüleri çapa oranlıdır. */
export const MUG_DIAMETER_MM = 82;

export const printWidthMm = (m: Pick<MugModel, 'radius' | 'print'>) => m.radius * m.print.angle * MUG_DIAMETER_MM;

export type Sharpness = 'iyi' | 'orta' | 'zayif';

/**
 * @param sourcePx Fotoğraftan kullanılan parçanın piksel genişliği.
 * @param share Bu parçanın baskı alanı genişliğine oranı.
 */
export function dpiOf(sourcePx: number, share: number, widthMm: number): number {
  const inches = (share * widthMm) / 25.4;
  return inches > 0 ? sourcePx / inches : Infinity;
}

export const sharpness = (dpi: number): Sharpness => (dpi < 90 ? 'zayif' : dpi < 140 ? 'orta' : 'iyi');

export const SHARPNESS_TEXT: Record<Exclude<Sharpness, 'iyi'>, string> = {
  zayif: 'Bu fotoğraf bu boyutta bulanık basılır. Küçültün ya da daha büyük bir fotoğraf yükleyin.',
  orta: 'Bu fotoğraf bu boyutta biraz yumuşak çıkabilir. Küçültürseniz netleşir.',
};
