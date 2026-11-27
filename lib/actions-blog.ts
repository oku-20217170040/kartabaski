'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from './require-admin';
import {
  listPosts, getPostById, savePost, deletePost, slugTaken, moveScheduled, publishPostNow, setSchedule, COVER_ID_RE,
} from './posts';
import { getProductsServer } from './products-server';
import { generateBlogDraft, getBlogAutoStatus, type BlogAutoStatus } from './blog-auto';
import { CATEGORIES } from '@/types';
import type { Post } from './posts-types';

const PostInputSchema = z.object({
  slug: z.string().trim().min(3, 'Adres en az 3 karakter olmalı').max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Adres yalnızca küçük harf, rakam ve tire içerebilir'),
  title: z.string().trim().min(3, 'Başlık en az 3 karakter olmalı').max(140),
  excerpt: z.string().trim().max(320),
  content: z.string().max(60000),
  coverImage: z.string().regex(COVER_ID_RE, 'Geçersiz kapak görseli').optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  faq: z.array(z.object({ q: z.string().trim().min(3).max(220), a: z.string().trim().min(3).max(1200) })).max(10),
  productIds: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  categories: z.array(z.enum(CATEGORIES as [string, ...string[]])).max(CATEGORIES.length).optional(),
  published: z.boolean(),
  scheduledAt: z.number().int().positive().optional(),
  auto: z.boolean().optional(),
});

export async function getPostsAdminAction(): Promise<Post[]> {
  await requireAdmin();
  return listPosts(false);
}

export async function getPostAdminAction(id: string): Promise<Post | null> {
  await requireAdmin();
  return getPostById(id);
}

/** Editördeki ürün seçimi için hafif liste. */
export async function getProductOptionsAction(): Promise<{ id: string; title: string; category: string }[]> {
  await requireAdmin();
  const items = await getProductsServer();
  return items.map((p) => ({ id: p.id, title: p.title, category: p.category })).sort((a, b) => a.title.localeCompare(b.title, 'tr'));
}

export async function savePostAction(data: Omit<Post, 'id' | 'publishedAt' | 'updatedAt' | 'coverCredit'>, id?: string): Promise<string> {
  await requireAdmin();
  const parsed = PostInputSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Yazı bilgileri geçersiz.');
  if (await slugTaken(parsed.data.slug, id)) throw new Error('Bu adres başka bir yazıda kullanılıyor.');
  const saved = await savePost(parsed.data, id);
  revalidateTag('posts');
  return saved;
}

/** Planlı yazıyı sırada yukarı/aşağı taşır (tarihler yer değiştirir). */
export async function movePostScheduleAction(id: string, dir: 'up' | 'down'): Promise<boolean> {
  await requireAdmin();
  const moved = await moveScheduled(id, dir);
  if (moved) revalidateTag('posts');
  return moved;
}

export async function publishPostNowAction(id: string): Promise<void> {
  await requireAdmin();
  await publishPostNow(id);
  revalidateTag('posts');
}

/** Tarih verilirse planlar, null ise takvimden çıkarır. */
export async function setPostScheduleAction(id: string, at: number | null): Promise<void> {
  await requireAdmin();
  if (at !== null && (!Number.isFinite(at) || at < Date.now() - 86400000)) throw new Error('Geçersiz tarih.');
  await setSchedule(id, at);
  revalidateTag('posts');
}

export async function deletePostAction(id: string): Promise<void> {
  await requireAdmin();
  await deletePost(id);
  revalidateTag('posts');
}

/** "Şimdi taslak üret": sıradaki konudan (ya da verilen konudan) taslak oluşturur ve takvime ekler. */
export async function generateDraftNowAction(): Promise<{ id: string; title: string; slug: string; source: string } | null> {
  await requireAdmin();
  const res = await generateBlogDraft();
  if (!res) return null;
  return { id: res.post.id, title: res.post.title, slug: res.post.slug, source: res.source };
}

export async function getBlogAutoStatusAction(): Promise<BlogAutoStatus> {
  await requireAdmin();
  return getBlogAutoStatus();
}
