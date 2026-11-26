import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ConfiguratorClient from './ConfiguratorClient';

export const metadata: Metadata = {
  title: 'Kendin Tasarla',
  description: 'Kupayı ve hazır deseni seçin ya da kendi fotoğrafınızı ekleyin; sepetten siparişinizi oluşturun.',
  alternates: { canonical: '/konfigurator' },
};

export default function ConfiguratorPage() {
  return (
    <>
      <Navbar />
      <main id="icerik" className="kf">
        <ConfiguratorClient />
      </main>
      <Footer />
    </>
  );
}
