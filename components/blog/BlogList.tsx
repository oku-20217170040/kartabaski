import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PostCard from '@/components/blog/PostCard';
import BlogPager from '@/components/blog/BlogPager';
import { blogPageCount, blogPagePath, blogPageSlice } from '@/lib/blog-pages';
import { SITE_URL, jsonLdString } from '@/lib/site';
import { SITE_NAME } from '@/lib/constants';
import type { Post } from '@/lib/posts-types';

const TITLE = 'Blog: Kupa Baskı Rehberi ve Hediye Fikirleri';
const DESCRIPTION =
  'Kişiye özel kupa baskı rehberleri, hediye fikirleri, sihirli kupa ve baskı bakımı hakkında pratik yazılar. KAR-TA BASKI blogu.';

export function blogListMetadata(page: number): Metadata {
  const suffix = page > 1 ? ` - Sayfa ${page}` : '';
  const title = `${TITLE}${suffix}`;
  const description = page > 1 ? `Sayfa ${page}: ${DESCRIPTION}` : DESCRIPTION;
  const url = `${SITE_URL}${blogPagePath(page)}`;
  return {
    title,
    description,
    alternates: { canonical: url, types: { 'application/rss+xml': `${SITE_URL}/feed.xml` } },
    openGraph: { title: `Blog${suffix} | ${SITE_NAME}`, description, type: 'website', locale: 'tr_TR', url },
  };
}

/** `/blog` ve `/blog/sayfa/<n>` ortak görünümü. `posts`: yayındaki tüm yazılar, yeni önce. */
export default function BlogList({ posts, page }: { posts: Post[]; page: number }) {
  const shown = blogPageSlice(posts, page);
  const url = `${SITE_URL}${blogPagePath(page)}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: page > 1 ? `${SITE_NAME} Blog - Sayfa ${page}` : `${SITE_NAME} Blog`,
    url,
    inLanguage: 'tr-TR',
    blogPost: shown.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: new Date(p.publishedAt || p.updatedAt).toISOString(),
    })),
  };

  return (
    <>
      <Navbar />
      <main id="icerik" className="blog-main">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                {page > 1 ? (
                  <>
                    <li><Link href="/blog">Blog</Link></li>
                    <li aria-current="page">Sayfa {page}</li>
                  </>
                ) : (
                  <li aria-current="page">Blog</li>
                )}
              </ol>
            </nav>
            <h1 className="display">Kupa baskı <em>rehberi</em></h1>
            <p className="lead">Hediye fikirleri, model seçimi, baskı ve bakım üzerine kısa, işe yarar yazılar.</p>
          </header>

          <section className="section-tight" aria-label="Blog yazıları">
            {shown.length === 0 ? (
              <p className="blog-empty">Yazılar çok yakında burada olacak.</p>
            ) : (
              <div className="blog-grid">
                {shown.map((p, i) => (
                  <PostCard key={p.id} post={p} priority={i < 3} />
                ))}
              </div>
            )}
            <BlogPager page={page} total={blogPageCount(posts.length)} />
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
    </>
  );
}
