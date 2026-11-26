import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getOrderRequest, getProduction } from '@/lib/siparis';
import { buildTracking } from '@/lib/siparis-takip';
import { customerView } from '@/lib/siparis-types';
import { getAdminSession } from '@/lib/require-admin';
import OrderClient from './OrderClient';
import './siparis.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Siparişiniz',
  robots: { index: false, follow: false },
};

interface Props {
  params: { token: string };
  searchParams: { musteri?: string };
}

export default async function SiparisPage({ params, searchParams }: Props) {
  const order = await getOrderRequest(params.token);
  if (!order || order.status === 'yukleniyor') notFound();

  // Yönetici aynı bağlantıya tıklayınca doğrudan paneldeki siparişe gider.
  // ?musteri=1 ile müşterinin gördüğü sayfa açılabilir.
  if (!searchParams.musteri && (await getAdminSession())) redirect(`/admin/siparisler/${order.token}`);

  return (
    <>
      <Navbar />
      <main id="icerik">
        <OrderClient order={customerView(order)} tracking={buildTracking(order, await getProduction(order))} />
      </main>
      <Footer />
    </>
  );
}
