import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import PostCard, { formatPostDate } from '@/components/blog/PostCard';
import { WhatsAppIcon, ChevronDownIcon } from '@/components/icons';
import { getCachedPost, getCachedPublishedPosts } from '@/lib/posts-cache';
import { getProductsByIds } from '@/lib/blog-products';
import { renderMarkdown, extractHeadings } from '@/lib/markdown';
import { readingMinutes } from '@/lib/posts-types';
import { postSeo, postDescription } from '@/lib/blog-seo';
import { faqPageSchema } from '@/lib/faq-schema';
import { relatedPosts } from '@/lib/blog-match';
import { cn } from '@/lib/utils';
import { cloudinaryUrl } from '@/lib/format';
import { SITE_URL, jsonLdString } from '@/lib/site';
import { SITE_NAME, WHATSAPP_BASE, PHONE_DISPLAY } from '@/lib/constants';
import '../blog.css';

export const revalidate = 600;

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getCachedPost(params.slug).catch(() => null);
  if (!post) return { title: 'Yazı bulunamadı', robots: { index: false } };

  const seo = postSeo(post.slug);
  const description = postDescription(post);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.coverImage ? cloudinaryUrl(post.coverImage, 'f_auto,q_auto,w_1200,h_630,c_fill') : undefined;
  return {
    title: seo.title ? { absolute: seo.title } : post.title,
    description,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: seo.title || post.title,
      description,
      type: 'article',
      locale: 'tr_TR',
      url,
      siteName: SITE_NAME,
      publishedTime: new Date(post.publishedAt || post.updatedAt).toISOString(),
      modifiedTime: new Date(post.updatedAt || post.publishedAt).toISOString(),
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: post.title }] }),
    },
    twitter: { card: 'summary_large_image', title: post.title, description, ...(image && { images: [image] }) },
  };
}

export default async function BlogPost({ params }: Props) {
  const post = await getCachedPost(params.slug).catch(() => null);
  if (!post) notFound();

  const [all, products] = await Promise.all([
    getCachedPublishedPosts().catch(() => []),
    getProductsByIds(post.productIds),
  ]);
  const more = relatedPosts(all, post, 3);

  const seo = postSeo(post.slug);
  const heading = seo.title ? seo.title.replace(new RegExp(`\\s*\\|\\s*${SITE_NAME}$`), '') : post.title;
  const html = renderMarkdown(post.content);
  const toc = extractHeadings(post.content);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const published = new Date(post.publishedAt || post.updatedAt);
  const image = post.coverImage ? cloudinaryUrl(post.coverImage, 'f_auto,q_auto,w_1200,h_630,c_fill') : undefined;
  const credit = post.coverCredit;
  const waText = `Merhaba, "${post.title}" yazınızı okudum. Kupa baskı hakkında bilgi almak istiyorum.`;

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: heading,
    description: postDescription(post),
    ...(image && { image }),
    datePublished: published.toISOString(),
    dateModified: new Date(post.updatedAt || post.publishedAt).toISOString(),
    mainEntityOfPage: url,
    keywords: post.tags.join(', '),
    inLanguage: 'tr-TR',
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };
  const faq = faqPageSchema(post.faq);

  return (
    <>
      <Navbar />
      <main id="icerik" className="blog-main">
        <div className="wrap">
          <article className="blog-article">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li><Link href="/blog">Blog</Link></li>
                <li aria-current="page">{post.title.length > 40 ? `${post.title.slice(0, 40)}…` : post.title}</li>
              </ol>
            </nav>

            <header>
              <h1 className="blog-title">{heading}</h1>
              {seo.answer && <p className="blog-lead blog-answer">{seo.answer}</p>}
              {post.excerpt && <p className="blog-lead">{post.excerpt}</p>}
              <p className="blog-meta">
                <time dateTime={published.toISOString()}>{formatPostDate(published.getTime())}</time>
                {' · '}{readingMinutes(post.content)} dk okuma
                {post.updatedAt - post.publishedAt > 86400000 && post.publishedAt > 0 && <> · Güncellendi: {formatPostDate(post.updatedAt)}</>}
              </p>
            </header>

            {image && (
              <div className={cn('blog-cover', credit && 'has-credit')}>
                <Image src={image} alt={post.title} fill sizes="(max-width: 800px) 100vw, 760px" priority />
              </div>
            )}
            {image && credit && (
              <p className="blog-credit">
                <a href={credit.url} target="_blank" rel="noopener noreferrer">
                  Temsilî fotoğraf: {credit.author ? `${credit.author} · ` : ''}{credit.source} ({credit.license})
                </a>
              </p>
            )}

            {toc.length >= 3 && (
              <nav className="blog-toc" aria-label="İçindekiler">
                <strong>İçindekiler</strong>
                <ol>{toc.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ol>
              </nav>
            )}

            <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />

            {post.faq.length > 0 && (
              <section className="blog-faq" aria-labelledby="sss">
                <h2 id="sss">Sık sorulan sorular</h2>
                <div className="faq">
                  {post.faq.map((f) => (
                    <details key={f.q}>
                      <summary>{f.q}<ChevronDownIcon size={18} /></summary>
                      <div>{f.a}</div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {products.length > 0 && (
              <section className="blog-products" aria-labelledby="yazidaki-urunler">
                <h2 id="yazidaki-urunler">Yazıdaki modeller</h2>
                <div className="product-grid">
                  {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 2} />)}
                </div>
              </section>
            )}

            <aside className="blog-cta">
              <div>
                <strong>Kupanızı birlikte tasarlayalım</strong>
                <span>Tek adetten toplu siparişe · ücretsiz tasarım · {PHONE_DISPLAY}</span>
              </div>
              <a className="btn btn-light" href={`${WHATSAPP_BASE}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp&apos;tan yazın
              </a>
            </aside>
          </article>

          {more.length > 0 && (
            <section className="blog-more" aria-labelledby="diger-yazilar">
              <h2 id="diger-yazilar">Diğer yazılar</h2>
              <div className="blog-grid">
                {more.map((p) => <PostCard key={p.id} post={p} headingLevel={3} />)}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faq) }} />}
    </>
  );
}
