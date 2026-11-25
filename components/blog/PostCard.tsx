import Link from 'next/link';
import Image from 'next/image';
import { cloudinaryUrl } from '@/lib/format';
import { readingMinutes, type Post } from '@/lib/posts-types';

export function formatPostDate(ts: number): string {
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
}

interface Props {
  post: Post;
  /** Üstteki kartlar hemen yüklensin. */
  priority?: boolean;
  /** Başlık seviyesi (sayfa yapısına göre). */
  headingLevel?: 2 | 3;
}

export default function PostCard({ post, priority = false, headingLevel = 2 }: Props) {
  const H = headingLevel === 3 ? 'h3' : 'h2';
  const date = post.publishedAt || post.updatedAt;
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      <div className="blog-card-media">
        {post.coverImage && (
          <Image
            src={cloudinaryUrl(post.coverImage, 'f_auto,q_auto,w_720,h_450,c_fill')}
            alt=""
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 380px"
            priority={priority}
          />
        )}
      </div>
      <div className="blog-card-body">
        <H className="blog-card-title">{post.title}</H>
        {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}
        <span className="blog-card-meta">
          {formatPostDate(date)} · {readingMinutes(post.content)} dk okuma
        </span>
      </div>
    </Link>
  );
}
