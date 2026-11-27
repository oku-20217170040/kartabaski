import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import BlogList, { blogListMetadata } from '@/components/blog/BlogList';
import { getCachedPublishedPosts } from '@/lib/posts-cache';
import { blogPageCount, parseBlogPage } from '@/lib/blog-pages';
import '../../blog.css';

export const revalidate = 600;

// Derlemede sayfa üretilmez; her sayfa ilk istekte üretilip ISR ile saklanır.
export function generateStaticParams(): { sayfa: string }[] {
  return [];
}

interface Props { params: { sayfa: string } }

export function generateMetadata({ params }: Props): Metadata {
  const page = parseBlogPage(params.sayfa);
  return page ? blogListMetadata(page) : { title: 'Sayfa bulunamadı', robots: { index: false } };
}

export default async function BlogSubPage({ params }: Props) {
  const page = parseBlogPage(params.sayfa);
  if (!page) notFound();
  if (page === 1) permanentRedirect('/blog');

  // Okuma hatası bilerek yakalanmaz: geçici bir hata 404 olarak önbelleğe girmesin.
  const posts = await getCachedPublishedPosts();
  if (page > blogPageCount(posts.length)) notFound();

  return <BlogList posts={posts} page={page} />;
}
