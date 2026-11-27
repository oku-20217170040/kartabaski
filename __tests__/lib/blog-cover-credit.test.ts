/**
 * @jest-environment node
 */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('firebase-admin/firestore', () => {
  class FieldValue {
    static delete() { return Object.assign(new FieldValue(), { isDelete: true }); }
  }
  return { FieldValue };
});
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

let stored: Record<string, unknown> = {};
const set = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: async () => ({ data: () => stored }), set: (...args: unknown[]) => set(...args) }),
    }),
  },
}));

import { savePost, toPost, type PostInput } from '@/lib/posts';

const credit = { author: 'Ayşe', source: 'Unsplash', url: 'https://unsplash.com/photos/x', license: 'Unsplash License' };
const input = (coverImage?: string): PostInput => ({
  slug: 'yazi', title: 'Yazı', excerpt: '', content: '', tags: [], faq: [], published: true, coverImage,
});

describe('coverCredit okuma', () => {
  it('eksiksiz kaynak bilgisini okur; yazar isteğe bağlıdır', () => {
    expect(toPost('1', { coverCredit: credit }).coverCredit).toEqual(credit);
    const { author, ...noAuthor } = credit;
    expect(toPost('1', { coverCredit: noAuthor }).coverCredit).toEqual(noAuthor);
  });

  it('eksik ya da güvensiz bağlantılı bilgiyi yok sayar', () => {
    for (const bad of [undefined, 'x', { ...credit, url: 'javascript:alert(1)' }, { ...credit, source: '' }, { ...credit, license: 3 }]) {
      expect(toPost('1', { coverCredit: bad }).coverCredit).toBeUndefined();
    }
  });
});

describe('savePost kapak kaynağı', () => {
  beforeEach(() => {
    set.mockClear();
    stored = { coverImage: 'karta-baski/blog/eski', coverCredit: credit, auto: true };
  });
  const written = () => set.mock.calls[0][0] as Record<string, unknown>;

  it('kapak aynı kalırsa alana dokunmaz (merge korur)', async () => {
    await savePost(input('karta-baski/blog/eski'), '1');
    expect(written()).not.toHaveProperty('coverCredit');
    expect(set.mock.calls[0][1]).toEqual({ merge: true });
  });

  it('kapak değişince ya da kaldırılınca siler', async () => {
    await savePost(input('karta-baski/blog/yeni'), '1');
    expect(written().coverCredit).toMatchObject({ isDelete: true });
    set.mockClear();
    await savePost(input(undefined), '1');
    expect(written().coverCredit).toMatchObject({ isDelete: true });
  });
});
