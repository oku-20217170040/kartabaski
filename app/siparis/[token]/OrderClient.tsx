'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';
import { CustomerOrder, canCustomerDelete, orderImageUrl, orderMessage, orderNo } from '@/lib/siparis-types';
import { deleteOrderByCustomer } from '@/lib/siparis-client';
import { trackEvent } from '@/lib/analytics-client';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

const STATUS_TEXT: Record<CustomerOrder['status'], string> = {
  yukleniyor: 'Yükleniyor',
  yeni: 'Siparişiniz alındı',
  incelendi: 'İnceleniyor',
  siparis: 'Üretime alındı',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal edildi',
};

export default function OrderClient({ order }: { order: CustomerOrder }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(orderMessage(order.token))}`;
  const place = [order.district, order.city].filter(Boolean).join(' / ');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteOrderByCustomer(order.token);
      setDeleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  };

  if (deleted) {
    return (
      <div className="wrap ord">
        <h1 className="h2">Siparişiniz silindi</h1>
        <p>Bilgileriniz ve fotoğraflarınız kaldırıldı.</p>
        <Link href="/" className="btn btn-primary">Ana sayfaya dönün</Link>
      </div>
    );
  }

  return (
    <div className="wrap ord">
      <header className="ord-head">
        <p className="ord-status">{STATUS_TEXT[order.status]}</p>
        <h1 className="h2">Sipariş {orderNo(order.token)}</h1>
        <p>
          {order.status === 'yeni'
            ? 'Son adım: aşağıdaki düğmeyle bize WhatsApp’tan haber verin. Mesaja yalnızca bu sayfanın bağlantısı eklenir.'
            : 'Sorunuz olursa WhatsApp’tan yazın.'}
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
      </header>

      <ul className="ord-lines">
        {order.items.map((item, n) => {
          const cover = item.preview ?? item.files[0];
          return (
            <li key={`${item.productId}-${n}`}>
              <div className="ord-cover">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={orderImageUrl(order.token, cover, 900)} alt={`${item.title} tasarımı`} loading="lazy" />
                )}
              </div>
              <div className="ord-info">
                <h2 className="h3"><Link href={`/urun/${item.slug}`}>{item.title}</Link></h2>
                <p>
                  {item.qty} adet{item.color ? ` · ${item.color}` : ''}
                  {item.unitPrice > 0 ? ` · ${fmt(item.unitPrice)}₺’den başlayan` : ''}
                </p>
                {item.text && <p>Yazı: <b>{item.text}</b> ({item.font === 'el' ? 'el yazısı' : 'düz yazı'})</p>}
                {item.needsDesign && <p>Tasarımı biz hazırlayacağız.</p>}
                {item.removeBg && <p>Fotoğrafın arka planı silinecek.</p>}
                {item.note && <p>Not: {item.note}</p>}
                {item.files.length > 0 && (
                  <ul className="ord-files">
                    {item.files.map((id, i) => (
                      <li key={id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={orderImageUrl(order.token, id, 240)} alt={`Yüklediğiniz fotoğraf ${i + 1}`} loading="lazy" />
                      </li>
                    ))}
                  </ul>
                )}
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

        {canCustomerDelete(order.status) && (
          asking ? (
            <div className="ord-confirm" role="group" aria-label="Silme onayı">
              <p>Sipariş ve fotoğraflar kalıcı olarak silinsin mi?</p>
              <button type="button" className="btn btn-outline" onClick={remove} disabled={busy}>
                {busy ? 'Siliniyor…' : 'Evet, sil'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Vazgeç</button>
            </div>
          ) : (
            <button type="button" className="ord-delete" onClick={() => setAsking(true)}>
              Siparişimi ve fotoğraflarımı sil
            </button>
          )
        )}
        <p className="ord-error" role="alert">{error}</p>
        <p className="ord-privacy">
          Fotoğraflarınız yalnız siparişiniz için saklanır. <Link href="/gizlilik">Aydınlatma metni</Link>
        </p>
      </section>
    </div>
  );
}
