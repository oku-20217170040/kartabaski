import {
  spreadTimes, daySlots, nextWindowTime, survivors, titleLines, overlayText, feedImageUrl, storyImageUrl, isDue, rankCandidates,
  trTime, trDayKey, type IgItem,
} from '@/lib/instagram-utils';
import type { SocialProductRow } from '@/lib/social-content-utils';

const DAY = '2026-11-25';
const HOUR = 3600 * 1000;

const item = (productId: string): IgItem => ({ productId, title: 't', priceMin: 100, priceMax: 100, imageId: 'x', category: 'Lüks Kupa' });

describe('spreadTimes / daySlots', () => {
  it('pencere içine eşit dağıtır', () => {
    expect(spreadTimes(DAY, 2, 10, 21)).toEqual([trTime(DAY, 12, 45), trTime(DAY, 18, 15)]);
  });
  it('sayı 0 ya da pencere geçersizse boş döner', () => {
    expect(spreadTimes(DAY, 0, 10, 21)).toEqual([]);
    expect(spreadTimes(DAY, 3, 21, 10)).toEqual([]);
  });
  it('en az bekleme süresinden yakın dilimleri atlar ve sıralı döner', () => {
    const now = trTime(DAY, 12, 0);
    const slots = daySlots(DAY, now, { feedCount: 2, storyCount: 3, windowStart: 10, windowEnd: 21, minLeadMs: HOUR });
    expect(slots.every((s) => s.at >= now + HOUR)).toBe(true);
    expect(slots.map((s) => s.at)).toEqual([...slots.map((s) => s.at)].sort((a, b) => a - b));
    expect(slots.filter((s) => s.kind === 'carousel')).toHaveLength(1); // 12:45 atlandı, 18:15 kaldı
    expect(slots.filter((s) => s.kind === 'story').length).toBeGreaterThan(0);
  });
});

describe('nextWindowTime', () => {
  it('pencere içindeyse now + lead', () => {
    const now = trTime(DAY, 12, 0);
    expect(nextWindowTime(now, HOUR, 10, 21)).toBe(now + HOUR);
  });
  it('gece ise ertesi sabah pencere başlangıcı', () => {
    expect(nextWindowTime(trTime(DAY, 22, 30), HOUR, 10, 21)).toBe(trTime('2026-11-26', 10, 0));
  });
  it('erken saatte aynı günün pencere başlangıcı', () => {
    expect(nextWindowTime(trTime(DAY, 6, 0), HOUR, 10, 21)).toBe(trTime(DAY, 10, 0));
  });
  it('gün anahtarı TSİ ile tutarlı', () => {
    expect(trDayKey(trTime(DAY, 0, 0))).toBe(DAY);
  });
});

describe('survivors', () => {
  it('pasife alınan modeller çıkarılır', () => {
    const items = [item('a'), item('b'), item('c')];
    expect(survivors(items, new Set(['a', 'b']), 'carousel')?.map((i) => i.productId)).toEqual(['a', 'b']);
  });
  it('farklı ürünlü karuselde 2den az kalırsa iptal', () => {
    expect(survivors([item('a'), item('b')], new Set(['a']), 'carousel')).toBeNull();
  });
  it('tek ürünlü karusel (aynı ürünün çok fotoğrafı) 1 ürünle sürer', () => {
    expect(survivors([item('a'), item('a')], new Set(['a']), 'carousel')).toHaveLength(2);
    expect(survivors([item('a')], new Set(), 'story')).toBeNull();
  });
  it('blog öğeleri her zaman geçerlidir', () => {
    expect(survivors([item('blog:1')], new Set(), 'blog')).toHaveLength(1);
  });
});

describe('görsel adresleri', () => {
  it('feed görselinde yazı katmanı yok, 1080x1350 dolgu', () => {
    const u = feedImageUrl('demo', 'karta-baski/urunler/a');
    expect(u).toContain('w_1080,h_1350');
    expect(u).not.toContain('l_text');
    expect(() => feedImageUrl('', 'a')).toThrow();
  });
  it('hikâye görselinde ad, fiyat ve marka katmanı var', () => {
    const u = storyImageUrl('demo', 'a', 'Sihirli Kupa Kalp Desenli', '150₺ – 250₺', 'KAR-TA BASKI · 0545');
    expect(u).toContain('h_1920');
    expect((u.match(/l_text/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(u).toContain(encodeURIComponent('150₺ – 250₺'));
  });
  it('overlayText virgül ve eğik çizgiyi çift kaçırır', () => {
    expect(overlayText('a,b/c')).toBe('a%252Cb%252Fc');
  });
  it('titleLines en çok iki satır döndürür', () => {
    const lines = titleLines('Kişiye Özel Sihirli Kupa Kalp Desenli Hediyelik Set Çift Kişilik');
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((l) => l.length <= 24)).toBe(true);
  });
});

describe('isDue', () => {
  it('yalnızca zamanı gelmiş taslak', () => {
    expect(isDue({ status: 'taslak', publishAt: 10 }, 10)).toBe(true);
    expect(isDue({ status: 'taslak', publishAt: 11 }, 10)).toBe(false);
    expect(isDue({ status: 'yayinlandi', publishAt: 1 }, 10)).toBe(false);
  });
});

describe('rankCandidates', () => {
  const r = (id: string, createdAt: number): SocialProductRow => ({
    id, title: id, slug: id, category: 'Lüks Kupa', priceMin: 1, priceMax: 1, shortDesc: '', description: '', deliveryDays: 3,
    imageIds: ['x'], active: true, createdAt, updatedAt: 0,
  });
  it('yakın zamanda paylaşılanlar sona gider; aynı gün aynı sıra', () => {
    const cands = [r('a', 1), r('b', 2), r('c', 3), r('d', 4)];
    const recent = new Map([['d', 500], ['c', 100]]);
    const out = rankCandidates(cands, recent, DAY).map((x) => x.id);
    expect(out.slice(-2)).toEqual(['c', 'd']);
    expect(rankCandidates(cands, recent, DAY).map((x) => x.id)).toEqual(out);
  });
});
