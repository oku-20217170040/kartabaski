'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteOrderRequestAction, getOrderRequestAction, sendOrderToMachineAction,
  updateOrderRequestNoteAction, updateOrderRequestStatusAction,
} from '@/lib/actions-siparis';
import { OrderRequest, orderNo, orderUrl, shippingLabel } from '@/lib/siparis-types';
import { notifyLink, trackingLink } from '../takip-linki';
import PrintCard from './PrintCard';
import { useAdvance } from './useAdvance';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { customerWhatsappLink } from '@/lib/cart';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconTrash, IconWhatsApp } from '@/components/admin/icons';
import TrackingPanel from './TrackingPanel';
import { Production, nextStep } from '@/lib/siparis-takip';
import '../siparisler.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

type Tab = 'baski' | 'surec' | 'musteri';
const TABS: { id: Tab; label: string }[] = [{ id: 'baski', label: 'Baskı' }, { id: 'surec', label: 'Süreç' }, { id: 'musteri', label: 'Müşteri' }];

export default function SiparisDetayPage({ params }: { params: { token: string } }) {
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<Tab>('baski');
  const advance = useAdvance(order, production, confirm, setProduction, setBusy);

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
      message: `${orderNo(order)} kodlu sipariş ve fotoğrafları kalıcı olarak silinecek.`,
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

  const waHref = customerWhatsappLink({ name: order.name, phone: order.phone, id: order.token, code: order.code });
  const copyLink = () =>
    navigator.clipboard.writeText(orderUrl(order.token))
      .then(() => toast.success('Takip bağlantısı kopyalandı.'))
      .catch(() => toast.error('Kopyalanamadı. Bağlantıyı “Müşteri sayfası”ndan alın.'));
  const copyAddress = () =>
    navigator.clipboard.writeText(shippingLabel(order))
      .then(() => toast.success('Kargo adresi kopyalandı.'))
      .catch(() => toast.error('Kopyalanamadı. Adresi elle seçip kopyalayın.'));

  const step = nextStep(order, production);
  const units = order.items.reduce((sum, i) => sum + i.qty, 0);

  /** Telefonda ilgili sekmeyi açıp bölüme kaydırır. */
  const reveal = (to: Tab, id: string) => {
    setTab(to);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const stepButton = (className: string) => {
    if (step.action === 'none') return null;
    if (step.action === 'remind') {
      return <a className={className} href={notifyLink(order, 'baskı önizlemeniz hazır, onayınızı bekliyoruz:')} target="_blank" rel="noopener noreferrer">{step.label}</a>;
    }
    const act = step.action === 'machine' ? toMachine
      : step.action === 'advance' ? advance
      : step.action === 'proof' ? () => reveal('surec', 'sip-onizleme')
      : () => reveal('surec', 'sip-kargo');
    return <button type="button" className={className} onClick={act} disabled={busy}>{step.label}</button>;
  };

  return (
    <div className="has-savebar">
      <div className="admin-header">
        <div>
          <Link href="/admin/siparisler" className="adm-back-link">← Tüm siparişler</Link>
          <h1 className="adm-page-title sip-title">Sipariş {orderNo(order)}</h1>
          <p className="adm-page-sub">{order.name} · {order.items.length} ürün, {units} adet · {new Date(order.createdAt).toLocaleString('tr-TR')}</p>
        </div>
      </div>

      <section className={`card sip-next is-${step.action}`} aria-label="Sıradaki adım">
        <div>
          <h2>{step.title}</h2>
          <p>{step.hint}</p>
          {order.proof?.state === 'duzeltme' && order.proof.reply && <p className="sip-next-reply">“{order.proof.reply}”</p>}
        </div>
        {stepButton('btn btn-primary sip-next-button')}
      </section>

      <div className="sip-tabs" role="tablist" aria-label="Sipariş bölümleri">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`sip-sekme-${t.id}`} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.id === 'baski' ? ` (${order.items.length})` : ''}
          </button>
        ))}
      </div>

      <div className={`sip-detail tab-${tab}`}>
        <div className="sip-lines">
          <section className="card sip-card sip-panel-musteri" id="sip-musteri" aria-label="Müşteri">
            <dl className="sip-facts">
              <div><dt>Müşteri</dt><dd>{order.name}</dd></div>
              <div><dt>Telefon</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
              {order.address
                ? <div className="is-wide"><dt>Teslimat adresi</dt><dd>{order.address}</dd></div>
                : place && <div><dt>İl / ilçe</dt><dd>{place}</dd></div>}
              {order.directions && <div className="is-wide"><dt>Adres tarifi</dt><dd>{order.directions}</dd></div>}
              {order.recipient && <div className="is-wide"><dt>Teslim alacak kişi</dt><dd>{order.recipient.name} · <a href={`tel:${order.recipient.phone}`}>{order.recipient.phone}</a></dd></div>}
              {order.invoice && <div className="is-wide"><dt>Kurumsal fatura</dt><dd>{order.invoice.company} · {order.invoice.taxOffice} VD · {order.invoice.taxNo}</dd></div>}
              {order.total > 0 && <div><dt>Tahmini toplam</dt><dd>{fmt(order.total)}₺</dd></div>}
            </dl>
            {order.note && <p className="sip-note"><b>Sipariş notu:</b> {order.note}</p>}
            {order.address && <button type="button" className="btn btn-secondary btn-sm sip-copy" onClick={copyAddress}>Kargo adresini kopyala</button>}
            <div className="sip-actions">
              <a className="btn btn-primary sip-wa" href={trackingLink(order)} target="_blank" rel="noopener noreferrer">
                <IconWhatsApp size={16} /> Takip linki gönder
              </a>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>Linki kopyala</button>
              <a className="btn btn-secondary btn-sm sip-wa" href={waHref} target="_blank" rel="noopener noreferrer">Müşteriye yaz</a>
              <a className="btn btn-secondary btn-sm" href={`/siparis/${order.token}?musteri=1`} target="_blank" rel="noopener noreferrer">Müşteri sayfası</a>
            </div>
          </section>

          <div className="sip-panel-surec">
            <TrackingPanel order={order} production={production} onChange={(o, p) => { setOrder(o); setProduction(p); }} />

            <section className="card sip-card" aria-label="Kayıt">
              <label className="form-label" htmlFor="sip-durum">Sipariş durumu</label>
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={remove} disabled={busy}>
                  <IconTrash size={16} /> Sil
                </button>
              </div>
            </section>
          </div>
        </div>

        <section className="sip-lines sip-panel-baski" aria-label="Baskı bilgileri">
          {order.photosDeletedAt && <p className="adm-page-sub">Saklama süresi dolduğu için fotoğraflar silindi.</p>}
          {order.items.map((item, n) => (
            <PrintCard key={`${item.productId}-${n}`} token={order.token} code={orderNo(order)} index={n} item={item} />
          ))}
        </section>
      </div>

      <div className="sip-bar" role="group" aria-label="Hızlı işlemler">
        <a className="btn btn-secondary" href={`tel:${order.phone}`}>Ara</a>
        <a className="btn btn-secondary" href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Müşteriye WhatsApp’tan yaz"><IconWhatsApp size={18} /></a>
        {stepButton('btn btn-primary')
          ?? <a className="btn btn-secondary" href={trackingLink(order)} target="_blank" rel="noopener noreferrer">Takip linki gönder</a>}
      </div>
      {dialog}
    </div>
  );
}
