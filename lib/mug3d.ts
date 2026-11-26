/**
 * Üç boyutlu kupa tanımları (three.js'ten bağımsız, testli).
 * Birim: gövde çapı = 1. Ölçüler ürün fotoğrafından oranlanmıştır.
 */

export type MugModelId = 'luks';

export interface MugModel {
  id: MugModelId;
  radius: number;
  height: number;
  /** Kulbun orta çizgisi: eksenden uzaklık (x) ve tabandan yükseklik (y). */
  handle: [number, number][];
  handleThickness: number;
  /** Baskı alanı: ön yüzü saran açı (radyan), yükseklik ve merkezin tabandan yüksekliği. */
  print: { angle: number; height: number; centerY: number };
}

export const MUG_MODELS: Record<MugModelId, MugModel> = {
  luks: {
    id: 'luks',
    radius: 0.5,
    height: 0.95,
    handle: [
      [0.47, 0.79], [0.56, 0.845], [0.66, 0.875], [0.745, 0.865], [0.79, 0.81], [0.815, 0.66],
      [0.845, 0.45], [0.85, 0.33], [0.815, 0.265], [0.72, 0.225], [0.6, 0.185], [0.47, 0.165],
    ],
    handleThickness: 0.037,
    print: { angle: 2.1, height: 0.69, centerY: 0.46 },
  },
};

/** Baskı şablonunun piksel boyutu: yay uzunluğu / yükseklik oranını korur. */
export function printSize(model: MugModel, width = 1200) {
  const arc = model.radius * model.print.angle;
  return { width, height: Math.round((width * model.print.height) / arc) };
}

/** Sepete kaydedilen kupa görüntüsünün zemini. */
export const SNAPSHOT_BACKGROUND = '#EFEFEC';

/** Hazır desen kupaya bu yerleşimle basılmış gösterilir. */
export const READY_PLACEMENT = { x: 0, y: 0, scale: 0.8, rotate: 0 };

export interface MugColors { body: string; inner: string; handle: string }

const CREAM = { body: '#EFEADF', inner: '#E6DECD' };
const WHITE = { body: '#E9ECEE', inner: '#E2E6E8' };

const HANDLES: Record<string, string> = {
  'sarı': '#F5C400',
  'koyu yeşil': '#23514C',
  mavi: '#1D88B7',
  siyah: '#201F22',
  turuncu: '#F27A0C',
  'kırmızı': '#C0221A',
  pembe: '#E8604C',
  'yeşil': '#80C25E',
  lacivert: '#2A2D66',
};

/** Katalogdaki renk adından kupa renkleri; bilinmeyen ve "Beyaz" düz beyazdır. */
export function mugPalette(color?: string): MugColors {
  const key = (color ?? '').trim().toLocaleLowerCase('tr-TR');
  if (key === 'transparan') return { ...CREAM, handle: '#F4F1E9' };
  const handle = HANDLES[key];
  return handle ? { ...CREAM, handle } : { ...WHITE, handle: WHITE.body };
}

/** Ürün ya da konfigüratör bardağı için hazır üç boyutlu model (yoksa null). */
export function mugModelFor(slug: string, title: string): MugModel | null {
  const name = title.toLocaleLowerCase('tr-TR').replace(/ü/g, 'u');
  return slug === 'luks-kupa' || name.startsWith('luks kupa') ? MUG_MODELS.luks : null;
}
