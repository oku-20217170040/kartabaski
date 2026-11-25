import {
  fitThreads, threadsDetailChunks, threadsGate, threadsTodayCount, THREADS_TEXT_MAX, DETAIL_CHUNK_MAX, DETAIL_CHUNKS_LIMIT, THREADS_MIN_GAP_MS,
} from '@/lib/threads-utils';

describe('fitThreads', () => {
  it('500 karakteri aşmaz, kısaysa dokunmaz', () => {
    expect(fitThreads('a'.repeat(800)).length).toBeLessThanOrEqual(THREADS_TEXT_MAX);
    expect(fitThreads('kısa')).toBe('kısa');
  });
});

describe('threadsDetailChunks', () => {
  it('açıklama ve ek satırları tek parçada toplar', () => {
    const chunks = threadsDetailChunks('Seramik kupa.\nDayanıklı baskı.', ['📦 Teslimat: yaklaşık 3 iş günü']);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Dayanıklı baskı.');
    expect(chunks[0]).toContain('Teslimat');
  });
  it('uzun içeriği 480 karakterlik parçalara böler ve en fazla sınır kadar parça verir', () => {
    const long = Array.from({ length: 120 }, (_, i) => `Satır ${i} ${'x'.repeat(40)}`).join('\n');
    const chunks = threadsDetailChunks(long);
    expect(chunks.length).toBeLessThanOrEqual(DETAIL_CHUNKS_LIMIT);
    expect(chunks.every((c) => c.length <= DETAIL_CHUNK_MAX)).toBe(true);
    expect(chunks[chunks.length - 1].endsWith('…')).toBe(true);
  });
  it('boş girdide boş liste', () => {
    expect(threadsDetailChunks('', [])).toEqual([]);
  });
  it('tek satır çok uzunsa kesilir', () => {
    const chunks = threadsDetailChunks('y'.repeat(2000));
    expect(chunks.every((c) => c.length <= DETAIL_CHUNK_MAX)).toBe(true);
  });
});

describe('threadsGate', () => {
  const NOON = Date.UTC(2026, 10, 25, 9, 0); // 12:00 TSİ
  const S = { dailyLimit: 2, windowStart: 10, windowEnd: 21 };
  it('pencere içinde ve kota boşken izin verir', () => {
    expect(threadsGate({ day: '', todayCount: 0 }, S, NOON).ok).toBe(true);
  });
  it('pencere dışında reddeder', () => {
    expect(threadsGate({ day: '', todayCount: 0 }, S, Date.UTC(2026, 10, 25, 1, 0)).ok).toBe(false);
  });
  it('günlük kota dolunca reddeder, gün değişince sıfırlanır', () => {
    expect(threadsGate({ day: '2026-11-25', todayCount: 2 }, S, NOON).ok).toBe(false);
    expect(threadsGate({ day: '2026-11-24', todayCount: 2 }, S, NOON).ok).toBe(true);
    expect(threadsTodayCount('2026-11-24', 2, NOON)).toBe(0);
  });
  it('gönderiler arası bekleme', () => {
    expect(threadsGate({ day: '', todayCount: 0, lastPostAt: NOON - THREADS_MIN_GAP_MS + 1000 }, S, NOON).ok).toBe(false);
  });
});
