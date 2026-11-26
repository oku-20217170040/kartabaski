/**
 * Ana sayfa vitrini: arka planı temizlenmiş gerçek ürün fotoğrafları (public/vitrin).
 * Kulp rengi seçilince sayfanın zemin rengi de değişir.
 */

export interface VitrinMug {
  /** public/vitrin altındaki dosya adı (uzantısız). */
  file: string;
  color: string;
  handle: string;
  field: string;
  onField: string;
  width: number;
  height: number;
  /** Gövdenin ve baskı alanının fotoğraf içindeki konumu (0–1). */
  bodyLeft: number;
  bodyRight: number;
  printTop: number;
  printBottom: number;
  /** Baskı satırlarının ortada ne kadar aşağı sarktığı (yüksekliğe oran). */
  sag: number;
}

/** Tüm kulp fotoğrafları aynı tuvale yerleştirildiği için ölçüler ortaktır. */
const FRAME = {
  width: 504,
  height: 420,
  bodyLeft: 0.016,
  bodyRight: 0.73,
  printTop: 0.27,
  printBottom: 0.86,
  sag: 0.036,
};

const LIGHT = '#FFFFFF';
const DARK = '#121214';

export const VITRIN_MUGS: readonly VitrinMug[] = [
  { ...FRAME, file: 'k-mavi', color: 'Mavi', handle: '#1D88B7', field: '#1D47C4', onField: LIGHT },
  { ...FRAME, file: 'k-kirmizi', color: 'Kırmızı', handle: '#C52117', field: '#CF3128', onField: LIGHT },
  { ...FRAME, file: 'k-turuncu', color: 'Turuncu', handle: '#F57F0B', field: '#F26A1B', onField: DARK },
  { ...FRAME, file: 'k-yesil', color: 'Yeşil', handle: '#86C266', field: '#55AE58', onField: DARK },
  { ...FRAME, file: 'k-pembe', color: 'Pembe', handle: '#E85F4D', field: '#F5A9B8', onField: DARK },
  { ...FRAME, file: 'k-koyuyesil', color: 'Koyu yeşil', handle: '#325656', field: '#17493C', onField: LIGHT },
  { ...FRAME, file: 'k-lacivert', color: 'Lacivert', handle: '#333569', field: '#1B2257', onField: LIGHT },
  { ...FRAME, file: 'k-siyah', color: 'Siyah', handle: '#2A292B', field: '#18181B', onField: LIGHT },
];

/** Vitrindeki kupanın katalog kaydı. */
export const VITRIN_PRODUCT_SLUG = 'luks-kupa';

export interface PrintSample {
  file: string;
  label: string;
  tone: 'sun' | 'ink' | 'brand' | 'pink' | 'navy' | 'green' | 'orange' | 'red';
  size?: 'big' | 'wide';
}

/** Sıra, 4 sütunlu mozaikte boşluk kalmayacak şekilde seçildi. */
export const PRINT_SAMPLES: readonly PrintSample[] = [
  { file: 'b-aslan', label: 'Detaylı çizim', tone: 'sun', size: 'big' },
  { file: 'b-creators', label: 'Slogan', tone: 'ink' },
  { file: 'b-geometrik', label: 'Geometrik desen', tone: 'red' },
  { file: 'b-dalga', label: 'Arma', tone: 'pink' },
  { file: 'b-kus', label: 'Çizgi çalışması', tone: 'brand' },
  { file: 'b-gunbatimi', label: 'Boydan boya görsel', tone: 'navy', size: 'wide' },
  { file: 'b-cicek', label: 'Desen', tone: 'green' },
  { file: 'b-cekirdek', label: 'Tek renk simge', tone: 'orange' },
];

export function vitrinOrderText({ text, color, handwriting, hasPhoto }: {
  text: string;
  color: string;
  handwriting: boolean;
  hasPhoto: boolean;
}): string {
  const written = text.trim();
  if (!written && !hasPhoto) {
    return `Merhaba, ${color.toLocaleLowerCase('tr-TR')} kulplu kupaya baskı yaptırmak istiyorum.`;
  }
  const parts = [`Merhaba, ${color.toLocaleLowerCase('tr-TR')} kulplu kupaya baskı istiyorum.`];
  if (written) parts.push(`Yazı: "${written}" (${handwriting ? 'el yazısı' : 'düz yazı'}).`);
  if (hasPhoto) parts.push('Fotoğrafı bu mesajın ardından gönderiyorum.');
  return parts.join(' ');
}
