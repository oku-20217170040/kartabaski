import { Assets, EDGE, cropRect, fitInside, hitLayer, layerGeometry, renderLayers, rotatedSize } from '@/lib/tasarim/ciz';
import { maxSize, moveTo, resize, snapAngle } from '@/lib/tasarim/hareket';
import { layersFromLegacy } from '@/lib/tasarim/donustur';
import { arrange } from '@/lib/tasarim/kolaj';
import { patternLayer, photoLayer, shapeLayer, textLayer, PhotoLayer, TextLayer } from '@/lib/tasarim/model';
import { photoRect } from '@/lib/photo-layout';

const SHEET = { width: 900, height: 600 };

/** Harf genişliği yazı boyunun 0,6 katı olan sahte tuval. */
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '', lineJoin: '', globalAlpha: 1,
    measureText(text: string) {
      const size = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
      return { width: Array.from(text).length * size * 0.6 } as TextMetrics;
    },
    save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, clip: () => {}, beginPath: () => {}, closePath: () => {},
    rect: () => {}, ellipse: () => {}, moveTo: () => {}, lineTo: () => {}, arcTo: () => {}, bezierCurveTo: () => {}, stroke: () => {},
    fillText: (t: string) => { calls.push(`yazi:${t}`); },
    strokeText: (t: string) => { calls.push(`cerceve:${t}`); },
    drawImage: () => { calls.push('gorsel'); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const image = (width: number, height: number) => ({ width, height }) as unknown as HTMLImageElement;
const assets: Assets = {
  font: () => ({ family: 'x', weight: 400, style: 'normal' }),
  photo: () => image(1200, 800),
  shape: () => image(512, 512),
};

const inside = (g: { cx: number; cy: number; w: number; h: number; r: number }) => {
  const o = rotatedSize(g.w, g.h, g.r);
  const slack = 0.001;
  expect(g.cx - o.width / 2).toBeGreaterThanOrEqual(-slack);
  expect(g.cx + o.width / 2).toBeLessThanOrEqual(SHEET.width + slack);
  expect(g.cy - o.height / 2).toBeGreaterThanOrEqual(-slack);
  expect(g.cy + o.height / 2).toBeLessThanOrEqual(SHEET.height + slack);
};

describe('baskı sınırları', () => {
  it('köşeye taşınan, çok büyük ve döndürülmüş yazı alanın içinde kalır', () => {
    const { ctx } = fakeContext();
    const layers = [
      textLayer({ id: 'a', text: 'Çok uzun bir yazı örneği burada', x: 0, y: 0, s: 1.2, r: 37 }),
      textLayer({ id: 'b', text: 'İyi ki\ndoğdun', x: 2, y: 2, s: 0.3, r: -90 }),
      textLayer({ id: 'c', text: 'Yaylı yazı', x: -1, y: 1, s: 0.2, curve: 80 }),
      textLayer({ id: 'd', text: 'Aşağı yay', x: 1, y: -1, s: 0.2, curve: -100, fx: 'outline' }),
      shapeLayer('fl', 'star', { id: 'e', x: 1.5, y: -0.5, s: 1.2, r: 45 }),
    ];
    const geometry = layerGeometry(ctx, layers, SHEET, assets);
    expect(geometry.map((g) => g.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    geometry.forEach(inside);
    expect(geometry[0].k).toBeLessThan(1);
  });

  it('sığan öğe istenen yerde ve boyda kalır', () => {
    const at = fitInside(SHEET, 0.4, 0.6, 100, 50, 0);
    expect(at).toEqual({ k: 1, cx: 360, cy: 360 });
    expect(fitInside(SHEET, 0, 0, 100, 50, 0)).toEqual({ k: 1, cx: 50 + 600 * EDGE, cy: 25 + 600 * EDGE });
  });

  it('boyut oranlıdır: dört kat büyük tuvalde yerleşim dört kat büyür', () => {
    const layers = [textLayer({ id: 'a', text: 'Elif', x: 0.1, y: 0.9, s: 0.3, r: 12 })];
    const small = layerGeometry(fakeContext().ctx, layers, SHEET, assets)[0];
    const big = layerGeometry(fakeContext().ctx, layers, { width: 3600, height: 2400 }, assets)[0];
    for (const key of ['cx', 'cy', 'w', 'h'] as const) expect(big[key]).toBeCloseTo(small[key] * 4, 3);
  });

  it('boş yazı ve görseli hazır olmayan fotoğraf yer tutmaz; desen taşınmaz', () => {
    const { ctx } = fakeContext();
    const none: Assets = { ...assets, photo: () => null };
    expect(layerGeometry(ctx, [textLayer({ text: '  ' }), photoLayer(0), patternLayer({ text: 'Ali' })], SHEET, none)).toEqual([]);
  });
});

describe('çizim', () => {
  it('katmanları sırayla çizer; yay harf harf basılır, çerçeve önce gelir', () => {
    const { ctx, calls } = fakeContext();
    renderLayers(ctx, [shapeLayer('ph', 'heart'), textLayer({ text: 'Al', curve: 50, fx: 'outline' })], SHEET, assets);
    expect(calls).toEqual(['gorsel', 'cerceve:A', 'cerceve:l', 'yazi:A', 'yazi:l']);
  });

  it('desen alanı boydan boya doldurur ve sınırlı sayıda çizer', () => {
    const { ctx, calls } = fakeContext();
    renderLayers(ctx, [patternLayer({ text: 'Ali', s: 0.1 })], SHEET, assets);
    expect(calls.length).toBeGreaterThan(50);
    expect(calls.length).toBeLessThan(3000);
  });

  it('kırpma fotoğrafın ortasını alır', () => {
    expect(cropRect(1200, 800, 1)).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 });
    expect(cropRect(800, 1200, 1)).toEqual({ sx: 0, sy: 200, sw: 800, sh: 800 });
    expect(cropRect(800, 600)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 });
  });

  it('dokunulan en üstteki öğeyi bulur; küçük öğede pay tanır', () => {
    const list = [
      { id: 'alt', cx: 100, cy: 100, w: 100, h: 100, r: 0, k: 1 },
      { id: 'ust', cx: 100, cy: 100, w: 60, h: 10, r: 90, k: 1 },
    ];
    expect(hitLayer(list, 100, 125)?.id).toBe('ust');
    expect(hitLayer(list, 125, 100)?.id).toBe('alt');
    expect(hitLayer(list, 118, 100, 22)?.id).toBe('ust');
    expect(hitLayer(list, 400, 400, 22)).toBeNull();
  });
});

