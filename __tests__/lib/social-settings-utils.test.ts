import { normalizeSettings, sanitizePatch, inWindow, windowLabel, defaultSettings } from '@/lib/social-settings-utils';

describe('normalizeSettings', () => {
  it('boş belgede platform varsayılanlarına düşer ve kapalıdır', () => {
    const s = normalizeSettings('instagram', undefined);
    expect(s).toMatchObject({ enabled: false, dailyLimit: 2, storyLimit: 3, windowStart: 10, windowEnd: 21 });
  });

  it('sayıları sınırlar ve bozuk değerleri varsayılana çevirir', () => {
    const s = normalizeSettings('facebook', { enabled: true, dailyLimit: 99, storyLimit: -4, windowStart: 'x', windowEnd: 30 });
    expect(s.enabled).toBe(true);
    expect(s.dailyLimit).toBe(10);
    expect(s.storyLimit).toBe(0);
    expect(s.windowStart).toBe(10);
    expect(s.windowEnd).toBe(24);
  });

  it('bitiş saati başlangıçtan küçük/eşitse düzeltilir', () => {
    const s = normalizeSettings('threads', { windowStart: 18, windowEnd: 9 });
    expect(s.windowEnd).toBeGreaterThan(s.windowStart);
  });

  it('yalnızca true olan enabled açık sayılır', () => {
    expect(normalizeSettings('threads', { enabled: 'true' }).enabled).toBe(false);
  });
});

describe('sanitizePatch', () => {
  it('yalnızca verilen alanları döndürür', () => {
    expect(sanitizePatch('instagram', { enabled: true })).toEqual({ enabled: true });
    expect(sanitizePatch('instagram', { dailyLimit: 50 })).toEqual({ dailyLimit: 10 });
  });
  it('saat penceresi birlikte doğrulanır', () => {
    expect(sanitizePatch('facebook', { windowStart: 20, windowEnd: 8 })).toEqual({ windowStart: 20, windowEnd: 21 });
  });
});

describe('inWindow', () => {
  const s = defaultSettings('facebook'); // 10-21
  it('TSİ saatine göre pencereyi denetler', () => {
    expect(inWindow(s, Date.UTC(2026, 10, 25, 7, 0))).toBe(true); // 10:00 TSİ
    expect(inWindow(s, Date.UTC(2026, 10, 25, 6, 59))).toBe(false); // 09:59
    expect(inWindow(s, Date.UTC(2026, 10, 25, 18, 0))).toBe(false); // 21:00
  });
  it('etiket üretir', () => {
    expect(windowLabel(s)).toBe('10:00–21:00 TSİ');
  });
});
