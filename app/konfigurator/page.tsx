import type { Metadata } from 'next';
import ConfiguratorClient from './ConfiguratorClient';

export const metadata: Metadata = {
  title: 'Kendi Kombinasyonunu Oluştur | KAR-TA BASKI',
  description: 'Bardağını seç, tasarımını seç — biz basalım. Kişiye özel kupa baskı konfiguratörü.',
};

export default function ConfiguratorPage() {
  return <ConfiguratorClient />;
}
