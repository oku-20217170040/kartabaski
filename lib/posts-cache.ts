import 'server-only';

import { cache } from 'react';
import { getPostBySlug } from './posts';
import type { Post } from './posts-types';

// Önbellekli yayın listesi `lib/posts.ts` içinde (tag: 'posts'); admin server action'ları revalidateTag('posts') ile temizler.
export { getCachedPublishedPosts } from './posts';

/** Aynı istek içinde tekrar tekrar sorgulanmasın (generateMetadata + sayfa). */
export const getCachedPost = cache(async (slug: string): Promise<Post | null> => getPostBySlug(slug));
