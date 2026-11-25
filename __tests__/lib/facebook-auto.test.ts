import { canPostNow, emptyState, statusChanges, todayCountFor, FB_MIN_GAP_MS, type FbPosted, type FbState } from '@/lib/facebook-auto-utils';

// 2026-11-25 12:00 TSİ (UTC 09:00)
const NOON = Date.UTC(2026, 10, 25, 9, 0);
const DAY = '2026-11-25';
const S = { dailyLimit: 3, windowStart: 10, windowEnd: 21 };

const st = (over: Partial<FbState> = {}): FbState => ({ ...emptyState(), ...over });

describe('todayCountFor', () => {
  it('aynı gün sayacı, yeni günde 0 döner', () => {
    expect(todayCountFor(st({ day: DAY, todayCount: 4 }), NOON)).toBe(4);
    expect(todayCountFor(st({ day: '2026-11-24', todayCount: 4 }), NOON)).toBe(0);
  });
});

describe('canPostNow', () => {
  it('pencere içinde, kota ve bekleme uygunsa izin verir', () => {
    expect(canPostNow(st(), S, NOON).ok).toBe(true);
  });
  it('pencere dışında reddeder', () => {
    const night = Date.UTC(2026, 10, 25, 20, 0); // 23:00 TSİ
    const r = canPostNow(st(), S, night);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('10:00–21:00');
  });
  it('günlük kota dolunca reddeder, ayarlanan limite göre', () => {
    expect(canPostNow(st({ day: DAY, todayCount: 3 }), S, NOON).ok).toBe(false);
    expect(canPostNow(st({ day: DAY, todayCount: 3 }), { ...S, dailyLimit: 5 }, NOON).ok).toBe(true);
  });
  it('önceki gönderiden kısa süre geçtiyse bekletir', () => {
    expect(canPostNow(st({ lastPostAt: NOON - FB_MIN_GAP_MS + 1000 }), S, NOON).ok).toBe(false);
    expect(canPostNow(st({ lastPostAt: NOON - FB_MIN_GAP_MS - 1000 }), S, NOON).ok).toBe(true);
  });
});

describe('statusChanges (pasife alma)', () => {
  const posted = (active: boolean, withPost = true): FbPosted => ({ postId: withPost ? 'fb1' : undefined, postedAt: 1, active, caption: 'c' });
  const rows = new Map([['a', { active: false }], ['b', { active: true }], ['c', { active: true }]]);

  it('aktiflik durumu değişen paylaşımları döndürür', () => {
    const p = { a: posted(true), b: posted(true), c: posted(false) };
    expect(statusChanges(p, rows).sort()).toEqual(['a', 'c']);
  });
  it('gönderisi olmayan (hatalı) kayıtlar atlanır', () => {
    expect(statusChanges({ a: posted(true, false) }, rows)).toEqual([]);
  });
  it('listede olmayan ürüne dokunulmaz', () => {
    expect(statusChanges({ zzz: posted(true) }, rows)).toEqual([]);
  });
});
