/**
 * Üç boyutlu kupa tanımları (three.js'ten bağımsız, testli).
 * Birim: gövde çapı = 1. Ölçüler ürün fotoğraflarından piksel olarak alınıp çapa oranlanır.
 */

export type MugModelId =
  | 'luks' | 'kahve' | 'latte' | 'pro' | 'seramik' | 'buyuk' | 'sihirli' | 'tabakli' | 'porselen' | 'motto' | 'afilli';

/**
 * Rengin nereye gittiği: `handle` kulp, `band` alt bant ve kulbun altı, `accent` kulp ve iç yüzey,
 * `saucer` tabak, `plain` renksiz, `magic` sıcakken beyaza dönen siyah.
 */
export type Finish = 'handle' | 'band' | 'accent' | 'saucer' | 'plain' | 'magic';

/** Kulbun bir parçası: orta çizgi (x: eksenden uzaklık, y: yükseklik) boyunca boru. */
export interface Tube {
  path: [number, number][];
  radius: number;
  /** Derinlik yönünde genişletme (yassı kulplar için). */
  depth: number;
  /** Borunun başında / sonunda gövde renginde kalan oran. */
  from?: number;
  to?: number;
  /** Uçlar yuvarlatılır (gövdeye değmeyen parçalar). */
  caps?: boolean;
}

export interface MugModel {
  id: MugModelId;
  finish: Finish;
  radius: number;
  height: number;
  /** Taban: ayak yarıçapı, ayak yüksekliği ve gövdenin düzleştiği yükseklik. */
  base: { radius: number; foot: number; rise: number };
  tubes: Tube[];
  /** Baskı alanı: ön yüzü saran açı (radyan), yükseklik ve merkezin tabandan yüksekliği. */
  print: { angle: number; height: number; centerY: number };
  /** Renkli alt bandın yüksekliği (`band`). */
  band?: number;
  saucer?: { radius: number; height: number; seat: number };
  /** Gövde krem sır mı (beyaz porselen değil). */
  cream: boolean;
  /** Renk adından (küçük harf) renk. */
  colors: Record<string, string>;
}

const RADIUS = 0.5;
const FLAT = { radius: 0.455, foot: 0.004, rise: 0.05 };

/** Fotoğraf ölçüsü: gövdenin sol/sağ kenarı, ağız ve taban elipslerinin merkez yüksekliği (piksel). */
function measure(left: number, right: number, top: number, bottom: number) {
  const d = right - left;
  const center = (left + right) / 2;
  return {
    height: (bottom - top) / d,
    r: (px: number) => px / d,
    /** `open` verilmezse yolun iki ucu gövdenin içine sokulur. */
    path: (points: [number, number][], ends: 'both' | 'start' | 'none' = 'both') => points.map(([x, y], i): [number, number] => {
      const joined = (ends !== 'none' && i === 0) || (ends === 'both' && i === points.length - 1);
      const u = Math.abs(x - center) / d;
      return [joined ? Math.min(u, RADIUS - 0.03) : u, (bottom - y) / d];
    }),
  };
}

/** Baskı alanı: alttan `low`, ağızdan `high` kadar boşluk bırakır. */
const area = (height: number, low = 0.115, high = 0.1) => ({ angle: 2.1, height: height - low - high, centerY: low + (height - low - high) / 2 });

const CREAMWARE: Record<string, string> = {
  'sarı': '#F2C60C', 'koyu yeşil': '#23463F', mavi: '#1D84B8', siyah: '#201F22', turuncu: '#F2690F',
  'kırmızı': '#C4281E', pembe: '#E86C5E', 'yeşil': '#7CBD66', lacivert: '#23244A',
  'pastel yeşil': '#BFD4BC', 'pastel mavi': '#BCD8EA', 'pastel pembe': '#EAB9B6', 'pembe pastel': '#EAB9B6', 'pastel sarı': '#E6E2A0',
};
const PORCELAIN: Record<string, string> = {
  siyah: '#151418', 'kırmızı': '#D5150F', turuncu: '#EE4A00', mavi: '#008FD3', mor: '#2E0A3C', 'sarı': '#E9B314', lila: '#8D83B0',
};

function model(id: MugModelId, finish: Finish, m: ReturnType<typeof measure>, tubes: Tube[], extra: Partial<MugModel> = {}): MugModel {
  return {
    id, finish, radius: RADIUS, height: m.height, base: FLAT, tubes, print: area(m.height),
    cream: false, colors: PORCELAIN, ...extra,
  };
}

