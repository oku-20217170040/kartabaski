import { readFileSync } from 'fs';
import path from 'path';
import {
  LayersSchema, MAX_LAYERS, addLayer, duplicateLayer, layersText, moveLayer, parseLayers, patternLayer, photoLayer,
  printableLayers, removePhotoAt, shapeLayer, textLayer,
} from '@/lib/tasarim/model';
import { addPhotos, copySide, emptySide, isEmptySide, removePhoto, setReady } from '@/lib/tasarim/belge';
import { MERGE_MS, commit, redo, startHistory, undo } from '@/lib/tasarim/gecmis';
import { DRAFT_TTL_MS, parseDraft } from '@/lib/tasarim/taslak';
import { dpiOf, printWidthMm, sharpness } from '@/lib/tasarim/netlik';
import { filterPixels } from '@/lib/tasarim/foto';
import { isTooLight } from '@/lib/tasarim/palet';
import { FEATURED, FONTS, fontFileUrl, fontSpec, isKnownFont, searchFonts } from '@/lib/tasarim/yazi-tipleri';
import { TEMPLATES, applyTemplate } from '@/lib/tasarim/sablonlar';
import { FEATURED_SHAPES, searchShapes } from '@/lib/tasarim/susler';
import { MUG_MODELS } from '@/lib/mug3d';
import { parseStoredCart } from '@/lib/cart';
import { OrderRequestSchema, lineNote, parseOrderInput } from '@/lib/siparis-types';

const icons = (pkg: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'node_modules/@iconify-json', pkg, 'icons.json'), 'utf8')).icons as Record<string, unknown>;

describe('katman işlemleri', () => {
  const a = textLayer({ id: 'a', text: 'Ali' });
  const p0 = photoLayer(0, { id: 'p0' });
  const p1 = photoLayer(1, { id: 'p1' });

  it('desen en alta, tek olarak girer', () => {
    const list = addLayer(addLayer([a], patternLayer({ id: 'd1', text: 'x' })), patternLayer({ id: 'd2', text: 'y' }));
    expect(list.map((l) => l.id)).toEqual(['d2', 'a']);
    expect(moveLayer(list, 'a', -1)).toBe(list);
  });

  it('katman sayısı sınırlıdır', () => {
    const full = Array.from({ length: MAX_LAYERS }, () => textLayer());
    expect(addLayer(full, textLayer())).toBe(full);
    expect(duplicateLayer(full, full[0].id).id).toBeNull();
  });

  it('fotoğraf silinince sonrakilerin sırası kayar', () => {
    expect(removePhotoAt([p0, a, p1], 0)).toEqual([a, { ...p1, n: 0 }]);
  });

  it('özet bütün yazıları birleştirir; boş yazı baskıya gitmez', () => {
    const empty = textLayer({ text: '   ' });
    expect(layersText([a, empty, textLayer({ text: 'İyi ki\ndoğdun' })])).toBe('Ali / İyi ki doğdun');
    expect(printableLayers([a, empty, patternLayer()])).toEqual([a]);
  });

  it('bozuk katman atılır, sağlamlar kalır', () => {
    expect(parseLayers([a, { kind: 'text', text: 'x' }, null, { ...p0, n: 99 }])).toEqual([a]);
    expect(parseLayers('x')).toBeUndefined();
    expect(LayersSchema.safeParse([{ ...a, color: 'red' }]).success).toBe(false);
    expect(LayersSchema.safeParse([{ ...shapeLayer('ph', 'heart'), name: '../x' }]).success).toBe(false);
  });
});

