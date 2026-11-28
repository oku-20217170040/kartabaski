// Panellerde resim olarak gösterilen hazır yazı stilleri ve desenler.
import { PatternLayer, TextLayer, patternLayer } from './model';

export interface TextStyle {
  id: string;
  ad: string;
  /** Küçük resimde ve eklendiğinde görünen örnek yazı. */
  text: string;
  patch: Partial<TextLayer>;
}

export const TEXT_STYLES: TextStyle[] = [
  { id: 'baslik', ad: 'Büyük başlık', text: 'SÜPER', patch: { font: 'bebas-neue', color: '#1B2257' } },
  { id: 'neseli', ad: 'Neşeli', text: 'İyi ki', patch: { font: 'pacifico', color: '#CF3128' } },
  { id: 'zarif', ad: 'Zarif', text: 'Sevgiyle', patch: { font: 'great-vibes', color: '#7A1226' } },
  { id: 'golgeli', ad: 'Gölgeli', text: 'BRAVO', patch: { font: 'alfa-slab-one', color: '#1D47C4', fx: 'shadow', fxColor: '#F2B200' } },
  { id: 'cerceveli', ad: 'Çerçeveli', text: 'Harika!', patch: { font: 'bangers', color: '#F26A1B', fx: 'outline', fxColor: '#1B2257' } },
  { id: 'yayli', ad: 'Yaylı', text: 'GÜNAYDIN', patch: { font: 'righteous', color: '#2E8B3D', curve: 45 } },
  { id: 'klasik', ad: 'Klasik', text: 'Annem', patch: { font: 'playfair-display', bold: true, color: '#17171A' } },
  { id: 'daktilo', ad: 'Daktilo', text: 'Not: kahve', patch: { font: 'special-elite', color: '#6B4226' } },
  { id: 'sevimli', ad: 'Sevimli', text: 'Minnoş', patch: { font: 'baloo-2', bold: true, color: '#E0306E', fx: 'shadow', fxColor: '#F28FAE' } },
  { id: 'isikli', ad: 'Işıklı tabela', text: 'PARTİ', patch: { font: 'monoton', color: '#6A2C91' } },
  { id: 'firca', ad: 'Fırça', text: 'Özgür ruh', patch: { font: 'caveat-brush', color: '#0F9D8F' } },
  { id: 'imza', ad: 'İmza', text: 'Ayşe', patch: { font: 'sacramento', color: '#17171A' } },
];

/** Düz "Yazı ekle" düğmeleri. */
export const TEXT_BASICS: TextStyle[] = [
  { id: 'duz', ad: 'Yazı ekle', text: 'Yazınız', patch: { font: 'duz' } },
  { id: 'el', ad: 'El yazısı ekle', text: 'Yazınız', patch: { font: 'el' } },
];

export interface PatternStyle {
  id: string;
  ad: string;
  patch: Partial<PatternLayer>;
}

export const PATTERN_STYLES: PatternStyle[] = [
  { id: 'kalp', ad: 'Pembe kalpler', patch: { set: 'ph', name: 'heart', color: '#E0306E', opacity: 0.45 } },
  { id: 'renkli-kalp', ad: 'Kırmızı kalpler', patch: { set: 'fl', name: 'red-heart', opacity: 0.9, s: 0.24 } },
  { id: 'yildiz', ad: 'Yıldızlar', patch: { set: 'ph', name: 'star', color: '#F2B200', opacity: 0.7 } },
  { id: 'pati', ad: 'Patiler', patch: { set: 'ph', name: 'paw-print', color: '#1B2257', opacity: 0.3 } },
  { id: 'cicek', ad: 'Çiçekler', patch: { set: 'fl', name: 'cherry-blossom', opacity: 0.8 } },
  { id: 'kar', ad: 'Kar taneleri', patch: { set: 'ph', name: 'snowflake', color: '#1D9BD8', opacity: 0.4 } },
  { id: 'kahve', ad: 'Kahve keyfi', patch: { set: 'ph', name: 'coffee', color: '#6B4226', opacity: 0.35 } },
  { id: 'muzik', ad: 'Notalar', patch: { set: 'ph', name: 'music-notes', color: '#6A2C91', opacity: 0.4 } },
  { id: 'balon', ad: 'Balonlar', patch: { set: 'fl', name: 'balloon', opacity: 0.75 } },
  { id: 'yonca', ad: 'Yoncalar', patch: { set: 'fl', name: 'four-leaf-clover', opacity: 0.6 } },
  { id: 'gunes', ad: 'Güneşler', patch: { set: 'ph', name: 'sun', color: '#F26A1B', opacity: 0.4 } },
  { id: 'isim', ad: 'İsminizle', patch: { text: 'İsim', font: 'caveat', color: '#1D47C4', opacity: 0.4 } },
];

export const patternFrom = (style: PatternStyle): PatternLayer => patternLayer(style.patch);
