import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PostCard from '@/components/blog/PostCard';
import { getCachedPublishedPosts } from '@/lib/posts-cache';
import { SITE_URL, jsonLdString } from '@/lib/site';
import { SITE_NAME } from '@/lib/constants';
import './blog.css';

export const revalidate = 600;

const TITLE = 'Blog: Kupa Baskı Rehberi ve Hediye Fikirleri';
const DESCRIPTION =
  'Kişiye özel kupa baskı rehberleri, hediye fikirleri, sihirli kupa ve baskı bakımı hakkında pratik yazılar. KAR-TA BASKI blogu.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { title: `Blog | ${SITE_NAME}`, description: DESCRIPTION, type: 'website', locale: 'tr_TR', url: `${SITE_URL}/blog` },
};

export default async function BlogIndex() {
  const posts = await getCachedPublishedPosts().catch(() => []);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} Blog`,
    url: `${SITE_URL}/blog`,
    inLanguage: 'tr-TR',
    blogPost: posts.slice(0, 20).map((p) => ({
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
                <li aria-current="page">Blog</li>
              </ol>
            </nav>
            <h1 className="display">Kupa baskı <em>rehberi</em></h1>
            <p className="lead">Hediye fikirleri, model seçimi, baskı ve bakım üzerine kısa, işe yarar yazılar.</p>
          </header>

          <section className="section-tight" aria-label="Blog yazıları">
            {posts.length === 0 ? (
              <p className="blog-empty">Yazılar çok yakında burada olacak.</p>
            ) : (
              <div className="blog-grid">
                {posts.map((p, i) => (
                  <PostCard key={p.id} post={p} priority={i < 3} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
    </>
  );
}
