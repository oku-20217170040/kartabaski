import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

const SITE_NAME = 'Ümit Spot';
const SITE_URL = 'https://umitspot.com';
const DESCRIPTION = 'Esenyurt\'un en yakın spotçusu. İkinci el ve sıfır spot mobilya, beyaz eşya alım satım. Aynı gün teslimat. 0542 644 72 96';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – İkinci El Mobilya & Beyaz Eşya | Esenyurt`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'ikinci el mobilya', 'spot mobilya', 'esenyurt spot', 'ikinci el beyaz eşya',
    'spot eşya', 'ikinci el koltuk', 'ikinci el buzdolabı', 'ikinci el çamaşır makinesi',
    'esenyurt ikinci el', 'ümit spot', 'spot istanbul', 'ucuz mobilya esenyurt',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
