import {
  collectProductImages,
  computeStudioEnhanced,
  replaceImageId,
  readStudioPhotos,
  readColors,
  computeStats,
  isRemoteId,
} from '@/lib/studio-utils';
import { STUDIO_SCENES, getScene, sceneToOptions } from '@/lib/studio-scenes';
import type { StudioDraft } from '@/lib/studio-types';

const colors = [
  { name: 'Siyah', images: ['b1', 'b2'] },
  { name: 'Beyaz', images: ['w1', 'a'] },
];

describe('collectProductImages', () => {
  it('kapak ve renk görsellerini tekrarsız toplar, uzak adresleri atlar', () => {
    expect(collectProductImages(['a', 'https://x.com/i.jpg'], colors)).toEqual(['a', 'b1', 'b2', 'w1']);
  });
});

describe('computeStudioEnhanced', () => {
  const photo = (id: string) => ({ publicId: id, originalId: `o-${id}`, approvedAt: 1 });
  it('tüm kapak + renk görselleri onaylıysa true', () => {
    expect(computeStudioEnhanced(['a'], colors, ['a', 'b1', 'b2', 'w1'].map(photo))).toBe(true);
  });
  it('renk görseli eksikse false; görsel yoksa false', () => {
    expect(computeStudioEnhanced(['a'], colors, ['a'].map(photo))).toBe(false);
    expect(computeStudioEnhanced([], [], [])).toBe(false);
  });
});

describe('replaceImageId', () => {
  it('kapakta ve renk varyantlarında (her geçtiği yerde) değiştirir', () => {
    const r = replaceImageId(['a', 'x'], colors, 'a', 'NEW');
    expect(r.changed).toBe(true);
    expect(r.images).toEqual(['NEW', 'x']);
    expect(r.colors[1].images).toEqual(['w1', 'NEW']);
    expect(colors[1].images).toEqual(['w1', 'a']); // girdi değişmez
  });
  it('bulunmazsa changed=false', () => {
    expect(replaceImageId(['a'], colors, 'zzz', 'N').changed).toBe(false);
  });
  it('yalnızca renk görselinde olan kimliği de değiştirir', () => {
    const r = replaceImageId([], colors, 'b2', 'N');
    expect(r.changed).toBe(true);
    expect(r.colors[0].images).toEqual(['b1', 'N']);
  });
});

describe('okuyucular', () => {
  it('bozuk studioPhotos kayıtlarını eler', () => {
    expect(readStudioPhotos([{ publicId: 'a', originalId: 'b', approvedAt: 5, originalPurged: true }, { publicId: 1 }, null, 'x'])).toEqual([
      { publicId: 'a', originalId: 'b', approvedAt: 5, originalPurged: true },
    ]);
    expect(readStudioPhotos(undefined)).toEqual([]);
  });
  it('renkleri güvenle okur', () => {
    expect(readColors([{ name: 'Kırmızı', images: ['a', 3] }, 'x'])).toEqual([{ name: 'Kırmızı', images: ['a'] }]);
    expect(readColors(null)).toEqual([]);
  });
  it('isRemoteId http(s) adreslerini tanır', () => {
    expect(isRemoteId('https://a.com/x.jpg')).toBe(true);
    expect(isRemoteId('karta-baski/urunler/x')).toBe(false);
  });
});

describe('computeStats', () => {
  const d = (over: Partial<StudioDraft>): StudioDraft => ({
    id: 'i', productId: 'p', productTitle: 't', originalPublicId: 'o', mode: 'clean_white', environment: 'live',
    status: 'pending', costUSD: 0.02, createdAt: Date.now(), ...over,
  });
  it('başarısız ve devam edenleri maliyete katmaz, bu ay/toplam ayırır', () => {
    const now = new Date(2026, 5, 15).getTime();
    const old = new Date(2026, 4, 1).getTime();
    const s = computeStats(
      [d({ createdAt: now }), d({ createdAt: old }), d({ status: 'failed', createdAt: now }), d({ status: 'generating', createdAt: now })],
      now
    );
    expect(s.generatedThisMonth).toBe(1);
    expect(s.generatedTotal).toBe(2);
    expect(s.failedTotal).toBe(1);
    expect(s.costTotalUSD).toBeCloseTo(0.04);
    expect(s.costThisMonthUSD).toBeCloseTo(0.02);
  });
});

describe('sahne önerileri', () => {
  it('kimlikler benzersiz; sahne modları prompt ile tutarlı', () => {
    const ids = STUDIO_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STUDIO_SCENES) {
      expect(s.label.length).toBeGreaterThan(0);
      if (s.mode === 'studio_staging') expect(s.prompt.length).toBeGreaterThan(20);
    }
  });
  it('gerekli sahneler mevcut', () => {
    for (const id of ['white-studio', 'wood-coffee', 'marble-counter', 'gift-box', 'office-desk', 'christmas', 'valentines', 'magic-warm']) {
      expect(getScene(id)).toBeDefined();
    }
  });
  it('sceneToOptions mod, prompt ve sceneId döner', () => {
    expect(sceneToOptions(getScene('wood-coffee')!)).toMatchObject({ mode: 'studio_staging', sceneId: 'wood-coffee' });
    expect(sceneToOptions(getScene('white-studio')!).prompt).toBeUndefined();
  });
});
