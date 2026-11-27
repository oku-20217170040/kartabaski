// 30 günlük yayın planının saf benzetimi: sunucu zamanlayıcısının yarım saatlik turları
// (TSİ 07:00 - 00:30) ve `runBlogStep`in yayın akışı (blogSlotDue → en eski vakti gelen yazı → nextBlogState).
import {
  blogSlotDue, nextBlogState, BLOG_DAILY_MAX, BLOG_GRACE_MS, BLOG_MIN_GAP_MS, type BlogStepState,
} from '@/lib/blog-cadence';
import { trDayKey, trTime, DAY_MS } from '@/lib/tr-time';

const MIN = 60 * 1000;
const TURN = 30 * MIN;
const FIRST_DAY = '2026-12-01';

const dayKey = (d: number) => trDayKey(trTime(FIRST_DAY, 12) + d * DAY_MS);
const slot = (d: number, hour: number, minute = 0) => trTime(dayKey(d), hour, minute);
/** Günde 10:00 ve 18:00 planlı iki yazı. */
const plan = (days: number) => Array.from({ length: days }, (_, d) => [slot(d, 10), slot(d, 18)]).flat();

interface Published { scheduledAt: number; at: number }

function simulate(scheduled: number[], days: number, opts: { jitter?: (turn: number) => number; down?: number[] } = {}) {
  const queue = [...scheduled].sort((a, b) => a - b);
  const published: Published[] = [];
  const reads = new Map<string, number>();
  let state: BlogStepState = {};
  let turn = 0;

  for (let d = 0; d < days; d++) {
    // 07:00'den ertesi gün 00:30'a kadar 36 tur
    for (let i = 0; i < 36; i++, turn++) {
      if (opts.down?.includes(d)) continue;
      const now = slot(d, 7) + i * TURN + (opts.jitter?.(turn) ?? 0);
      if (!blogSlotDue(now, state)) continue;
      reads.set(trDayKey(now), (reads.get(trDayKey(now)) ?? 0) + 1);
      const due = queue.length > 0 && queue[0] <= now + BLOG_GRACE_MS ? queue.shift() : undefined;
      if (due !== undefined) published.push({ scheduledAt: due, at: now });
      state = nextBlogState(now, state, due !== undefined, queue[0] ?? 0);
    }
  }
  return { published, left: queue.length, reads };
}

const perDay = (published: Published[]) => {
  const m = new Map<string, number>();
  for (const p of published) m.set(trDayKey(p.at), (m.get(trDayKey(p.at)) ?? 0) + 1);
  return m;
};
const gaps = (published: Published[]) => published.slice(1).map((p, i) => p.at - published[i].at);
const clock = (ts: number) => new Date(ts + 3 * 3600 * 1000).toISOString().slice(11, 16);
const expectLimits = (published: Published[]) => {
  expect(Math.max(...Array.from(perDay(published).values()))).toBeLessThanOrEqual(BLOG_DAILY_MAX);
  expect(Math.min(...gaps(published))).toBeGreaterThanOrEqual(BLOG_MIN_GAP_MS);
};

describe('30 günlük 10:00 / 18:00 planı', () => {
  it('60 yazının her biri tam kendi turunda yayınlanır', () => {
    const { published, left, reads } = simulate(plan(30), 31);
    expect(left).toBe(0);
    expect(published).toHaveLength(60);
    expect(published.every((p) => p.at === p.scheduledAt)).toBe(true);
    expect(Array.from(perDay(published).values())).toEqual(Array(30).fill(2));
    expectLimits(published);
    // koleksiyon günde en fazla 3 kez okunur (sabah, 10:00, 18:00)
    expect(Math.max(...Array.from(reads.values()))).toBe(3);
  });

  it('zamanlayıcı turu birkaç saniye geç başlasa da aynı turda yayınlanır', () => {
    const { published } = simulate(plan(30), 30, { jitter: (t) => ((t * 7919) % 90) * 1000 });
    expect(published).toHaveLength(60);
    expect(published.every((p) => p.at - p.scheduledAt >= 0 && p.at - p.scheduledAt < 90 * 1000)).toBe(true);
    expectLimits(published);
  });

  it('en çok 5 dakika erken yayınlar; daha erkense sonraki turu bekler', () => {
    const { published } = simulate([slot(0, 10, 5), slot(0, 18, 6)], 1);
    expect(published.map((p) => clock(p.at))).toEqual(['10:00', '18:30']);
  });

  it('aynı güne üç yazı planlanırsa üçüncüsü ertesi güne kalır', () => {
    const { published } = simulate([slot(0, 8), slot(0, 13), slot(0, 19)], 2);
    expect(published.map((p) => [trDayKey(p.at), clock(p.at)])).toEqual([
      [dayKey(0), '08:00'], [dayKey(0), '13:00'], [dayKey(1), '07:00'],
    ]);
  });
});

describe('gecikmiş kuyruk', () => {
  it('birikim bir anda dökülmez: günde 2, en az 4 saat arayla, eskiden yeniye', () => {
    const overdue = Array.from({ length: 9 }, (_, i) => slot(-9 + i, 10));
    const { published, left } = simulate(overdue, 5);
    expect(left).toBe(0);
    expect(published.map((p) => p.scheduledAt)).toEqual(overdue);
    expect(published.map((p) => clock(p.at))).toEqual(['07:00', '11:00', '07:00', '11:00', '07:00', '11:00', '07:00', '11:00', '07:00']);
    expectLimits(published);
  });

  it('tur saatleri oynasa da sınırlar aşılmaz', () => {
    const overdue = Array.from({ length: 20 }, (_, i) => slot(-20 + i, 10));
    const { published, left } = simulate(overdue, 12, { jitter: (t) => ((t * 7919) % 90) * 1000 });
    expect(left).toBe(0);
    expectLimits(published);
  });

  it('bir gün kaçırılırsa plan bir gün geriden gelir, kuyruk bitince kapanır', () => {
    const { published, left } = simulate(plan(30), 31, { down: [4] });
    expect(left).toBe(0);
    expectLimits(published);
    expect(published.slice(0, 8).every((p) => p.at === p.scheduledAt)).toBe(true);
    const day10 = published.filter((p) => trDayKey(p.at) === dayKey(10));
    expect(day10.map((p) => clock(p.at))).toEqual(['07:00', '11:00']);
    expect(day10.every((p) => trDayKey(p.scheduledAt) === dayKey(9))).toBe(true);
    expect(trDayKey(published[published.length - 1].at)).toBe(dayKey(30));
  });
});
