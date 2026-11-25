import { buildPlan, buildBlogDraft, summarize } from '@/lib/instagram-auto-utils';
import { trTime } from '@/lib/instagram-utils';
import { activeCampaign, type SocialProductRow, type BlogLite } from '@/lib/social-content-utils';

const DAY = '2026-11-25';
const NOW = trTime(DAY, 6, 30);

const row = (id: string, over: Partial<SocialProductRow> = {}): SocialProductRow => ({
  id, title: `Kupa ${id}`, slug: `kupa-${id}`, category: 'Lüks Kupa', priceMin: 150, priceMax: 250, shortDesc: 'Kısa', description: '',
  deliveryDays: 3, imageIds: [`img/${id}/1`, `img/${id}/2`, `img/${id}/3`], active: true, createdAt: 1, updatedAt: 1, ...over,
});

const base = { day: DAY, now: NOW, recent: new Map<string, number>(), feedCount: 2, storyCount: 3, windowStart: 10, windowEnd: 21 };

describe('buildPlan', () => {
  const rows = [row('a'), row('b'), row('c'), row('d')];

  it('kotaya göre karusel ve hikâye taslakları üretir', () => {
    const plan = buildPlan({ ...base, rows });
    expect(plan.filter((p) => p.kind === 'carousel')).toHaveLength(2);
    expect(plan.filter((p) => p.kind === 'story')).toHaveLength(3);
    expect(plan.every((p) => p.status === 'taslak' && p.day === DAY && p.publishAt >= NOW)).toBe(true);
  });

  it('karusel modelin tüm fotoğraflarını taşır, hikâye tek fotoğraf ve açıklamasızdır', () => {
    const plan = buildPlan({ ...base, rows });
    const car = plan.find((p) => p.kind === 'carousel')!;
    expect(car.items).toHaveLength(3);
    expect(new Set(car.items.map((i) => i.productId)).size).toBe(1);
    expect(car.caption).toContain('#kartabaski');
    const st = plan.find((p) => p.kind === 'story')!;
    expect(st.items).toHaveLength(1);
    expect(st.caption).toBe('');
  });

  it('iki karusel farklı modelleri paylaşır', () => {
    const cars = buildPlan({ ...base, rows }).filter((p) => p.kind === 'carousel');
    expect(cars[0].items[0].productId).not.toBe(cars[1].items[0].productId);
  });

  it('pasif ya da görselsiz ürünler dışlanır; uygun ürün yoksa plan boş', () => {
    expect(buildPlan({ ...base, rows: [row('x', { active: false }), row('y', { imageIds: [] })] })).toEqual([]);
  });

  it('en fazla 10 fotoğraf alınır', () => {
    const many = row('m', { imageIds: Array.from({ length: 14 }, (_, i) => `i/${i}`) });
    const car = buildPlan({ ...base, rows: [many], feedCount: 1, storyCount: 0 })[0];
    expect(car.items).toHaveLength(10);
  });

  it('kampanya verilirse ilk karusel kampanya gönderisi olur', () => {
    const campaign = activeCampaign(NOW)!;
    const plan = buildPlan({ ...base, rows, campaign });
    const first = plan.find((p) => p.kind === 'carousel')!;
    expect(first.theme).toBe(campaign.key);
    expect(first.items.length).toBeGreaterThanOrEqual(2);
    expect(first.caption).toContain('Kara Cuma');
    expect(plan.filter((p) => p.theme)).toHaveLength(1);
  });

  it('kota 0 ise taslak çıkmaz', () => {
    expect(buildPlan({ ...base, rows, feedCount: 0, storyCount: 0 })).toEqual([]);
  });
});

describe('buildBlogDraft', () => {
  const post: BlogLite = { id: 'p1', slug: 'kupa-rehberi', title: 'Kupa rehberi', excerpt: 'Özet', published: true, publishedAt: 5, coverImage: 'karta-baski/blog/kapak' };
  const o = { now: NOW, day: DAY, windowStart: 10, windowEnd: 21, leadMs: 3600000 };

  it('kapak görselli blog taslağı üretir ve pencerede zamanlar', () => {
    const d = buildBlogDraft(post, o)!;
    expect(d.kind).toBe('blog');
    expect(d.refId).toBe('p1');
    expect(d.items[0].imageId).toBe('karta-baski/blog/kapak');
    expect(d.publishAt).toBe(trTime(DAY, 10, 0)); // 06:30 + 1 sa pencere dışı → 10:00
    expect(d.caption).toContain('kartabaski.com/blog/kupa-rehberi');
  });
  it('kapak yoksa yedek görseli kullanır, o da yoksa null', () => {
    expect(buildBlogDraft({ ...post, coverImage: undefined }, { ...o, fallbackImage: 'img/x' })?.items[0].imageId).toBe('img/x');
    expect(buildBlogDraft({ ...post, coverImage: undefined }, o)).toBeNull();
  });
});

describe('summarize', () => {
  it('durumları sayar', () => {
    expect(summarize([
      { status: 'taslak', kind: 'carousel' }, { status: 'taslak', kind: 'story' }, { status: 'yayinlandi', kind: 'blog' }, { status: 'hata', kind: 'story' },
    ])).toEqual({ draft: 2, published: 1, failed: 1, stories: 2, feeds: 2 });
  });
});
