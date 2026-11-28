// Baskıda seçilebilen hazır renkler. Süblimasyonda beyaz mürekkep yoktur.
export const INKS: { ad: string; hex: string }[] = [
  { ad: 'Siyah', hex: '#17171A' },
  { ad: 'Gri', hex: '#6B6B73' },
  { ad: 'Lacivert', hex: '#1B2257' },
  { ad: 'Mavi', hex: '#1D47C4' },
  { ad: 'Gök mavisi', hex: '#1D9BD8' },
  { ad: 'Turkuaz', hex: '#0F9D8F' },
  { ad: 'Yeşil', hex: '#2E8B3D' },
  { ad: 'Koyu yeşil', hex: '#17493C' },
  { ad: 'Sarı', hex: '#F2B200' },
  { ad: 'Altın tonu', hex: '#B8860B' },
  { ad: 'Turuncu', hex: '#F26A1B' },
  { ad: 'Kırmızı', hex: '#CF3128' },
  { ad: 'Bordo', hex: '#7A1226' },
  { ad: 'Koyu pembe', hex: '#E0306E' },
  { ad: 'Pembe', hex: '#F28FAE' },
  { ad: 'Mor', hex: '#6A2C91' },
  { ad: 'Lila', hex: '#9C7FD1' },
  { ad: 'Kahverengi', hex: '#6B4226' },
];

/** Beyaz kupada seçilemeyecek kadar açık renk (baskıda görünmez). */
export function isTooLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const luminance = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return luminance > 0.86;
}
