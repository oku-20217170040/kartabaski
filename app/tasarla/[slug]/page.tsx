import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlugServer } from '@/lib/products-server';
import { getActive } from '@/lib/product-utils';
import { adminDb } from '@/lib/firebase-admin';
import { CUP_SLUG_PREFIX, cupToProduct } from '@/lib/configurator-lines';
import type { ConfiguratorCup, Product } from '@/types';
import DesignEditor from './DesignEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kupanızı tasarlayın',
  robots: { index: false, follow: true },
};

// Klavye açılınca stüdyo küçülür, baskı alanı görünür kalır.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' };

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
    <main id="icerik">
      <DesignEditor
        // Firestore tarih nesneleri istemciye düz veri olarak geçsin.
        product={JSON.parse(JSON.stringify(product))}
        initialColor={searchParams.renk}
        lineKey={searchParams.satir}
      />
    </main>
  );
}
