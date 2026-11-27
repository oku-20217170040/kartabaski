import { BLOG_PAGE_SIZE, blogPageCount, blogPageNumbers, blogPagePath, blogPageSlice, parseBlogPage } from '@/lib/blog-pages';

describe('blog sayfalaması', () => {
  it('1. sayfa /blog, sonrakiler /blog/sayfa/n', () => {
    expect(blogPagePath(1)).toBe('/blog');
    expect(blogPagePath(3)).toBe('/blog/sayfa/3');
  });

  it('sayfa başına 24 yazı', () => {
    expect(BLOG_PAGE_SIZE).toBe(24);
    expect([0, 1, 24, 25, 110].map(blogPageCount)).toEqual([1, 1, 1, 2, 5]);
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(blogPageSlice(items, 1)).toHaveLength(24);
    expect(blogPageSlice(items, 3)).toEqual([48, 49]);
    expect(blogPageSlice(items, 4)).toEqual([]);
  });

  it('geçersiz sayfa numaralarını reddeder', () => {
    expect(parseBlogPage('2')).toBe(2);
    for (const raw of ['0', '-1', '02', '2.5', '2a', '', 'abc', '1e3', '123456']) expect(parseBlogPage(raw)).toBeNull();
  });

  it('uzun listede aradaki sayfaları kısaltır', () => {
    expect(blogPageNumbers(1, 1)).toEqual([1]);
    expect(blogPageNumbers(1, 5)).toEqual([1, 2, null, 5]);
    expect(blogPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(blogPageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
  });
});
