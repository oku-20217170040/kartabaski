// Kök (varsayılan) sayfa metadata'sı — settings/seo belgesinden. app/layout.tsx `generateMetadata` ile kullanır.
// Google başlığı ~60, açıklamayı ~155 karakterde keser: admin sayfası bu sınırlara göre uyarır.
import type { Metadata } from 'next';
import { SITE_NAME } from './constants';
import { SITE_URL } from './site';
import { cloudinaryUrl } from './format';
import { DEFAULT_SEO, type SeoSettings, type CategorySeo } from './seo-settings';

export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MAX = 155;

const FALLBACK_OG = '/logo.png';

/** 'ok' sınır içinde, 'long' arama sonucunda kesilir, 'empty' boş. */
export function lengthStatus(text: string, max: number): 'ok' | 'long' | 'empty' {
  const n = text.trim().length;
  if (n === 0) return 'empty';
  return n > max ? 'long' : 'ok';
}

export function ogImageUrl(s: SeoSettings): string {
  return s.ogImage ? cloudinaryUrl(s.ogImage, 'f_auto,q_auto,w_1200,h_630,c_fill') : FALLBACK_OG;
}

/** Saf: ayarlardan tam kök metadata. */
export function composeRootMetadata(s: SeoSettings): Metadata {
  const og = ogImageUrl(s);
  return {
    metadataBase: new URL(SITE_URL),
    icons: {
      icon: [{ url: '/favicon.png', type: 'image/png' }],
      apple: { url: '/apple-touch-icon.png' },
      shortcut: '/favicon.png',
    },
    title: { default: s.siteTitle, template: `%s | ${SITE_NAME}` },
    description: s.description,
    keywords: s.keywords,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      url: SITE_URL,
      siteName: SITE_NAME,
      title: s.siteTitle,
      description: s.description,
      images: [{ url: og, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title: s.siteTitle, description: s.description, images: [og] },
    ...(s.googleVerification || s.bingVerification
      ? {
          verification: {
            ...(s.googleVerification ? { google: s.googleVerification } : {}),
            ...(s.bingVerification ? { other: { 'msvalidate.01': s.bingVerification } } : {}),
          },
        }
      : {}),
  };
}

/** Kategori için admin'de girilmiş SEO metinleri (yoksa boş nesne). */
export function categorySeoFor(s: SeoSettings, category: string): CategorySeo {
  return s.categorySeo[category] ?? {};
}
