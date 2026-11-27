import type { Metadata } from 'next';
// Fontlar projeyle birlikte gelir (fontsource); build sırasında Google Fonts'a bağlanılmaz.
import '@fontsource-variable/archivo/standard.css';
import './site.css';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CartProvider } from '@/lib/cart-context';
import SiteTracker from '@/components/SiteTracker';
import { buildRootMetadata } from '@/lib/seo-root';
import { PHONE, SITE_NAME } from '@/lib/constants';
import { SITE_URL, INSTAGRAM_URL, jsonLdString } from '@/lib/site';


const DESCRIPTION = 'Kişiye özel kupa baskı. Türkiye geneli hızlı kargo. Bireysel ve kurumsal siparişler. Ücretsiz tasarım desteği.';

// Varsayılan meta Firestore settings/seo belgesinden gelir (panel: /admin/seo); okunamazsa sabit varsayılanlar.
export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata();
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  sameAs: [INSTAGRAM_URL],
  telephone: `+${PHONE}`,
  priceRange: '₺₺',
  currenciesAccepted: 'TRY',
  paymentAccepted: 'Cash, Credit Card',
  areaServed: { '@type': 'Country', name: 'Turkey' },
  contactPoint: {
    '@type': 'ContactPoint', contactType: 'customer service', telephone: `+${PHONE}`,
    areaServed: 'TR', availableLanguage: 'Turkish', url: `${SITE_URL}/nasil-siparis-verilir`,
  },
  knowsAbout: ['Kupa baskı', 'Kişiye özel hediye', 'Sihirli kupa', 'Kurumsal hediye', 'Sublimation baskı'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Kupa Baskı Ürünleri',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sihirli Mat Kupa' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sihirli Konik Kupa' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Seramik Kahve Fincanı' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Özel Tasarım' } },
    ],
  },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '4415269272076470';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a href="#icerik" className="skip-link">İçeriğe geç</a>
          <CartProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </CartProvider>
          <WhatsAppFloat />
          <SiteTracker />
        {/* ── ANALYTICS (GA + Meta Pixel): ileride çerez onayına bağlanacak — tek blok ── */}
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
        <script dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}} />
        <noscript dangerouslySetInnerHTML={{ __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" />` }} />
        {/* ── /ANALYTICS ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(localBusinessSchema) }}
        />
      </body>
    </html>
  );
}