const luks: MugModel = {
  id: 'luks',
  finish: 'handle',
  radius: RADIUS,
  height: 0.95,
  base: FLAT,
  tubes: [{
    path: [
      [0.47, 0.79], [0.56, 0.845], [0.66, 0.875], [0.745, 0.865], [0.79, 0.81], [0.815, 0.66],
      [0.845, 0.45], [0.85, 0.33], [0.815, 0.265], [0.72, 0.225], [0.6, 0.185], [0.47, 0.165],
    ],
    radius: 0.037, depth: 1.35, from: 0.12, to: 0.12,
  }],
  print: { angle: 2.1, height: 0.69, centerY: 0.46 },
  cream: true,
  colors: {
    ...CREAMWARE,
    'sarı': '#F5C400', 'koyu yeşil': '#23514C', mavi: '#1D88B7', turuncu: '#F27A0C', 'kırmızı': '#C0221A', pembe: '#E8604C', 'yeşil': '#80C25E', lacivert: '#2A2D66',
  },
};

function kahve(): MugModel {
  const m = measure(22, 515, 57, 405);
  const path = m.path([[505, 170], [540, 168], [585, 170], [612, 176], [621, 196], [617, 250], [611, 305], [601, 326], [575, 332], [540, 328], [505, 325]]);
  return model('kahve', 'handle', m, [{ path, radius: m.r(16), depth: 1.5, from: 0.1, to: 0.1 }], { cream: true, colors: CREAMWARE });
}

function latte(): MugModel {
  const m = measure(28, 490, 55, 480);
  return model('latte', 'handle', m, [
    { path: m.path([[484, 272], [535, 275], [592, 275]], 'start'), radius: m.r(25), depth: 1.1, from: 0.3 },
    { path: m.path([[597, 157], [598, 275], [597, 398]], 'none'), radius: m.r(31), depth: 1, caps: true },
  ], { cream: true, colors: CREAMWARE, base: { radius: 0.39, foot: 0.05, rise: 0.15 }, print: area(m.height, 0.18) });
}

function pro(): MugModel {
  const m = measure(28, 486, 38, 565);
  const path = m.path([[478, 137], [520, 112], [575, 106], [622, 122], [647, 165], [652, 240], [652, 330], [642, 392], [612, 430], [572, 444], [532, 434], [478, 400]]);
  return model('pro', 'band', m, [{ path, radius: m.r(16), depth: 1.25 }], {
    cream: true,
    colors: { ...CREAMWARE, 'koyu yeşil': '#17302E', 'yeşil': '#54A04A', 'sarı': '#F0CD02', turuncu: '#E85A14' },
    base: { radius: 0.32, foot: 0.045, rise: 0.3 },
    band: 0.43,
    print: area(m.height, 0.47, 0.08),
  });
}

function seramik(): MugModel {
  const m = measure(210, 450, 42, 278);
  const path = m.path([[446, 117], [476, 109], [502, 119], [518, 139], [521, 160], [514, 183], [496, 200], [471, 208], [446, 204]]);
  return model('seramik', 'plain', m, [{ path, radius: m.r(11), depth: 1.15 }], {
    base: { radius: 0.4, foot: 0.06, rise: 0.17 }, print: area(m.height, 0.19),
  });
}

/** Büyük Beyaz Kupa ile Sihirli Kupa aynı kalıpta, kulpları C biçiminde. */
function buyuk(): MugModel {
  const m = measure(25, 450, 45, 545);
  const path = m.path([[443, 158], [482, 148], [532, 160], [575, 196], [603, 250], [613, 320], [598, 390], [562, 440], [510, 464], [472, 461], [443, 445]]);
  return model('buyuk', 'plain', m, [{ path, radius: m.r(17), depth: 1.35 }], { print: area(m.height, 0.12, 0.12) });
}

function sihirli(): MugModel {
  const m = measure(28, 442, 57, 498);
  const path = m.path([[436, 128], [468, 116], [520, 120], [568, 145], [603, 190], [616, 262], [603, 325], [574, 374], [524, 409], [470, 424], [436, 420]]);
  return model('sihirli', 'magic', m, [{ path, radius: m.r(19), depth: 1.15 }], { print: area(m.height, 0.12, 0.12) });
}

function tabakli(): MugModel {
  // Fotoğrafta kulp solda; ölçüler eksene göre aynalanır.
  const m = measure(150, 453, 59, 370);
  const path = m.path([[153, 124], [112, 114], [78, 110], [60, 116], [54, 134], [60, 162], [80, 204], [100, 236], [118, 256], [153, 276]]);
  return model('tabakli', 'saucer', m, [{ path, radius: m.r(12), depth: 1.35 }], {
    saucer: { radius: 1.0, height: 0.17, seat: 0.08 },
    colors: { siyah: '#0C0C0D', lacivert: '#10143C', turuncu: '#D2451C' },
  });
}

