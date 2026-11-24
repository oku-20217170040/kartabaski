import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import ConfiguratorClient from './ConfiguratorClient';

// Konfiguratör, sitenin geri kalanından bağımsız özgün tasarımıyla (ve fontuyla) çalışır.

export const metadata: Metadata = {
  title: 'Kendi Kombinasyonunu Oluştur',
  description: 'Bardağını seç, tasarımını seç — biz basalım. Kişiye özel kupa baskı konfiguratörü.',
  alternates: { canonical: '/konfigurator' },
};

export default function ConfiguratorPage() {
  return (
    <div className="cf-legacy">
      <ConfiguratorClient />
    </div>
  );
}
