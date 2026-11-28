import type { Metadata, Viewport } from 'next';
import ConfiguratorClient from './ConfiguratorClient';

export const metadata: Metadata = {
  title: 'Kendin Tasarla',
  description: 'Kupayı ve hazır deseni seçin ya da kendi fotoğrafınızı ekleyin; sepetten siparişinizi oluşturun.',
  alternates: { canonical: '/konfigurator' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' };

export default function ConfiguratorPage() {
  return (
    <main id="icerik">
      <ConfiguratorClient />
    </main>
  );
}
