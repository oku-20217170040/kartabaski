import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getDesign } from '@/lib/designs';
import { getProductsServer } from '@/lib/products-server';
import { getAdminSession } from '@/lib/require-admin';
import { displayTitle } from '@/lib/format';
import { getActive, getSlug, getTitle } from '@/lib/product-utils';
import DesignClient from './DesignClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sipariş tasarımınız',
  robots: { index: false, follow: false },
};

interface Props {
  params: { token: string };
  searchParams: { musteri?: string };
}

export default async function TasarimPage({ params, searchParams }: Props) {
  const design = await getDesign(params.token);
  if (!design) notFound();

  // Yönetici aynı bağlantıya tıklayınca doğrudan paneldeki siparişe gider.
  // ?musteri=1 ile müşterinin gördüğü sayfa açılabilir.
  if (!searchParams.musteri && (await getAdminSession())) redirect(`/admin/tasarimlar/${design.token}`);

  const products = (await getProductsServer())
    .filter((p) => getActive(p))
    .map((p) => ({
      slug: getSlug(p),
      title: displayTitle(getTitle(p)),
      colors: (p.colors ?? []).map((c) => c.name),
    }));

  const { adminNote: _adminNote, ...visible } = design;
  void _adminNote;

  return (
    <>
      <Navbar />
      <main id="icerik">
        <DesignClient design={visible} products={products} />
      </main>
      <Footer />
    </>
  );
}