describe('yüz içeriği', () => {
  const sheet = { width: 900, height: 600 };
  const photo = (uid: string) => ({ uid, blob: new Blob(), url: `blob:${uid}`, fileId: uid });

  it('fotoğraf yazının altına girer; birden fazlası dizilir', () => {
    const side = addPhotos({ ...emptySide(), layers: [textLayer({ text: 'Ali' })] }, [photo('a'), photo('b')], sheet);
    expect(side.layers.map((l) => l.kind)).toEqual(['photo', 'photo', 'text']);
    expect(side.layers[0].x).not.toBe(side.layers[1].x);
    expect(removePhoto(side, 0).photos.map((p) => p.uid)).toEqual(['b']);
  });

  it('hazır düzenin fotoğraf yeri ilk fotoğrafa uygulanır', () => {
    const slot = TEMPLATES.find((t) => t.photo)!.photo!;
    const side = addPhotos({ ...emptySide(), slot }, [photo('a')], sheet);
    expect(side.layers[0]).toMatchObject({ x: slot.x, y: slot.y, shape: slot.shape });
    expect(side.slot).toBeUndefined();
  });

  it('hazır desen katmanıyla birlikte eklenip kaldırılır; kopyada sığmayan fotoğraf atılır', () => {
    const withReady = setReady(emptySide(), { id: 'd', name: 'Serçe', image: 'a/b' });
    expect(withReady.layers[0]).toMatchObject({ kind: 'photo', n: -1 });
    expect(setReady(withReady, undefined).layers).toEqual([]);
    const two = addPhotos(emptySide(), [photo('a'), photo('b')], sheet);
    expect(copySide(two, 1).layers).toHaveLength(1);
    expect(isEmptySide(emptySide())).toBe(true);
    expect(isEmptySide({ ...emptySide(), layers: [textLayer({ text: ' ' })] })).toBe(true);
  });
});

describe('geri alma', () => {
  it('aynı hareket tek adımdır; geri alınan yinelenir', () => {
    let h = startHistory(0);
    h = commit(h, 1, 'tasi', 1000);
    h = commit(h, 2, 'tasi', 1100);
    h = commit(h, 3, 'tasi', 1100 + MERGE_MS + 1);
    expect(h.past).toEqual([0, 2]);
    h = undo(undo(h));
    expect(h.present).toBe(0);
    expect(redo(h).present).toBe(2);
    expect(commit(h, 9).future).toEqual([]);
  });
});

