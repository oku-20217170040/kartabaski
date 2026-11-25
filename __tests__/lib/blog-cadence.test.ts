import { blogSlotDue, nextBlogState, blogGenDue, nextAutoSlot, BLOG_DAILY_MAX, BLOG_MIN_GAP_MS, BLOG_PUBLISH_HOUR } from '@/lib/blog-cadence';
import { trHour, trDayKey } from '@/lib/tr-time';

const DAY = '2026-11-11';
// TSİ saat:dakika → epoch ms (TSİ = UTC+3)
const at = (h: number, m = 0, day = DAY) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h - 3, m);
const H = 3600 * 1000;

describe('blog yayın sıklığı kuralı', () => {
  it('07:00 TSİ öncesi hiç bakılmaz', () => {
    expect(blogSlotDue(at(6, 30), {})).toBe(false);
  });

  it('yeni günde (ya da hiç durum yokken) bir kez bakılır', () => {
    expect(blogSlotDue(at(7), {})).toBe(true);
    expect(blogSlotDue(at(7), { blogDay: '2026-11-10', blogCount: 1, blogLastAt: at(23, 0, '2026-11-10'), blogNextAt: 0 })).toBe(true);
  });

  it('günde en fazla BLOG_DAILY_MAX yazı', () => {
    expect(BLOG_DAILY_MAX).toBe(1);
    expect(blogSlotDue(at(22), { blogDay: DAY, blogCount: 1, blogLastAt: at(8), blogNextAt: at(8) })).toBe(false);
  });

  it('iki yayın arasında en az BLOG_MIN_GAP_MS', () => {
    const s = { blogDay: DAY, blogCount: 0, blogLastAt: at(8), blogNextAt: at(7) };
    expect(blogSlotDue(at(8) + BLOG_MIN_GAP_MS - 1, s)).toBe(false);
    expect(blogSlotDue(at(8) + BLOG_MIN_GAP_MS, s)).toBe(true);
  });

  it('sıradaki yazının vakti (2 saat erken pay dahil) gelmeden okuma yapılmaz', () => {
    const s = { blogDay: DAY, blogCount: 0, blogLastAt: 0, blogNextAt: at(18) };
    expect(blogSlotDue(at(15), s)).toBe(false);
    expect(blogSlotDue(at(16), s)).toBe(true);
  });

  it('bugün sıra boşsa yeni planlananlar yarına kalır; eski durum belgesinde bakılır', () => {
    expect(blogSlotDue(at(12), { blogDay: DAY, blogCount: 0, blogNextAt: 0 })).toBe(false);
    expect(blogSlotDue(at(12), { blogDay: DAY, blogCount: 0 })).toBe(true);
  });

  it('nextBlogState yayında sayacı artırır, yeni günde sıfırlar', () => {
    const a = nextBlogState(at(9), {}, true, at(18));
    expect(a).toMatchObject({ blogDay: DAY, blogCount: 1, blogLastAt: at(9), blogNextAt: at(18) });
    const b = nextBlogState(at(10, 0, '2026-11-12'), a, false, 0);
    expect(b).toMatchObject({ blogDay: '2026-11-12', blogCount: 0, blogLastAt: at(9), blogNextAt: 0 });
  });
});

describe('günlük taslak üretimi', () => {
  it('günde bir kez ve 07:00 sonrası', () => {
    expect(blogGenDue(at(6), undefined)).toBe(false);
    expect(blogGenDue(at(8), undefined)).toBe(true);
    expect(blogGenDue(at(8), DAY)).toBe(false);
    expect(blogGenDue(at(8), '2026-11-10')).toBe(true);
  });
});

describe('nextAutoSlot', () => {
  const now = at(9);
  it('acil (özel gün) hemen sıraya girer', () => {
    expect(nextAutoSlot(now, at(10, 0, '2026-11-20'), true)).toBe(now);
  });
  it('kuyruk boşken ertesi gün 10:00 TSİ', () => {
    const t = nextAutoSlot(now, 0, false);
    expect(trHour(t)).toBe(BLOG_PUBLISH_HOUR);
    expect(trDayKey(t)).toBe('2026-11-12');
  });
  it('kuyruk doluysa son yazıdan 2 gün sonra, her zaman geleceğe', () => {
    const t = nextAutoSlot(now, at(10, 0, '2026-11-15'), false);
    expect(trDayKey(t)).toBe('2026-11-17');
    expect(trHour(t)).toBe(BLOG_PUBLISH_HOUR);
    expect(nextAutoSlot(now, at(10, 0, '2026-10-01'), false)).toBeGreaterThanOrEqual(now + H);
  });
});
