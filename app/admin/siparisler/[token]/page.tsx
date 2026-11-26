'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteOrderRequestAction, getOrderRequestAction, sendOrderToMachineAction,
  updateOrderRequestNoteAction, updateOrderRequestStatusAction,
} from '@/lib/actions-siparis';
import { OrderRequest, orderImageUrl, orderNo } from '@/lib/siparis-types';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { customerWhatsappLink } from '@/lib/cart';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconTrash, IconWhatsApp } from '@/components/admin/icons';
import TrackingPanel from './TrackingPanel';
import type { Production } from '@/lib/siparis-takip';
import '../siparisler.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function SiparisDetayPage({ params }: { params: { token: string } }) {
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    getOrderRequestAction(params.token)
      .then((r) => { setOrder(r?.order ?? null); setProduction(r?.production ?? null); setNote(r?.order.adminNote ?? ''); })
      .catch((e) => toast.error(errorMessage(e, 'Sipariş yüklenemedi.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  if (loading) return <div className="sip-center"><div className="spinner" /></div>;
  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Sipariş bulunamadı</div>
        <Link href="/admin/siparisler" className="btn btn-secondary btn-sm">Listeye dön</Link>
      </div>
    );
  }

  const run = async (job: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await job(); toast.success(done); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const setStatus = (status: TalepStatus) =>
    run(async () => {
      await updateOrderRequestStatusAction(order.token, status);
      setOrder({ ...order, status });
    }, 'Durum güncellendi.');

  const toMachine = () =>
    run(async () => {
      const orderId = await sendOrderToMachineAction(order.token);
      setOrder({ ...order, status: 'siparis', orderId });
      setProduction((await getOrderRequestAction(order.token))?.production ?? null);
    }, 'Üretim hattına aktarıldı.');

  const remove = async () => {
    const ok = await confirm({
      title: 'Sipariş silinsin mi?',
      message: `${orderNo(order.token)} numaralı sipariş ve fotoğrafları kalıcı olarak silinecek.`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await deleteOrderRequestAction(order.token);
      router.push('/admin/siparisler');
    }, 'Sipariş silindi.');
  };

  const place = [order.district, order.city].filter(Boolean).join(' / ');

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Sipariş {orderNo(order.token)}</h1>
          <p className="adm-page-sub">{new Date(order.createdAt).toLocaleString('tr-TR')}</p>
        </div>
        <Link href="/admin/siparisler" className="btn btn-secondary btn-sm">Tüm siparişler</Link>
      </div>

      <div className="sip-detail">
        <div className="sip-lines">
        <section className="card sip-card">
          <dl className="sip-facts">
            <div><dt>Müşteri</dt><dd>{order.name}</dd></div>
            <div><dt>Telefon</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
            {place && <div><dt>İl / ilçe</dt><dd>{place}</dd></div>}
            {order.address && <div><dt>Adres</dt><dd>{order.address}</dd></div>}
            {order.total > 0 && <div><dt>Tahmini toplam</dt><dd>{fmt(order.total)}₺</dd></div>}
          </dl>
          {order.note && <p className="sip-note"><b>Müşteri notu:</b> {order.note}</p>}

          <a className="btn btn-primary sip-wa" href={customerWhatsappLink({ name: order.name, phone: order.phone, id: order.token })} target="_blank" rel="noopener noreferrer">
            <IconWhatsApp size={16} /> Müşteriye yaz
          </a>

          <label className="form-label" htmlFor="sip-durum">Durum</label>
          <select id="sip-durum" className="form-select" value={order.status} disabled={busy} onChange={(e) => setStatus(e.target.value as TalepStatus)}>
            {order.status === 'yukleniyor' && <option value="yukleniyor" disabled>Yükleniyor</option>}
            {TALEP_STATUSES.map((s) => <option key={s} value={s}>{TALEP_LABELS[s].label}</option>)}
          </select>

          <label className="form-label" htmlFor="sip-not">İç not</label>
          <textarea id="sip-not" className="form-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="sip-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
              onClick={() => run(() => updateOrderRequestNoteAction(order.token, note), 'Not kaydedildi.')}>
              Notu kaydet
            </button>
            {order.orderId ? (
              <Link href="/admin/makine" className="btn btn-secondary btn-sm">Üretim hattında</Link>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={toMachine} disabled={busy}>Üretime aktar</button>
            )}
            <a className="btn btn-secondary btn-sm" href={`/siparis/${order.token}?musteri=1`} target="_blank" rel="noopener noreferrer">Müşteri sayfası</a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={remove} disabled={busy}>
              <IconTrash size={16} /> Sil
            </button>
          </div>
        </section>

        <TrackingPanel order={order} production={production} onChange={(o, p) => { setOrder(o); setProduction(p); }} />
        </div>

        <section className="sip-lines">
          {order.photosDeletedAt && <p className="adm-page-sub">Saklama süresi dolduğu için fotoğraflar silindi.</p>}
          {order.items.map((item, n) => (
            <article className="card sip-card" key={`${item.productId}-${n}`}>
              <h2 className="sip-h2">
                {n + 1}) <Link href={`/urun/${item.slug}`}>{item.title}</Link> · {item.qty} adet
              </h2>
              <dl className="sip-facts">
                {item.color && <div><dt>Renk</dt><dd>{item.color}</dd></div>}
                {item.text && <div><dt>Yazı ({item.font === 'el' ? 'el yazısı' : 'düz yazı'})</dt><dd>{item.text}</dd></div>}
                {item.removeBg && <div><dt>Arka plan</dt><dd>Silinsin</dd></div>}
                {item.needsDesign && <div><dt>Tasarım</dt><dd>Biz hazırlayacağız</dd></div>}
                {item.placement && (
                  <div>
                    <dt>Fotoğraf yerleşimi</dt>
                    <dd>Boyut {pct(item.placement.scale)} · yatay {pct(item.placement.x)} · dikey {pct(item.placement.y)} · açı {Math.round(item.placement.rotate)}°</dd>
                  </div>
                )}
              </dl>
              {item.note && <p className="sip-note">{item.note}</p>}
              {item.preview && (
                <figure className="sip-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={orderImageUrl(order.token, item.preview, 900)} alt="Müşterinin gördüğü önizleme" />
                  <figcaption>Müşterinin gördüğü önizleme</figcaption>
                </figure>
              )}
              {item.files.length > 0 && (
                <ul className="sip-files">
                  {item.files.map((id, i) => (
                    <li key={id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={orderImageUrl(order.token, id, 240)} alt={`Fotoğraf ${i + 1}`} loading="lazy" />
                      <a className="btn btn-secondary btn-sm" href={orderImageUrl(order.token, id)}>Orijinali indir</a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      </div>
      {dialog}
    </div>
  );
}
