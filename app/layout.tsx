import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PHONE } from '@/lib/constants';
import { getSeoSettings } from '@/lib/seo-settings';

const getCachedSeoSettings = unstable_cache(
  getSeoSettings,
  ['seo-settings'],
  { tags: ['seo-settings'] }
);

const SITE_NAME = 'Ümit Spot';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.umitspot.com';
const DESCRIPTION = 'Esenyurt\'un en yakın spotçusu. İkinci el ve sıfır spot mobilya, beyaz eşya alım satım. Esenyurt, Beylikdüzü, Avcılar, Büyükçekmece bölgelerine aynı gün teslimat. 0542 644 72 96';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '512x512' },
  },
  title: {
    default: `${SITE_NAME} – İkinci El Mobilya & Beyaz Eşya | Esenyurt`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'ikinci el mobilya esenyurt', 'spot mobilya esenyurt', 'esenyurt spot',
    'ikinci el beyaz eşya esenyurt', 'spot eşya istanbul', 'ikinci el koltuk esenyurt',
    'ikinci el buzdolabı esenyurt', 'ikinci el çamaşır makinesi esenyurt',
    'beylikdüzü ikinci el mobilya', 'avcılar ikinci el eşya',
    'büyükçekmece spot mobilya', 'ümit spot esenyurt',
    'ucuz mobilya esenyurt', 'sıfır spot mobilya istanbul',
    'ikinci el eşya alan yerler esenyurt', 'spot alım satım esenyurt',
  ],
  authors: [{ name: 'Ümit Spot', url: SITE_URL }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – İkinci El Mobilya & Beyaz Eşya | Esenyurt`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} – İkinci El Mobilya & Beyaz Eşya`,
    description: DESCRIPTION,
  },
};

function buildLocalBusinessSchema(seo: Awaited<ReturnType<typeof getCachedSeoSettings>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    name: 'Ümit Spot',
    alternateName: ['Ümit Spot Esenyurt', 'Esenyurt Spot', 'Ümit İkinci El'],
    description: seo.extraDescription || DESCRIPTION,
    url: SITE_URL,
    telephone: `+${PHONE}`,
    priceRange: '₺₺',
    currenciesAccepted: 'TRY',
    paymentAccepted: 'Cash, Credit Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Mehmet Akif Ersoy Mahallesi 1824 Sokak 11A',
      addressLocality: 'Esenyurt',
      addressRegion: 'İstanbul',
      postalCode: '34515',
      addressCountry: 'TR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 41.0082,
      longitude: 28.6726,
    },
    openingHours: seo.workingHours || 'Mo-Su 09:00-00:00',
    areaServed: seo.serviceAreas.map(name => ({ '@type': 'City', name })),
    knowsAbout: seo.services,
    keywords: seo.keywords.join(', '),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'İkinci El & Sıfır Spot Ürünler',
      itemListElement: seo.featuredCategories.map(name => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Product', name },
      })),
    },
    sameAs: ['https://www.google.com/maps?cid=esenyurt-spot'],
  };
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Esenyurt\'ta ikinci el mobilya nereden alınır?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Esenyurt\'ta Ümit Spot\'tan ikinci el ve sıfır spot mobilya satın alabilirsiniz. Mehmet Akif Ersoy Mahallesi 1824 Sokak 11A adresinde hizmet vermekteyiz. 0542 644 72 96 numaralı telefondan veya WhatsApp üzerinden ulaşabilirsiniz.',
      },
    },
    {
      '@type': 'Question',
      name: 'Aynı gün mobilya teslimatı yapıyor musunuz?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Evet, Esenyurt ve çevre ilçelere (Beylikdüzü, Avcılar, Büyükçekmece) aynı gün teslimat ve nakliye hizmeti sunuyoruz.',
      },
    },
    {
      '@type': 'Question',
      name: 'İkinci el eşyalarınızı nasıl satın alabilirim?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sitemizdeki ürünleri inceleyip WhatsApp üzerinden bizimle iletişime geçebilirsiniz. Her ürün sayfasında WhatsApp butonu bulunmaktadır.',
      },
    },
    {
      '@type': 'Question',
      name: 'İkinci el eşya alıyor musunuz?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Evet, kullanılmış mobilya ve beyaz eşya alımı yapıyoruz. Fiyat teklifi için 0542 644 72 96 numaralı telefondan bize ulaşabilirsiniz.',
      },
    },
    {
      '@type': 'Question',
      name: 'Hangi bölgelere teslimat yapıyorsunuz?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Esenyurt, Beylikdüzü, Avcılar, Büyükçekmece, Bahçeşehir ve Başakşehir bölgelerine teslimat yapıyoruz.',
      },
    },
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const seo = await getCachedSeoSettings();
  const localBusinessSchema = buildLocalBusinessSchema(seo);

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
