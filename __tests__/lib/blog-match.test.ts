import { matchPostsForProduct } from '@/lib/blog-match';
import type { Post } from '@/lib/posts-types';

const mk = (id: string, over: Partial<Post> = {}): Post => ({
  id, slug: id, title: id, excerpt: '', content: '', tags: [], faq: [], published: true, publishedAt: 100, updatedAt: 100, ...over,
});

describe('matchPostsForProduct', () => {
  it('ürünün geçtiği yazı, kategori eşleşmesinden önce gelir', () => {
    const posts = [
      mk('kat', { categories: ['Sihirli Kupa'], publishedAt: 500 }),
      mk('urun', { productIds: ['p1'], publishedAt: 100 }),
      mk('alakasiz', { productIds: ['p2'] }),
    ];
    expect(matchPostsForProduct(posts, 'p1', 'Sihirli Kupa').map((p) => p.id)).toEqual(['urun', 'kat']);
  });

  it('yayında olmayanları ve limiti dikkate alır', () => {
    const posts = [
      mk('a', { categories: ['Lüks Kupa'], published: false }),
      mk('b', { categories: ['Lüks Kupa'], publishedAt: 3 }),
      mk('c', { categories: ['Lüks Kupa'], publishedAt: 2 }),
      mk('d', { categories: ['Lüks Kupa'], publishedAt: 1 }),
    ];
    expect(matchPostsForProduct(posts, 'x', 'Lüks Kupa', 2).map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('eşleşme yoksa boş döner', () => {
    expect(matchPostsForProduct([mk('a')], 'p1', 'Lüks Kupa')).toEqual([]);
  });
});
