import { matchPostsForProduct, relatedPosts } from '@/lib/blog-match';
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

describe('relatedPosts', () => {
  const current = mk('simdiki', { productIds: ['p1'], categories: ['Sihirli Kupa'], tags: ['İsimli Kupa', 'hediye'] });

  it('ortak ürün, kategori ve etiket puanına göre sıralar; kendisini ve taslakları atlar', () => {
    const posts = [
      current,
      mk('yeni-alakasiz', { publishedAt: 900 }),
      mk('etiket', { tags: ['isimli kupa'], publishedAt: 300 }),
      mk('kategori', { categories: ['Sihirli Kupa'], publishedAt: 200 }),
      mk('urun', { productIds: ['p1'], publishedAt: 100 }),
      mk('taslak', { productIds: ['p1'], published: false }),
    ];
    expect(relatedPosts(posts, current).map((p) => p.id)).toEqual(['urun', 'kategori', 'etiket']);
  });

  it('puanlar toplanır; eşitlikte yeni olan önce gelir', () => {
    const posts = [
      mk('eski', { categories: ['Sihirli Kupa'], publishedAt: 10 }),
      mk('yeni', { categories: ['Sihirli Kupa'], publishedAt: 20 }),
      mk('toplam', { categories: ['Sihirli Kupa'], tags: ['hediye'], publishedAt: 5 }),
    ];
    expect(relatedPosts(posts, current).map((p) => p.id)).toEqual(['toplam', 'yeni', 'eski']);
  });

  it('ilgili yazı yetmezse en yenilerle tamamlar', () => {
    const posts = [
      mk('a', { publishedAt: 1 }),
      mk('b', { publishedAt: 3 }),
      mk('c', { publishedAt: 2 }),
      mk('ilgili', { tags: ['hediye'], publishedAt: 1 }),
    ];
    expect(relatedPosts(posts, current).map((p) => p.id)).toEqual(['ilgili', 'b', 'c']);
    expect(relatedPosts([current], current)).toEqual([]);
  });
});
