/** @jest-environment node */
jest.mock('@/lib/products-server', () => ({ getProductsServer: jest.fn() }));
jest.mock('@/lib/posts', () => ({ listPublishedPosts: jest.fn() }));

import sitemap from '@/app/sitemap';
import { getProductsServer } from '@/lib/products-server';
import { listPublishedPosts } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';

const mocked = getProductsServer as jest.Mock;
const mockedPosts = listPublishedPosts as jest.Mock;

beforeEach(() => {
  mocked.mockReset();
  mockedPosts.mockReset();
  mockedPosts.mockResolvedValue([]);
});

describe('sitemap', () => {
  it('yalnızca aktif ürünleri slug ile ekler', async () => {
    mocked.mockResolvedValue([
      { id: 'a', slug: 'urun-a', active: true, updatedAt: 1700000000000, createdAt: 0 },
      { id: 'b', slug: 'urun-b', active: false, updatedAt: 0, createdAt: 0 },
      { id: 'c', slug: '', active: true, updatedAt: 0, createdAt: 0 },
    ]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/urun/urun-a`);
    expect(urls).not.toContain(`${SITE_URL}/urun/urun-b`);
    expect(urls).toContain(`${SITE_URL}/urun/c`);
    expect(urls).toContain(SITE_URL);
  });

  it('hata durumunda statik sayfaları döndürür', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mocked.mockRejectedValue(new Error('x'));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/kategoriler`);
    expect(urls.some((u) => u.includes('/urun/'))).toBe(false);
  });

  it('blog liste sayfasını ve yayındaki yazıları ekler', async () => {
    mocked.mockResolvedValue([]);
    mockedPosts.mockResolvedValue([
      { id: '1', slug: 'sihirli-kupa', updatedAt: 1700000000000, publishedAt: 1690000000000 },
    ]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/blog`);
    expect(urls).toContain(`${SITE_URL}/blog/sihirli-kupa`);
  });

  it('blog okunamazsa sitemap yine de ürünlerle döner', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mocked.mockResolvedValue([{ id: 'a', slug: 'urun-a', active: true, updatedAt: 0, createdAt: 0 }]);
    mockedPosts.mockRejectedValue(new Error('x'));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/urun/urun-a`);
    expect(urls.some((u) => u.includes('/blog/'))).toBe(false);
  });
});
