import 'server-only';

import { revalidateTag } from 'next/cache';
import { listScheduled, publishPostNow } from './posts';
import { sendTelegramText } from './notify';
import { SITE_URL } from './site';
import { BLOG_GRACE_MS } from './blog-cadence';
import type { Post } from './posts-types';

/**
 * Cron turundan çağrılır: vakti gelen en eski planlı yazıyı (en fazla bir tane) yayınlar, önbelleği yeniler,
 * Telegram'a haber verir. `nextAt`: yayından sonra sırada kalan ilk yazının tarihi (yoksa 0) — sıklık kuralı
 * (`lib/blog-cadence.ts`) bir sonraki okumayı buna göre erteler. `knownQueue` verilirse koleksiyon yeniden okunmaz.
 */
export async function runScheduledPublish(
  now = Date.now(),
  knownQueue?: Post[],
): Promise<{ slug: string | null; nextAt: number }> {
  const queue = knownQueue ?? (await listScheduled());
  const due = queue.find((p) => (p.scheduledAt ?? 0) <= now + BLOG_GRACE_MS);
  const rest = due ? queue.filter((p) => p.id !== due.id) : queue;
  const nextAt = rest[0]?.scheduledAt ?? 0;
  if (!due) return { slug: null, nextAt };
  const post = await publishPostNow(due.id, now);
  if (!post) return { slug: null, nextAt };
  revalidateTag('posts');
  // Telegram yapılandırılmamışsa sendTelegramText sessizce false döner; mesaj düz metindir.
  await sendTelegramText(
    `Yeni blog yazısı yayında\n${post.title}\n${SITE_URL}/blog/${post.slug}\n\nSırada ${rest.length} yazı var.`,
    { inline_keyboard: [[{ text: 'Yazıyı aç', url: `${SITE_URL}/blog/${post.slug}` }]] },
  ).catch(() => false);
  return { slug: post.slug, nextAt };
}