describe('taslak', () => {
  it('süresi dolan ya da bozuk taslak yüklenmez', () => {
    const raw = JSON.stringify({ at: 1000, color: 'Mavi', front: { layers: [textLayer()], photos: ['abc', '../x'] } });
    expect(parseDraft(raw, 2000)?.front.photos).toEqual(['abc']);
    expect(parseDraft(raw, 1000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(parseDraft('{')).toBeNull();
  });
});

describe('netlik, renk ve filtre', () => {
  it('küçük fotoğraf büyük basılınca uyarılır', () => {
    const mm = printWidthMm(MUG_MODELS.luks);
    expect(mm).toBeGreaterThan(70);
    expect(sharpness(dpiOf(200, 0.66, mm))).toBe('zayif');
    expect(sharpness(dpiOf(2000, 0.66, mm))).toBe('iyi');
  });

  it('beyaza yakın renk uyarılır', () => {
    expect(isTooLight('#FFFFFF')).toBe(true);
    expect(isTooLight('#F2B200')).toBe(false);
  });

  it('siyah beyaz filtresi gri yapar, saydamlığa dokunmaz', () => {
    const px = filterPixels(new Uint8ClampedArray([200, 40, 40, 128]), 'bw');
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[3]).toBe(128);
  });
});

describe('yazı tipleri', () => {
  it('binden fazla tip vardır ve kimlikler benzersizdir', () => {
    expect(FONTS.length).toBeGreaterThan(1000);
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(FEATURED.length).toBeGreaterThan(55);
  });

  it('hazır düzenlerin tipleri listededir ve katmanları geçerlidir', () => {
    for (const t of TEMPLATES) {
      const layers = applyTemplate([photoLayer(0)], t);
      expect(LayersSchema.safeParse(layers).success).toBe(true);
      for (const l of layers) if (l.kind === 'text' || l.kind === 'pattern') expect([t.id, l.font, isKnownFont(l.font)]).toEqual([t.id, l.font, true]);
    }
  });

  it('arama Türkçe harf ayırmaz; bilinmeyen tip düz yazıya döner', () => {
    expect(searchFonts('PACİF')[0].id).toBe('pacifico');
    expect(fontSpec('yok-boyle').family).toContain('Archivo');
    expect(fontSpec('pacifico', true, true)).toEqual({ family: "'kt-pacifico', sans-serif", weight: 400, style: 'normal' });
    expect(fontFileUrl('pacifico', 'latin-ext', 400, 'normal')).toBe('/api/yazi-tipi/pacifico/latin-ext-400-normal.woff2');
  });
});

describe('süsler', () => {
  const ph = icons('ph');
  const fl = icons('fluent-emoji-flat');

  it('öne çıkan ve düzenlerde kullanılan süsler pakette vardır', () => {
    for (const name of FEATURED_SHAPES.ph) expect([name, Boolean(ph[`${name}-fill`])]).toEqual([name, true]);
    const missing = FEATURED_SHAPES.fl.filter((n) => !fl[n]);
    expect(missing).toEqual([]);
    for (const t of TEMPLATES) {
      for (const l of t.make()) {
        if ((l.kind === 'shape' || l.kind === 'pattern') && l.set && l.name) {
          expect([t.id, l.name, Boolean(l.set === 'ph' ? ph[`${l.name}-fill`] : fl[l.name])]).toEqual([t.id, l.name, true]);
        }
      }
    }
  });

  it('Türkçe arama bulur; sözcük ortasından eşleşmez', () => {
    const names = ['location', 'black-cat', 'cat-face', 'red-heart', 'balloon'];
    expect(searchShapes(names, 'fl', 'kedi')).toEqual(['black-cat', 'cat-face']);
    expect(searchShapes(names, 'fl', 'KALP')).toEqual(['red-heart']);
    expect(searchShapes(names, 'fl', '')[0]).toBe('red-heart');
  });
});

describe('sepet ve sipariş', () => {
  const text = textLayer({ id: 'a', text: 'Elif', font: 'pacifico' });
  const contact = {
    name: 'Deneme Kişi', phone: '05001112233', city: 'İstanbul', district: 'Kadıköy', neighborhood: 'Moda', street: 'Deneme Sokak',
    buildingNo: '1', postalCode: '34710', kvkk: true,
  };

  it('sepet katmanları korur; olmayan fotoğrafı gösteren atılır', () => {
    const [item] = parseStoredCart(JSON.stringify([{
      productId: 'p', title: 't', key: 'd:1', qty: 1,
      design: { photos: ['abc'], layers: [photoLayer(0, { id: 'f0' }), photoLayer(3, { id: 'f3' }), text], text: 'x'.repeat(100) },
    }]));
    expect(item.design?.layers?.map((l) => l.id)).toEqual(['f0', 'a']);
    expect(item.design?.text).toHaveLength(100);
  });

  it('sipariş katmanları kabul eder; eksik fotoğraf göstereni reddeder', () => {
    const line = { productId: 'p', qty: 1, photoCount: 1, hasPreview: false, layers: [photoLayer(0), text], text: 'Elif' };
    expect(parseOrderInput({ ...contact, items: [line] }).success).toBe(true);
    expect(parseOrderInput({ ...contact, items: [{ ...line, photoCount: 0 }] }).success).toBe(false);
    expect(parseOrderInput({ ...contact, items: [{ ...line, back: { photoCount: 0, layers: [photoLayer(-1)] } }] }).success).toBe(false);
  });

  it('kayıtlı siparişte bozuk katman siparişi düşürmez', () => {
    const order = OrderRequestSchema.parse({
      token: 't', createdAt: 1, updatedAt: 1, status: 'yeni',
      items: [{ productId: 'p', slug: 's', title: 't', files: [], text: 'Elif', layers: [text, { kind: 'bilinmeyen' }] }],
    });
    expect(order.items[0].layers).toHaveLength(1);
    expect(lineNote(order.items[0])).toContain('Yazı: Elif');
  });
});
