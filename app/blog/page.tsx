import BlogList, { blogListMetadata } from '@/components/blog/BlogList';
import { getCachedPublishedPosts } from '@/lib/posts-cache';
import './blog.css';

export const revalidate = 600;

export const metadata = blogListMetadata(1);

export default async function BlogIndex() {
  const posts = await getCachedPublishedPosts().catch(() => []);
  return <BlogList posts={posts} page={1} />;
}
