'use client';

import { countShapes } from '@/lib/tasarim/model';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Timeline, Shipment, ProofReview } from './OrderTracking';
import type { Tracking } from '@/lib/siparis-takip';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';
import { CustomerOrder, lineFiles, lineSides, orderImageUrl, orderMessage, orderNo } from '@/lib/siparis-types';
import { lineHref } from '@/lib/configurator-lines';
import { cartImageSrc } from '@/lib/cart-products';
import { trackEvent } from '@/lib/analytics-client';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

export default function OrderClient({ order, tracking }: { order: CustomerOrder; tracking: Tracking }) {
  const router = useRouter();
  const [proof, setProof] = useState(order.proof);
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(orderMessage(order.token))}`;
  const place = [order.district, order.city].filter(Boolean).join(' / ');
  // Cevap verilince başlık sayfa yenilenmeden de doğru kalsın.
  const headline = proof?.state !== order.proof?.state
    ? (proof?.state === 'onaylandi' ? 'Onayınız alındı' : 'Düzeltme isteğiniz bizde')
    : tracking.headline;

  const review = proof && proof.images.length > 0 && !tracking.cancelled && (
    <ProofReview
      key={proof.round}
      order={order}
      proof={proof}
      onReplied={(next) => { setProof(next); router.refresh(); }}
    />
  );

  return (
    <div className="wrap ord">
      <header className="ord-head">
        <p className="ord-status" role="status">{headline}</p>
        <h1 className="h2 ord-title">Sipariş {orderNo(order)}</h1>
        <p>
          {order.status === 'yeni'
            ? 'Son adım: aşağıdaki düğmeyle bize WhatsApp’tan haber verin. Mesaja yalnızca bu sayfanın bağlantısı eklenir.'
            : 'Gelişmeleri bu sayfadan takip edebilirsiniz. Sorunuz olursa WhatsApp’tan yazın.'}
        </p>
        <a
          className="btn btn-primary ord-wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('whatsapp', { src: 'siparis' })}
        >
          <WhatsAppIcon /> {order.status === 'yeni' ? 'WhatsApp’tan gönderin' : 'WhatsApp’tan yazın'}
        </a>
        <p className="ord-code">
          Sipariş kodunuz <b>{orderNo(order)}</b>. Durumu <Link href={`/siparis-takip?kod=${orderNo(order)}`}>sipariş takibi</Link> sayfasından bu kodla da görebilirsiniz.
        </p>
      </header>

      {order.proof?.state === 'bekliyor' && review}
      <Timeline tracking={tracking} />
      {order.shipping && <Shipment shipping={order.shipping} />}
      {order.proof?.state !== 'bekliyor' && review}

      <ul className="ord-lines">
        {order.items.map((item, n) => {
          const own = item.preview ?? lineFiles(item)[0];
          const cover = own ? orderImageUrl(order.token, own, 900) : cartImageSrc(item.ready?.image ?? item.back?.ready?.image);
          return (
            <li key={`${item.productId}-${n}`}>
              <div className="ord-cover">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt={`${item.title} tasarımı`} loading="lazy" />
                )}
              </div>
              <div className="ord-info">
                <h2 className="h3"><Link href={lineHref(item.slug)}>{item.title}</Link></h2>
                <p>
                  {item.qty} adet{item.color ? ` · ${item.color}` : ''}
                  {item.unitPrice > 0 ? ` · ${fmt(item.unitPrice)}₺’den başlayan` : ''}
                </p>
                {item.back && <p><b>İki yüze baskı</b></p>}
                {item.needsDesign && <p>Tasarımı biz hazırlayacağız.</p>}
                {item.note && <p>Not: {item.note}</p>}
                {lineSides(item).map((s) => (
                  <div className="ord-side" key={s.label || 'tek'}>
                    {s.label && <h3>{s.label}</h3>}
                    {s.ready && <p>Hazır tasarım: <b>{s.ready.name}</b></p>}
                    {s.label && s.ready?.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="ord-ready" src={cartImageSrc(s.ready.image) ?? ''} alt={`${s.label} deseni`} loading="lazy" />
                    )}
                    {s.text && <p>Yazı: <b>{s.text}</b>{s.layers ? '' : ` (${s.font === 'el' ? 'el yazısı' : 'düz yazı'})`}</p>}
                    {countShapes(s.layers) > 0 && <p>{countShapes(s.layers)} süs eklendi.</p>}
                    {s.removeBg && <p>Fotoğrafın arka planı silinecek.</p>}
                    {s.files.length > 0 && (
                      <ul className="ord-files">
                        {s.files.map((id, i) => (
                          <li key={id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={orderImageUrl(order.token, id, 240)} alt={`${s.label ? `${s.label}, y` : 'Y'}üklediğiniz fotoğraf ${i + 1}`} loading="lazy" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <section className="ord-foot" aria-label="Sipariş özeti">
        {order.total > 0 && <p className="ord-total">Tahmini toplam: <b>{fmt(order.total)}₺</b> <small>Kesin fiyat WhatsApp’ta onaylanır.</small></p>}
        <p>{order.name} · {order.phone}{place ? ` · ${place}` : ''}</p>
        {order.note && <p>Sipariş notu: {order.note}</p>}
        {order.photosDeletedAt && <p>Saklama süresi dolduğu için fotoğraflar silindi.</p>}

        <p className="ord-privacy">
          Fotoğraflarınız yalnız siparişiniz için saklanır. <Link href="/gizlilik">Aydınlatma metni</Link>
        </p>
      </section>
    </div>
  );
}
