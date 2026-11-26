import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getProductBySlugServer } from '@/lib/products-server';
import { getActive } from '@/lib/product-utils';
import DesignEditor from './DesignEditor';
import './tasarla.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kupanızı tasarlayın',
  robots: { index: false, follow: true },
};

interface Props {
  params: { slug: string };
  searchParams: { renk?: string; satir?: string };
}

export default async function TasarlaPage({ params, searchParams }: Props) {
  const product = await getProductBySlugServer(params.slug);
  if (!product || !getActive(product)) notFound();

  return (
    <>
      <Navbar />
      <main id="icerik">
        <DesignEditor
          // Firestore tarih nesneleri istemciye düz veri olarak geçsin.
          product={JSON.parse(JSON.stringify(product))}
          initialColor={searchParams.renk}
          lineKey={searchParams.satir}
        />
      </main>
      <Footer />
    </>
  );
}