function porselen(): MugModel {
  const m = measure(25, 488, 60, 520);
  const path = m.path([[481, 160], [528, 146], [585, 151], [629, 180], [647, 230], [634, 288], [595, 338], [542, 380], [481, 418]]);
  return model('porselen', 'accent', m, [{ path, radius: m.r(23), depth: 1.15, from: 0.09, to: 0.09 }], {
    colors: { ...PORCELAIN, turuncu: '#E24010' }, base: { radius: 0.43, foot: 0.004, rise: 0.09 }, print: area(m.height, 0.13),
  });
}

function motto(): MugModel {
  const m = measure(60, 490, 78, 405);
  const path = m.path([[487, 178], [526, 151], [575, 147], [622, 170], [651, 213], [653, 258], [632, 298], [590, 324], [538, 325], [487, 300]]);
  return model('motto', 'accent', m, [{ path, radius: m.r(19), depth: 1.15 }], {
    colors: { ...PORCELAIN, 'kırmızı': '#EC2216', mavi: '#2B93DC' }, base: { radius: 0.44, foot: 0.004, rise: 0.07 }, print: area(m.height, 0.12),
  });
}

function afilli(): MugModel {
  const m = measure(40, 508, 60, 508);
  const path = m.path([[502, 150], [532, 132], [564, 127], [592, 137], [612, 164], [637, 213], [655, 262], [660, 300], [648, 331], [620, 353], [578, 374], [533, 392], [502, 408]]);
  return model('afilli', 'accent', m, [{ path, radius: m.r(19), depth: 1.3, to: 0.05 }], { print: area(m.height, 0.12) });
}

export const MUG_MODELS: Record<MugModelId, MugModel> = {
  luks, kahve: kahve(), latte: latte(), pro: pro(), seramik: seramik(), buyuk: buyuk(), sihirli: sihirli(),
  tabakli: tabakli(), porselen: porselen(), motto: motto(), afilli: afilli(),
};

/** Ürün ya da bardak adının başı → model. */
const NAMES: [string, MugModelId][] = [
  ['luks kupa', 'luks'],
  ['pro kupa', 'pro'],
  ['seramik kahve fincani', 'seramik'],
  ['sihirli kupa', 'sihirli'],
  ['tabakli kahve fincani', 'tabakli'],
  ['porselen kahve fincani', 'porselen'],
  ['porselen motto fincan', 'motto'],
  ['afilli porselen kupa', 'afilli'],
  ['buyuk beyaz kupa', 'buyuk'],
  ['latte fincani', 'latte'],
  ['kahve fincani', 'kahve'],
];

const PLAIN_LETTERS: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };

/** Ürün ya da konfigüratör bardağı için üç boyutlu model (tanınmayan kupada null). */
export function mugModelFor(title: string): MugModel | null {
  const name = title.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => PLAIN_LETTERS[c]).replace(/\s+/g, ' ').trim();
  const found = NAMES.find(([start]) => name.startsWith(start));
  return found ? MUG_MODELS[found[1]] : null;
}

/** Baskı şablonunun piksel boyutu: yay uzunluğu / yükseklik oranını korur. */
export function printSize(m: MugModel, width = 1200) {
  const arc = m.radius * m.print.angle;
  return { width, height: Math.round((width * m.print.height) / arc) };
}

/** Sepete kaydedilen kupa görüntüsünün zemini. */
export const SNAPSHOT_BACKGROUND = '#EFEFEC';

/** Hazır desen kupaya bu yerleşimle basılmış gösterilir. */
export const READY_PLACEMENT = { x: 0, y: 0, scale: 0.8, rotate: 0 };

/** Sihirli Kupa'nın soğukken dış rengi. */
export const MAGIC_COLD = '#161618';

export interface MugColors { body: string; inner: string; handle: string; band: string; saucer: string }

const CREAM = { body: '#EFEADF', inner: '#E6DECD' };
const WHITE = { body: '#E9ECEE', inner: '#E2E6E8' };

const all = (c: { body: string; inner: string }): MugColors => ({ ...c, handle: c.body, band: c.body, saucer: c.body });

/** Katalogdaki renk adından kupa renkleri; bilinmeyen ve "Beyaz" düz beyazdır. */
export function mugPalette(m: MugModel, color?: string): MugColors {
  const key = (color ?? '').trim().toLocaleLowerCase('tr-TR');
  if (key === 'transparan') return { ...all(CREAM), handle: '#F4F1E9' };
  const hex = m.colors[key];
  if (!hex || m.finish === 'plain' || m.finish === 'magic') return all(WHITE);
  // Pastel renklerde kupanın tamamı boyalıdır.
  if (key.includes('pastel')) return all({ body: hex, inner: hex });
  switch (m.finish) {
    case 'handle': return { ...all(CREAM), handle: hex };
    case 'band': return { ...all(CREAM), band: hex };
    case 'accent': return { ...all(WHITE), inner: hex, handle: hex };
    default: return { ...all(WHITE), saucer: hex };
  }
}
