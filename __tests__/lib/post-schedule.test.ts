/**
 * @jest-environment node
 */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__DELETE__' } }));
jest.mock('next/cache', () => ({ revalidateTag: jest.fn(), unstable_cache: (fn: unknown) => fn }));
jest.mock('@/lib/notify', () => ({ sendTelegramText: jest.fn().mockResolvedValue(false) }));

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();
const apply = (id: string, patch: Doc) => {
  const cur = { ...(store.get(id) ?? {}) };
  for (const [k, v] of Object.entries(patch)) { if (v === '__DELETE__') delete cur[k]; else cur[k] = v; }
  store.set(id, cur);
};
jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      get: async () => ({ docs: Array.from(store.entries()).map(([id, d]) => ({ id, data: () => d })) }),
      doc: (id: string) => ({
        _id: id,
        get: async () => ({ id, exists: store.has(id), data: () => store.get(id) }),
        update: async (patch: Doc) => apply(id, patch),
      }),
    }),
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        update: (ref: { _id: string }, patch: Doc) => ops.push(() => apply(ref._id, patch)),
        commit: async () => ops.forEach((o) => o()),
      };
    },
  },
}));

import { listScheduled, moveScheduled, publishDue, publishPostNow } from '@/lib/posts';
import { runScheduledPublish } from '@/lib/post-schedule';

const DAY = 86400000;
const T0 = 1_800_000_000_000;
const seed = () => {
  store.clear();
  store.set('a', { slug: 'a', title: 'A', published: false, scheduledAt: T0 + 1 * DAY });
  store.set('b', { slug: 'b', title: 'B', published: false, scheduledAt: T0 + 2 * DAY });
  store.set('c', { slug: 'c', title: 'C', published: false, scheduledAt: T0 + 3 * DAY });
  store.set('d', { slug: 'd', title: 'D', published: false }); // plansız taslak
  store.set('e', { slug: 'e', title: 'E', published: true, publishedAt: 5 });
};

describe('blog yayın takvimi', () => {
  beforeEach(seed);

  it('yalnız planlı taslakları tarih sırasıyla listeler', async () => {
    expect((await listScheduled()).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('vakti gelmemişse yayınlamaz; gelince yalnız en eskisini yayınlar', async () => {
    expect(await publishDue(T0)).toBeNull();
    const p = await publishDue(T0 + 10 * DAY); // 3 yazı da gecikmiş
    expect(p?.id).toBe('a');
    expect(store.get('a')).toMatchObject({ published: true });
    expect(store.get('a')?.scheduledAt).toBeUndefined();
    expect(store.get('b')?.published).toBe(false); // birikim tek seferde dökülmez
  });

  it('öne al / ertele iki yazının tarihini yer değiştirir', async () => {
    expect(await moveScheduled('b', 'up')).toBe(true);
    expect((await listScheduled()).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(await moveScheduled('c', 'down')).toBe(false); // sonda
    expect(await moveScheduled('b', 'up')).toBe(false); // başta
  });

  it('şimdi yayınla takvimden çıkarır; yayındaki yazıya dokunmaz', async () => {
    expect((await publishPostNow('c', T0))?.id).toBe('c');
    expect((await listScheduled()).map((p) => p.id)).toEqual(['a', 'b']);
    expect(await publishPostNow('e')).toBeNull();
  });
});

describe('runScheduledPublish (cron)', () => {
  beforeEach(seed);

  it('vakti gelen en eski yazıyı yayınlar ve kalan sıranın ilk tarihini döndürür', async () => {
    const res = await runScheduledPublish(T0 + 1 * DAY);
    expect(res).toEqual({ slug: 'a', nextAt: T0 + 2 * DAY });
    expect(store.get('a')?.published).toBe(true);
  });

  it('vakti gelen yoksa hiçbir şey yayınlamaz', async () => {
    const res = await runScheduledPublish(T0);
    expect(res.slug).toBeNull();
    expect(res.nextAt).toBe(T0 + 1 * DAY);
  });

  it('bilinen kuyruk verilirse koleksiyonu yeniden okumadan çalışır', async () => {
    const queue = await listScheduled();
    const res = await runScheduledPublish(T0 + 5 * DAY, queue.slice(1)); // a hariç
    expect(res.slug).toBe('b');
  });
});
