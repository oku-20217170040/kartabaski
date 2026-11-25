jest.mock('@/lib/image-gen/prompts', () => ({ DEFAULT_SCENE_IDS: ['beyaz-stüdyo', 'ahşap-masa', 'sabah-kahvesi', 'minimal'] }), { virtual: true });

import {
  parseSettings, defaultSettings, pickScenes, scenesToGenerate, pickReferenceIds, finalStatus, isStaleRunning,
  statusAfterError, remainingToday, addUsage, usageToday, findOpenJob, STALE_RUNNING_MS,
  type PhotoJob,
} from '@/lib/photo-auto-utils';
import { trTime } from '@/lib/tr-time';

const NOW = trTime('2026-11-25', 12);

describe('parseSettings', () => {
  it('boş girdi varsayılanları verir', () => {
    const s = defaultSettings();
    expect(s).toMatchObject({ enabled: false, provider: 'auto', perProduct: 4, referenceCount: 2, autoApply: 'review', dailyLimit: 20 });
    expect(s.sceneIds).toHaveLength(4);
    expect(s.model).toBeUndefined();
  });
  it('sayıları kırpar ve bozuk değerleri düzeltir', () => {
    const s = parseSettings({ perProduct: 99, referenceCount: 0, dailyLimit: -5, provider: 'x', autoApply: 'zzz', enabled: 'evet' });
    expect(s).toMatchObject({ perProduct: 8, referenceCount: 1, dailyLimit: 1, provider: 'auto', autoApply: 'review', enabled: false });
  });
  it('sahneleri temizler, tekilleştirir; boşsa varsayılana düşer', () => {
    expect(parseSettings({ sceneIds: ['a', 'a', 'b c', 5, 'd'] }).sceneIds).toEqual(['a', 'd']);
    expect(parseSettings({ sceneIds: [] }).sceneIds).toHaveLength(4);
    expect(parseSettings({ sceneIds: 'a' }).sceneIds).toHaveLength(4);
  });
  it('geçerli sağlayıcı/model/append korunur', () => {
    const s = parseSettings({ provider: 'gemini', model: '  m-1 ', autoApply: 'append', enabled: true });
    expect(s).toMatchObject({ provider: 'gemini', model: 'm-1', autoApply: 'append', enabled: true });
    expect(parseSettings({ provider: 'cloudflare' }).provider).toBe('cloudflare');
    expect(parseSettings({ provider: 'huggingface' }).provider).toBe('huggingface');
    expect(parseSettings({ model: '   ' }).model).toBeUndefined();
  });
  it('null/dizi girdisi çökmez', () => {
    expect(parseSettings(null).perProduct).toBe(4);
    expect(parseSettings('x').dailyLimit).toBe(20);
  });
});

describe('pickScenes', () => {
  const st = { sceneIds: ['a', 'b', 'c', 'd', 'e'], perProduct: 3 };
  it('ayardan perProduct kadar alır', () => expect(pickScenes(st)).toEqual(['a', 'b', 'c']));
  it('elle seçim önceliklidir', () => expect(pickScenes(st, ['x', 'y'])).toEqual(['x', 'y']));
  it('elle seçim en çok 8', () => expect(pickScenes(st, Array.from({ length: 12 }, (_, i) => `s${i}`))).toHaveLength(8));
  it('boş sahne listesi varsayılana düşer', () => expect(pickScenes({ sceneIds: [], perProduct: 2 })).toHaveLength(2));
});

const job = (over: Partial<PhotoJob> = {}): PhotoJob => ({
  id: 'j1', productId: 'p1', productTitle: 'Kupa', status: 'queued', scenes: ['a', 'b', 'c'], results: [], provider: 'auto',
  referenceIds: [], attempts: 0, createdAt: NOW, updatedAt: NOW, ...over,
});

