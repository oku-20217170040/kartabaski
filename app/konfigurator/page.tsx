import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import ConfiguratorClient from './ConfiguratorClient';

// Konfiguratör, sitenin geri kalanından bağımsız özgün tasarımıyla (ve fontuyla) çalışır.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kendi Kombinasyonunu Oluştur',
  description: 'Bardağını seç, tasarımını seç — biz basalım. Kişiye özel kupa baskı konfiguratörü.',
  alternates: { canonical: '/konfigurator' },
};

export default function ConfiguratorPage() {
  return (
    <div className={`${jakarta.className} cf-legacy`}>
      <ConfiguratorClient />
    </div>
  );
}
