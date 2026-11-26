import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon } from '@/components/icons';
import { Shipment, Timeline } from '@/app/siparis/[token]/OrderTracking';
import { findOrderByCode, getProduction } from '@/lib/siparis';
import { buildTracking, publicOrder } from '@/lib/siparis-takip';
import { normalizeOrderCode } from '@/lib/siparis-types';
import { rateLimit } from '@/lib/rate-limit';
import { WHATSAPP_BASE } from '@/lib/constants';
import '@/app/siparis/[token]/siparis.css';
import './takip.css';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { kod?: string };
}

export function generateMetadata({ searchParams }: Props): Metadata {
  return {
    title: 'Sipariş takibi',
    description: 'Sipariş kodunuzu yazın; siparişinizin hangi aşamada olduğunu ve kargo takip bilgisini görün.',
    alternates: { canonical: '/siparis-takip' },
    // Kodlu sonuç sayfaları arama motorlarına girmez.
    ...(searchParams.kod ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Kodla sorgu: yalnız durum, kargo ve ürün özeti. Kişisel bilgi ve fotoğraf gönderilmez. */
async function lookup(raw: string) {
  const code = normalizeOrderCode(raw);
  if (!code) return { error: 'Kod KB ile başlar ve 13 karakterdir. Mesajınızdaki kodu aynen yazın.' };
  const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`takip:${ip}`, 20, 10 * 60 * 1000)) return { error: 'Çok fazla deneme yapıldı. 10 dakika sonra tekrar deneyin.' };
  try {
    const order = await findOrderByCode(code);
    if (!order) return { error: 'Bu kodla bir sipariş bulunamadı. Kodu kontrol edin.' };
    return { order: publicOrder(order, buildTracking(order, await getProduction(order))) };
  } catch (e) {
    console.error('[siparis-takip] sorgu başarısız', e);
    return { error: 'Şu an sorgulanamıyor. Birazdan tekrar deneyin.' };
  }
}

export default async function SiparisTakipPage({ searchParams }: Props) {
  const raw = (searchParams.kod ?? '').slice(0, 40);
  const result = raw ? await lookup(raw) : null;
  const order = result?.order;
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(order ? `Merhaba, ${order.code} kodlu siparişimi soruyorum.` : 'Merhaba, siparişimi soruyorum.')}`;

  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap ord">
          <header className="ord-head">
            <h1 className="h2">Sipariş takibi</h1>
            <p>Sipariş kodunuzu yazın; siparişinizin hangi aşamada olduğunu görün.</p>
          </header>

          <form className="tak-form" action="/siparis-takip" method="get">
            <label htmlFor="tak-kod">Sipariş kodu</label>
            <div>
              <input id="tak-kod" name="kod" defaultValue={order?.code ?? raw} placeholder="KB" maxLength={20} required autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
              <button type="submit" className="btn btn-primary">Sorgula</button>
            </div>
          </form>

          {result?.error && <p className="tak-error" role="alert">{result.error}</p>}

          {order && (
            <section className="tak-result" aria-label="Sipariş durumu">
              <p className="ord-status" role="status">{order.tracking.headline}</p>
              <p className="tak-code">{order.code}</p>
              <Timeline tracking={order.tracking} />
              {order.shipping && <Shipment shipping={order.shipping} />}
              <ul className="tak-items">
                {order.items.map((item, n) => (
                  <li key={`${item.title}-${n}`}>
                    <b>{item.title}</b>
                    <span>{item.qty} adet{item.color ? ` · ${item.color}` : ''}{item.twoSided ? ' · iki yüze baskı' : ''}</span>
                  </li>
                ))}
              </ul>
              <p className="tak-note">Fotoğraflarınız ve baskı önizlemesi onayı, size WhatsApp’tan gönderdiğimiz sipariş bağlantısındadır.</p>
            </section>
          )}

          <p className="tak-help">
            <a className="btn btn-outline" href={waHref} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /> WhatsApp’tan yazın</a>
            <Link href="/gizlilik">Aydınlatma metni</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
