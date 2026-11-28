// Süs çizimleri: dosyalar `tools/sus-hazirla.mjs` ile public/suslar altında üretilir.
import type { ShapeSet } from './model';
import { plain } from './yazi-tipleri';

export const shapeUrl = (set: ShapeSet, name: string) => `/suslar/${set}/${name}.svg`;

export interface ShapeList {
  ph: string[];
  fl: Record<string, string[]>;
}

let listJob: Promise<ShapeList> | null = null;

export function loadShapeList(): Promise<ShapeList> {
  listJob ??= fetch('/suslar/liste.json').then((r) => {
    if (!r.ok) throw new Error('süs listesi alınamadı');
    return r.json() as Promise<ShapeList>;
  });
  listJob.catch(() => { listJob = null; });
  return listJob;
}

export const GROUP_LABELS: Record<string, string> = {
  'Smileys & Emotion': 'Yüzler ve kalpler',
  'People & Body': 'İnsanlar',
  'Animals & Nature': 'Hayvan ve doğa',
  'Food & Drink': 'Yiyecek içecek',
  Activities: 'Kutlama ve spor',
  'Travel & Places': 'Gezi ve yerler',
  Objects: 'Eşyalar',
  Symbols: 'Semboller',
  Flags: 'Bayraklar',
};

export const FEATURED_SHAPES: Record<ShapeSet, string[]> = {
  fl: [
    'red-heart', 'sparkling-heart', 'two-hearts', 'heart-with-ribbon', 'revolving-hearts', 'star', 'glowing-star', 'sparkles',
    'birthday-cake', 'balloon', 'wrapped-gift', 'party-popper', 'confetti-ball', 'crown', 'bouquet', 'rose', 'tulip', 'sunflower',
    'cherry-blossom', 'hibiscus', 'four-leaf-clover', 'butterfly', 'cat-face', 'dog-face', 'teddy-bear', 'rabbit-face', 'panda', 'lion',
    'unicorn', 'paw-prints', 'hot-beverage', 'teacup-without-handle', 'graduation-cap', 'books', 'pencil', 'red-apple', 'trophy',
    'sports-medal', 'soccer-ball', 'basketball', 'musical-note', 'guitar', 'rainbow', 'sun', 'crescent-moon', 'cloud', 'snowflake',
    'christmas-tree', 'fire', 'airplane', 'automobile', 'sailboat', 'house', 'smiling-face-with-hearts', 'smiling-face-with-smiling-eyes',
    'face-blowing-a-kiss', 'baby', 'baby-bottle', 'ring', 'anchor',
  ],
  ph: [
    'heart', 'star', 'star-four', 'sparkle', 'flower', 'flower-lotus', 'flower-tulip', 'crown', 'crown-simple', 'cake', 'balloon', 'gift',
    'confetti', 'music-note', 'music-notes', 'paw-print', 'coffee', 'sun', 'moon-stars', 'cloud', 'lightning', 'leaf', 'butterfly', 'trophy',
    'graduation-cap', 'book-open', 'pencil-simple', 'house', 'airplane', 'car', 'soccer-ball', 'fire', 'drop', 'diamond', 'infinity', 'anchor',
    'camera', 'smiley', 'cat', 'dog', 'bird', 'fish', 'tree', 'tree-evergreen', 'snowflake', 'medal', 'rocket', 'hand-heart', 'baby',
    'heartbeat', 'quotes', 'arrow-bend-down-right', 'circle', 'seal', 'shooting-star', 'mountains', 'waves', 'bicycle', 'game-controller',
    'headphones', 'stethoscope', 'tooth', 'scales', 'briefcase', 'wrench', 'scissors', 'paint-brush',
  ],
};

