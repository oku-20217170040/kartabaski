/** @jest-environment node */
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => { throw new Error('404'); }),
  permanentRedirect: jest.fn((to: string) => { throw new Error(`308 ${to}`); }),
}));
jest.mock('@/lib/posts-cache', () => ({ getCachedPublishedPosts: jest.fn() }));
jest.mock('@/components/blog/BlogList', () => ({ __esModule: true, default: () => null, blogListMetadata: jest.fn() }));

import BlogSubPage from '@/app/blog/sayfa/[sayfa]/page';
import { getCachedPublishedPosts } from '@/lib/posts-cache';

const posts = getCachedPublishedPosts as jest.Mock;
const open = (sayfa: string) => BlogSubPage({ params: { sayfa } });

describe('/blog/sayfa/[sayfa]', () => {
  beforeEach(() => posts.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: String(i) }))));

  it('var olan sayfayı çizer', async () => {
    await expect(open('2')).resolves.toMatchObject({ props: { page: 2 } });
  });

  it('1. sayfayı /blog adresine yönlendirir', async () => {
    await expect(open('1')).rejects.toThrow('308 /blog');
  });

  it('geçersiz ya da olmayan sayfada 404 verir', async () => {
    for (const raw of ['0', '3', '02', 'abc']) await expect(open(raw)).rejects.toThrow('404');
  });

  it('okuma hatasını 404 saymaz', async () => {
    posts.mockRejectedValue(new Error('kota'));
    await expect(open('2')).rejects.toThrow('kota');
  });
});