describe('scenesToGenerate / finalStatus', () => {
  it('sonucu olmayan ve hatalı sahneleri verir', () => {
    const j = job({ results: [{ sceneId: 'a', publicId: 'x', status: 'pending' }, { sceneId: 'b', publicId: '', status: 'failed', error: 'e' }] });
    expect(scenesToGenerate(j)).toEqual(['b', 'c']);
  });
  it('reddedilen sahne tekrar üretilmez', () => {
    expect(scenesToGenerate(job({ results: [{ sceneId: 'a', publicId: 'x', status: 'rejected' }] }))).toEqual(['b', 'c']);
  });
  it('done / partial / failed', () => {
    const ok = (s: string) => ({ sceneId: s, publicId: s, status: 'pending' as const });
    const bad = (s: string) => ({ sceneId: s, publicId: '', status: 'failed' as const });
    expect(finalStatus(job({ results: [ok('a'), ok('b'), ok('c')] }))).toBe('done');
    expect(finalStatus(job({ results: [ok('a'), bad('b'), bad('c')] }))).toBe('partial');
    expect(finalStatus(job({ results: [bad('a'), bad('b'), bad('c')] }))).toBe('failed');
    expect(finalStatus(job())).toBe('failed');
  });
});

describe('pickReferenceIds', () => {
  it('güvenli kimlikleri sırayla alır, stüdyo çıktısını ve kötü kimlikleri atlar', () => {
    const imgs = ['karta-baski/studio/x', 'https://evil.com/a.jpg', '../x', 'karta-baski/urunler/a', 'karta-baski/urunler/b', 'karta-baski/urunler/c', 'karta-baski/urunler/d'];
    expect(pickReferenceIds(imgs, 2)).toEqual(['karta-baski/urunler/a', 'karta-baski/urunler/b']);
    expect(pickReferenceIds(imgs, 9)).toHaveLength(3);
  });
  it('dizi değilse boş', () => expect(pickReferenceIds(undefined, 2)).toEqual([]));
});

describe('bayat kilit ve hata sonrası durum', () => {
  it('10 dk geçince bayat', () => {
    expect(isStaleRunning({ status: 'running', updatedAt: NOW - STALE_RUNNING_MS - 1 }, NOW)).toBe(true);
    expect(isStaleRunning({ status: 'running', updatedAt: NOW - 60_000 }, NOW)).toBe(false);
    expect(isStaleRunning({ status: 'queued', updatedAt: 0 }, NOW)).toBe(false);
  });
  it('yeniden denenebilir hata sıraya döner, 3. denemeden sonra biter', () => {
    expect(statusAfterError(1, true, job())).toBe('queued');
    expect(statusAfterError(3, true, job())).toBe('failed');
    expect(statusAfterError(1, false, job())).toBe('failed');
    expect(statusAfterError(3, true, job({ results: [{ sceneId: 'a', publicId: 'x', status: 'pending' }] }))).toBe('partial');
  });
});

describe('günlük kota (TSİ)', () => {
  it('yeni gün sayacı sıfırlar', () => {
    const u = addUsage(undefined, NOW, 3);
    expect(usageToday(u, NOW)).toBe(3);
    expect(remainingToday(20, u, NOW)).toBe(17);
    expect(usageToday(u, NOW + 86400000)).toBe(0);
    expect(addUsage(u, NOW, 2).count).toBe(5);
    expect(addUsage(u, NOW + 86400000, 2).count).toBe(2);
  });
  it('limit aşılınca 0', () => expect(remainingToday(5, { day: '2026-11-25', count: 9 }, NOW)).toBe(0));
  it('TSİ gece yarısı sınırı: 23:30 TSİ ile 00:30 TSİ farklı gün', () => {
    const a = trTime('2026-11-25', 23, 30);
    const b = trTime('2026-11-26', 0, 30);
    expect(usageToday(addUsage(undefined, a, 4), b)).toBe(0);
  });
});

describe('findOpenJob', () => {
  it('yalnızca sırada/çalışan işi bulur', () => {
    const jobs = [job({ id: '1', status: 'done' }), job({ id: '2', status: 'running' }), job({ id: '3', productId: 'p2', status: 'queued' })];
    expect(findOpenJob(jobs, 'p1')?.id).toBe('2');
    expect(findOpenJob(jobs, 'p9')).toBeUndefined();
  });
});