/** Türkçe arama sözcüğü → İngilizce dosya adlarında aranacak parçalar. */
const WORDS: Record<string, string[]> = {
  kalp: ['heart'], ask: ['heart', 'kiss', 'love'], sevgi: ['heart', 'love'], yildiz: ['star', 'sparkle'], cicek: ['flower', 'rose', 'tulip', 'blossom', 'bouquet'],
  gul: ['rose'], lale: ['tulip'], papatya: ['blossom', 'flower'], kedi: ['cat'], kopek: ['dog'], kus: ['bird'], balik: ['fish'], ayi: ['bear'], tavsan: ['rabbit'],
  aslan: ['lion'], at: ['horse'], kelebek: ['butterfly'], hayvan: ['cat', 'dog', 'bear', 'rabbit', 'lion', 'panda', 'paw'], pati: ['paw'],
  'dogum gunu': ['birthday', 'cake', 'balloon', 'party', 'gift', 'confetti'], pasta: ['cake'], balon: ['balloon'], hediye: ['gift'], parti: ['party', 'confetti'],
  tac: ['crown'], muzik: ['music', 'guitar', 'headphone', 'microphone'], kahve: ['coffee', 'hot-beverage', 'teacup'], cay: ['tea'], gunes: ['sun'], ay: ['moon'],
  bulut: ['cloud'], yagmur: ['rain', 'umbrella'], kar: ['snow'], agac: ['tree'], yaprak: ['leaf', 'herb', 'clover'], yonca: ['clover'], doga: ['tree', 'leaf', 'flower', 'mountain'],
  araba: ['car', 'automobile'], ucak: ['airplane', 'plane'], gemi: ['ship', 'boat'], capa: ['anchor'], bisiklet: ['bicycle'], motor: ['motorcycle', 'motor-scooter'],
  ev: ['house', 'home'], okul: ['school', 'graduation', 'student'], ogretmen: ['teacher', 'book', 'pencil', 'apple', 'graduation'], kitap: ['book'], kalem: ['pencil', 'pen'],
  mezuniyet: ['graduation'], futbol: ['soccer', 'football'], basketbol: ['basketball'], voleybol: ['volleyball'], spor: ['ball', 'trophy', 'medal', 'barbell'],
  kupa: ['trophy'], madalya: ['medal'], yuzuk: ['ring'], dugun: ['ring', 'wedding', 'heart', 'bouquet'], bebek: ['baby'], yilbasi: ['christmas', 'snow', 'gift', 'firework'],
  doktor: ['stethoscope', 'health', 'pill', 'syringe', 'tooth', 'heartbeat'], saglik: ['health', 'heartbeat', 'stethoscope'], dis: ['tooth'], bayrak: ['flag'], ates: ['fire', 'flame'],
  su: ['water', 'drop', 'wave'], deniz: ['wave', 'beach', 'shell', 'anchor', 'sailboat'], dag: ['mountain'], kamp: ['camp', 'tent'], yemek: ['pizza', 'hamburger', 'fork', 'cooking'],
  meyve: ['apple', 'banana', 'cherry', 'strawberry', 'watermelon', 'grape', 'lemon'], gulen: ['smil', 'grinning'], yuz: ['face', 'smiley'], ok: ['arrow'], oyun: ['game', 'joystick', 'dice', 'puzzle'],
  bilgisayar: ['computer', 'laptop', 'code'], seyahat: ['luggage', 'suitcase', 'map', 'globe', 'compass', 'airplane'], saat: ['clock', 'watch'], fotograf: ['camera'],
  makas: ['scissors'], boya: ['paint', 'palette'], roket: ['rocket'], gokkusagi: ['rainbow'], elmas: ['diamond', 'gem'], sonsuz: ['infinity'], nazar: ['nazar', 'eye'],
};

/** Boş aramada öne çıkanlar önde, sonra kalanlar. Arama Türkçe ya da İngilizce olabilir. */
export function searchShapes(names: string[], set: ShapeSet, query: string): string[] {
  const q = plain(query);
  if (!q) {
    const have = new Set(names);
    const first = FEATURED_SHAPES[set].filter((n) => have.has(n));
    const shown = new Set(first);
    return [...first, ...names.filter((n) => !shown.has(n))];
  }
  const parts = new Set<string>([q.replace(/\s+/g, '-')]);
  for (const [word, list] of Object.entries(WORDS)) {
    // Kısa sözcükler ("at", "ay", "ev") yalnız tam yazılınca eşleşir.
    if (word === q || (q.length >= 3 && word.startsWith(q))) list.forEach((p) => parts.add(p));
  }
  const wanted = Array.from(parts);
  // Kelime başından eşleşme: "cat" araması "location" getirmesin.
  return names.filter((n) => wanted.some((p) => n.startsWith(p) || n.includes(`-${p}`)));
}
