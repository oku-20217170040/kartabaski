import type { Metadata } from 'next';
import ConfiguratorClient from './ConfiguratorClient';

// Konfigüratörün kendi yerleşimi var; renk ve yazı tipi siteyle ortaktır.

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
