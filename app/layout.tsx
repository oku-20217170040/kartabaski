import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PHONE } from '@/lib/constants';

const SITE_NAME = 'KAR-TA BASKI';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kartabaski.com';
const DESCRIPTION = 'Kişiye özel kupa baskı. Türkiye geneli hızlı kargo. Bireysel ve kurumsal siparişler. Ücretsiz tasarım desteği.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png' },
    shortcut: '/favicon.png',
  },
  title: {
    default: `${SITE_NAME} – Kişiye Özel Kupa Baskı`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'kupa baskı', 'kişiye özel kupa', 'sihirli kupa', 'hediye kupa',
    'kurumsal kupa baskı', 'özel tasarım kupa', 'kupa baskı sipariş',
    'sihirli mat kupa', 'sihirli konik kupa', 'seramik kupa baskı',
    'Türkiye kupa baskı', 'online kupa baskı', 'kupa baskı kargo',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Kişiye Özel Kupa Baskı`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} – Kişiye Özel Kupa Baskı`,
    description: DESCRIPTION,
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  telephone: `+${PHONE}`,
  priceRange: '₺₺',
  currenciesAccepted: 'TRY',
  paymentAccepted: 'Cash, Credit Card',
  areaServed: { '@type': 'Country', name: 'Turkey' },
  knowsAbout: ['Kupa baskı', 'Kişiye özel hediye', 'Sihirli kupa', 'Kurumsal hediye', 'Sublimation baskı'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Kupa Baskı Ürünleri',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sihirli Mat Kupa' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sihirli Konik Kupa' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Seramik Nescafe Fincanı' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sihirli Renkli Kupa' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Özel Tasarım' } },
    ],
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Kupa baskı siparişi nasıl verilir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Katalogumuzdan istediğiniz kupa modelini seçin, ardından WhatsApp üzerinden bize ulaşın. Tasarımınızı gönderin veya ücretsiz tasarım desteğimizden yararlanın.',
      },
    },
    {
      '@type': 'Question',
      name: 'Kupa baskı kaç günde teslim edilir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Siparişiniz onaylandıktan sonra 3 iş günü içinde kargoya verilir. Türkiye\'nin her yerine kargo hizmeti sunmaktayız.',
      },
    },
    {
      '@type': 'Question',
      name: 'Tasarımım yoksa ne yapmalıyım?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Endişelenmeyin! Ücretsiz tasarım desteği sunuyoruz. İsteğinizi WhatsApp üzerinden bize iletin, biz tasarlayalım.',
      },
    },
    {
      '@type': 'Question',
      name: 'Kurumsal sipariş verebilir miyim?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Evet, bireysel ve kurumsal siparişler alıyoruz. Toplu sipariş için özel fiyatlandırma için WhatsApp üzerinden iletişime geçin.',
      },
    },
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <WhatsAppFloat />
        </AuthProvider>
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}} />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </body>
    </html>
  );
}
