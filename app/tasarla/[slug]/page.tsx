import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getProductBySlugServer } from '@/lib/products-server';
import { getActive } from '@/lib/product-utils';
import { adminDb } from '@/lib/firebase-admin';
import { CUP_SLUG_PREFIX, cupToProduct } from '@/lib/configurator-lines';
import type { ConfiguratorCup, Product } from '@/types';
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

/** Katalog ürünü ya da konfigüratör bardağı (konfig-<kimlik>). */
async function findProduct(slug: string): Promise<Product | null> {
  if (!slug.startsWith(CUP_SLUG_PREFIX)) return getProductBySlugServer(slug);
  const id = slug.slice(CUP_SLUG_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return null;
  const snap = await adminDb.collection('configurator_cups').doc(id).get();
  return snap.exists ? cupToProduct({ ...(snap.data() as ConfiguratorCup), id: snap.id }) : null;
}

export default async function TasarlaPage({ params, searchParams }: Props) {
  const product = await findProduct(params.slug);
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
