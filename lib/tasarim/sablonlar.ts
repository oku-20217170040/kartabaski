// Tek dokunuşla uygulanan hazır düzenler. Metinler örnektir; müşteri kendi yazısıyla değiştirir.
import { Layer, PhotoShape, addLayer, patternLayer, shapeLayer, textLayer } from './model';

export interface Template {
  id: string;
  ad: string;
  grup: string;
  /** Her uygulamada yeni kimlikli katmanlar üretir. */
  make: () => Layer[];
  /** Fotoğraf varsa (ya da sonradan eklenirse) oturacağı yer. */
  photo?: { x: number; y: number; s: number; shape: PhotoShape; border?: string; crop?: number };
}

const text = (t: string, font: string, x: number, y: number, s: number, color = '#17171A', more: object = {}) =>
  textLayer({ text: t, font, x, y, s, color, ...more });
const fl = (name: string, x: number, y: number, s: number, r = 0) => shapeLayer('fl', name, { x, y, s, r });
const ph = (name: string, x: number, y: number, s: number, color: string, r = 0) => shapeLayer('ph', name, { x, y, s, color, r });

export const TEMPLATES: Template[] = [
  {
    id: 'dogum-gunu', ad: 'Doğum günü', grup: 'Doğum günü',
    make: () => [
      text('İyi ki doğdun', 'pacifico', 0.54, 0.36, 0.17, '#CF3128'),
      text('ELİF', 'bebas-neue', 0.5, 0.72, 0.3, '#1B2257'),
      fl('balloon', 0.07, 0.22, 0.3, -12), fl('birthday-cake', 0.88, 0.72, 0.32), fl('party-popper', 0.13, 0.76, 0.26),
    ],
  },
  {
    id: 'yas', ad: 'Yaş günü sayısı', grup: 'Doğum günü',
    make: () => [
      text('25', 'alfa-slab-one', 0.5, 0.42, 0.56, '#1D47C4', { fx: 'shadow', fxColor: '#F2B200' }),
      text('yaşın kutlu olsun Mert', 'caveat', 0.5, 0.84, 0.17),
      fl('confetti-ball', 0.12, 0.28, 0.28), fl('wrapped-gift', 0.88, 0.3, 0.28, 8),
    ],
  },
  {
    id: 'dogum-foto', ad: 'Fotoğraflı kutlama', grup: 'Doğum günü',
    photo: { x: 0.26, y: 0.5, s: 0.76, shape: 'circle', border: '#F2B200', crop: 1 },
    make: () => [
      text('İyi ki\nvarsın', 'dancing-script', 0.76, 0.4, 0.2, '#7A1226', { bold: true }),
      text('12 Mayıs', 'montserrat', 0.76, 0.8, 0.1, '#17171A', { bold: true }),
      fl('sparkles', 0.92, 0.14, 0.2),
    ],
  },
  {
    id: 'sevgili', ad: 'İki isim', grup: 'Sevgili ve çift',
    make: () => [
      text('Ayşe', 'great-vibes', 0.24, 0.45, 0.26, '#7A1226'),
      fl('red-heart', 0.5, 0.46, 0.24),
      text('Can', 'great-vibes', 0.76, 0.45, 0.26, '#7A1226'),
      text('14.02.2021', 'cormorant-garamond', 0.5, 0.82, 0.13, '#17171A', { bold: true }),
    ],
  },
  {
    id: 'sevgili-foto', ad: 'Kalp içinde fotoğraf', grup: 'Sevgili ve çift',
    photo: { x: 0.5, y: 0.4, s: 0.74, shape: 'heart', border: '#CF3128' },
    make: () => [text('Seni çok seviyorum', 'sacramento', 0.5, 0.87, 0.2, '#CF3128'), fl('two-hearts', 0.12, 0.32, 0.22, -10), fl('sparkling-heart', 0.88, 0.5, 0.2, 10)],
  },
  {
    id: 'kalpli-desen', ad: 'Kalpli desen', grup: 'Sevgili ve çift',
    make: () => [
      patternLayer({ set: 'ph', name: 'heart', color: '#F28FAE', s: 0.24, opacity: 0.55 }),
      text('Bir ömür', 'allura', 0.5, 0.5, 0.36, '#7A1226', { fx: 'outline', fxColor: '#F28FAE' }),
    ],
  },
  {
    id: 'anne', ad: 'Annem', grup: 'Anne ve baba',
    make: () => [
      text('Dünyanın en güzel', 'cormorant-garamond', 0.5, 0.24, 0.13, '#17171A', { bold: true }),
      text('Annesi', 'parisienne', 0.5, 0.55, 0.34, '#E0306E'),
      text('seni seviyoruz', 'montserrat', 0.5, 0.85, 0.09, '#6B6B73'),
      fl('bouquet', 0.1, 0.62, 0.36, -10), fl('tulip', 0.91, 0.6, 0.32, 12),
    ],
  },
  {
    id: 'baba', ad: 'Babam', grup: 'Anne ve baba',
    make: () => [
      text('SÜPER', 'anton', 0.5, 0.32, 0.26, '#1B2257'),
      text('BABA', 'anton', 0.5, 0.7, 0.34, '#CF3128'),
      ph('star', 0.1, 0.5, 0.24, '#F2B200'), ph('star', 0.9, 0.5, 0.24, '#F2B200'),
    ],
  },
  {
    id: 'aile-foto', ad: 'Aile fotoğrafı', grup: 'Anne ve baba',
    photo: { x: 0.5, y: 0.4, s: 0.76, shape: 'rounded' },
    make: () => [text('Bizim aile', 'caveat', 0.5, 0.88, 0.18, '#17493C', { bold: true })],
  },
  {
    id: 'ogretmen', ad: 'Öğretmenim', grup: 'Öğretmen ve okul',
    make: () => [
      text('Sevgili', 'caveat', 0.5, 0.22, 0.16, '#1D47C4', { bold: true }),
      text('Öğretmenim', 'lobster', 0.5, 0.52, 0.25, '#CF3128'),
      text('iyi ki varsınız', 'patrick-hand', 0.5, 0.83, 0.13),
      fl('red-apple', 0.09, 0.3, 0.26), fl('books', 0.91, 0.74, 0.28),
    ],
  },
  {
    id: 'mezuniyet', ad: 'Mezuniyet', grup: 'Öğretmen ve okul',
    make: () => [
      fl('graduation-cap', 0.5, 0.2, 0.34),
      text('Mezun oldum', 'playfair-display', 0.5, 0.55, 0.2, '#1B2257', { bold: true }),
      text('Deniz Yılmaz · 2027', 'montserrat', 0.5, 0.83, 0.11),
    ],
  },
  {
    id: 'isim', ad: 'İsim', grup: 'İsim ve yazı',
    make: () => [text('Zeynep', 'dancing-script', 0.5, 0.47, 0.4, '#17171A', { bold: true }), ph('arrow-bend-down-right', 0.12, 0.74, 0.18, '#F26A1B'), ph('sparkle', 0.88, 0.24, 0.2, '#F2B200')],
  },
  {
    id: 'bas-harf', ad: 'Baş harf', grup: 'İsim ve yazı',
    make: () => [
      text('M', 'abril-fatface', 0.5, 0.42, 0.68, '#17493C'),
      text('MERVE', 'cinzel', 0.5, 0.86, 0.12, '#17171A', { bold: true }),
      fl('hibiscus', 0.3, 0.24, 0.22), fl('cherry-blossom', 0.7, 0.62, 0.2),
    ],
  },
  {
    id: 'yay', ad: 'Yaylı yazı', grup: 'İsim ve yazı',
    make: () => [
      text('GÜNE GÜZEL BAŞLA', 'righteous', 0.5, 0.22, 0.14, '#F26A1B', { curve: 38 }),
      fl('sun', 0.5, 0.55, 0.36),
      text('her sabah', 'pacifico', 0.5, 0.85, 0.13, '#1B2257', { curve: -22 }),
    ],
  },
  {
    id: 'kahve', ad: 'Önce kahve', grup: 'İsim ve yazı',
    make: () => [
      text('ÖNCE', 'oswald', 0.34, 0.3, 0.2, '#6B4226', { bold: true }),
      text('KAHVE', 'oswald', 0.34, 0.66, 0.32, '#17171A', { bold: true }),
      fl('hot-beverage', 0.82, 0.5, 0.56),
    ],
  },
  {
    id: 'evcil', ad: 'Patili dostum', grup: 'Evcil dost',
    photo: { x: 0.26, y: 0.5, s: 0.76, shape: 'circle', border: '#F26A1B', crop: 1 },
    make: () => [text('Pamuk', 'baloo-2', 0.76, 0.48, 0.2, '#F26A1B', { bold: true }), text('evin patronu', 'patrick-hand', 0.76, 0.74, 0.11), fl('paw-prints', 0.89, 0.18, 0.24, 15)],
  },
  {
    id: 'bebek', ad: 'Yeni bebek', grup: 'Bebek',
    photo: { x: 0.26, y: 0.5, s: 0.76, shape: 'rounded', crop: 1 },
    make: () => [text('Hoş geldin', 'kalam', 0.76, 0.26, 0.13, '#1D9BD8', { bold: true }), text('Defne', 'pacifico', 0.76, 0.54, 0.2, '#E0306E'), text('3 kg 200 g · 50 cm', 'montserrat', 0.76, 0.82, 0.075), fl('baby-bottle', 0.93, 0.12, 0.18, 18)],
  },
  {
    id: 'yilbasi', ad: 'Yeni yıl', grup: 'Özel günler',
    make: () => [
      patternLayer({ set: 'ph', name: 'snowflake', color: '#1D9BD8', s: 0.24, opacity: 0.35 }),
      text('Mutlu Yıllar', 'berkshire-swash', 0.5, 0.45, 0.28, '#CF3128'),
      text('2027', 'cinzel', 0.5, 0.78, 0.17, '#17493C', { bold: true }),
      fl('christmas-tree', 0.08, 0.7, 0.34),
    ],
  },
  {
    id: 'kurumsal', ad: 'Logo ve firma adı', grup: 'Kurumsal',
    photo: { x: 0.5, y: 0.37, s: 0.62, shape: 'plain' },
    make: () => [text('FİRMA ADI', 'montserrat', 0.5, 0.78, 0.14, '#17171A', { bold: true }), text('www.firmaniz.com', 'montserrat', 0.5, 0.92, 0.08, '#6B6B73')],
  },
  {
    id: 'arkadas', ad: 'En iyi arkadaş', grup: 'Arkadaşlık',
    photo: { x: 0.74, y: 0.5, s: 0.78, shape: 'hexagon', crop: 0.9 },
    make: () => [text('En iyi\narkadaşım', 'caveat-brush', 0.28, 0.46, 0.2, '#6A2C91'), fl('sparkles', 0.08, 0.14, 0.2), fl('four-leaf-clover', 0.28, 0.85, 0.18)],
  },
];

export const TEMPLATE_GROUPS = Array.from(new Set(TEMPLATES.map((t) => t.grup)));

/**
 * Düzeni uygular: yazı, süs ve desen yenilenir; müşterinin fotoğrafları kalır.
 * Düzenin fotoğraf yeri varsa ilk fotoğraf oraya oturur.
 */
export function applyTemplate(current: Layer[], template: Template): Layer[] {
  const photos = current.filter((l) => l.kind === 'photo');
  const slot = template.photo;
  const placed = photos.map((p, i) => (i === 0 && slot
    ? { ...p, x: slot.x, y: slot.y, s: slot.s, r: 0, shape: slot.shape, border: slot.border, crop: slot.crop, box: undefined }
    : p));
  return template.make().reduce<Layer[]>((list, layer) => addLayer(list, layer), placed);
}
