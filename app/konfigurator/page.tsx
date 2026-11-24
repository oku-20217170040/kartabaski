import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ConfiguratorClient from './ConfiguratorClient';

export const metadata: Metadata = {
  title: 'Kendin Tasarla',
  description:
    'Kupa modelini, rengini ve hazır tasarımı seçin; kombinasyonu görün ve tek tıkla WhatsApp üzerinden bize iletin.',
  alternates: { canonical: '/konfigurator' },
};

export default function ConfiguratorPage() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <ConfiguratorClient />
      </main>
      <Footer />
    </>
  );
}
