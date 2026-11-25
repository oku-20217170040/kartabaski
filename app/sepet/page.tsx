import type { Metadata } from 'next';
import SepetClient from './SepetClient';

export const metadata: Metadata = {
  title: 'Sepetim',
  description: 'Seçtiğiniz kupaları sepete ekleyin, talebinizi oluşturun; siparişi WhatsApp üzerinden netleştirelim.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/sepet' },
};

export default function SepetPage() {
  return <SepetClient />;
}