describe('hareket', () => {
  const layer = textLayer({ id: 'a', text: 'Elif', s: 0.2 });
  const g = layerGeometry(fakeContext().ctx, [layer], SHEET, assets)[0];

  it('ortaya yaklaşınca yapışır, dışarı taşırmaz', () => {
    expect(moveTo(layer, g, SHEET, 455, 296)).toEqual({ patch: { x: 0.5, y: 0.5 }, guides: { x: true, y: true } });
    const out = moveTo(layer, g, SHEET, -500, 5000).patch;
    expect(out.x * SHEET.width).toBeGreaterThanOrEqual(g.w / 2);
    expect(out.y * SHEET.height).toBeLessThanOrEqual(SHEET.height - g.h / 2);
  });

  it('boyut alana sığan en büyük değerde durur', () => {
    const top = maxSize(layer, g, SHEET);
    const patch = resize(layer, g, SHEET, 99) as Partial<TextLayer>;
    expect(patch.s).toBeCloseTo(top, 3);
    const grown = layerGeometry(fakeContext().ctx, [{ ...layer, s: patch.s! }], SHEET, assets)[0];
    expect(grown.k).toBeCloseTo(1, 2);
    expect((resize(layer, g, SHEET, 0) as Partial<TextLayer>).s).toBe(0.04);
  });

  it('açı 45’in katlarına yapışır ve -180…180 arasında kalır', () => {
    expect(snapAngle(43)).toBe(45);
    expect(snapAngle(30)).toBe(30);
    expect(snapAngle(271)).toBe(-90);
  });
});

describe('eski tasarımın dönüştürülmesi', () => {
  it('fotoğraf eski yerleşimiyle birebir aynı yerde ve boyda çizilir', () => {
    const placement = { x: 0.12, y: -0.08, scale: 1.4, rotate: 20 };
    const [photo] = layersFromLegacy({ photos: ['f'], text: 'Elif', font: 'el', placement, removeBg: true }) as [PhotoLayer, TextLayer];
    const now = layerGeometry(fakeContext().ctx, [photo], SHEET, assets)[0];
    const before = photoRect(SHEET, { width: 1200, height: 800 }, placement, 0.32);
    expect(now.cx).toBeCloseTo(before.cx, 4);
    expect(now.cy).toBeCloseTo(before.cy, 4);
    expect(now.w).toBeCloseTo(before.width, 4);
    expect(now.h).toBeCloseTo(before.height, 4);
    expect(now.r).toBe(20);
    expect(photo.cut).toBe(true);
  });

  it('yazı eski tipini korur; fotoğraf yoksa ortalanır', () => {
    const [text] = layersFromLegacy({ photos: [], text: 'İyi ki doğdun', font: 'el' }) as TextLayer[];
    expect(text).toMatchObject({ kind: 'text', font: 'el', x: 0.5, y: 0.5, mw: 0.7 });
    expect(layersFromLegacy({ photos: [] })).toEqual([]);
  });

  it('yalnız hazır desen seçilmişse desen katmanı olur', () => {
    const layers = layersFromLegacy({ photos: [], ready: { id: 'd', name: 'Serçe', image: 'x/y' } });
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ kind: 'photo', n: -1, s: 0.8 });
  });
});

describe('kolaj', () => {
  it('her düzende fotoğraflar alanın içinde, üst üste binmeden dizilir', () => {
    for (const kind of ['yan-yana', 'izgara', 'buyuk'] as const) {
      for (const count of [2, 3, 4, 5, 8]) {
        const layers = arrange(Array.from({ length: count }, (_, n) => photoLayer(n, { shape: 'heart' })), kind, SHEET);
        const boxes = layerGeometry(fakeContext().ctx, layers, SHEET, assets);
        boxes.forEach(inside);
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            const overlap = Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 - 1 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 - 1;
            expect({ kind, count, i, j, overlap }).toEqual({ kind, count, i, j, overlap: false });
          }
        }
      }
    }
  });

  it('tek fotoğrafa dokunmaz', () => {
    const one = [photoLayer(0)];
    expect(arrange(one, 'izgara', SHEET)).toBe(one);
  });
});
