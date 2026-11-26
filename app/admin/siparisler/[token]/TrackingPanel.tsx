'use client';

import { useState } from 'react';
import Link from 'next/link';
import { setOrderStatusAction } from '@/lib/actions-machine';
import { setOrderShippingAction } from '@/lib/actions-siparis';
import { ORDER_STATUS_LABELS, nextStatus } from '@/lib/orders-utils';
import type { Production } from '@/lib/siparis-takip';
import { sendProofRequest } from '@/lib/siparis-client';
import {
  MAX_PROOF_IMAGES, MAX_PROOF_TEXT, OrderRequest, PROOF_LABELS, ShippingSchema, orderImageUrl, orderUrl,
} from '@/lib/siparis-types';
import { waNumber } from '@/lib/cart';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconWhatsApp } from '@/components/admin/icons';

interface Props {
  order: OrderRequest;
  production: Production | null;
  onChange: (order: OrderRequest, production: Production | null) => void;
}

const when = (ts: number) => new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Müşteriye durum haberi: mesaja yalnız sipariş bağlantısı girer. */
const notifyLink = (order: OrderRequest, text: string) =>
  `https://wa.me/${waNumber(order.phone)}?text=${encodeURIComponent(`Merhaba, ${text} ${orderUrl(order.token)}`)}`;

export default function TrackingPanel({ order, production, onChange }: Props) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [picker, setPicker] = useState(0);
  const [ship, setShip] = useState({
    carrier: order.shipping?.carrier ?? '',
    trackingNo: order.shipping?.trackingNo ?? '',
    url: order.shipping?.url ?? '',
  });
  const closed = order.status === 'tamamlandi' || order.status === 'iptal';
  const proof = order.proof;
  const next = production ? nextStatus(production.status) : null;

  const run = async (job: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await job(); toast.success(done); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const advance = async () => {
    if (!next || !order.orderId) return;
    if (next === 'teslim') {
      const ok = await confirm({
        title: 'Teslim edildi olarak işaretlensin mi?',
        message: 'İş muhasebeye işlenir ve sipariş fotoğrafları için 30 günlük saklama süresi başlar.',
        confirmLabel: 'Teslim edildi',
      });
      if (!ok) return;
    }
    await run(async () => {
      const job = await setOrderStatusAction(order.orderId!, next);
      onChange(order, { status: job.status, stageAt: job.stageAt });
    }, `Aşama: ${ORDER_STATUS_LABELS[next]}`);
  };

  const submitProof = () =>
    run(async () => {
      const sent = await sendProofRequest(order.token, files, message.trim());
      onChange({
        ...order,
        proof: sent,
        proofHistory: [...(order.proofHistory ?? []), ...(proof ? [proof] : [])],
        status: order.status === 'yeni' ? 'incelendi' : order.status,
      }, production);
      setFiles([]);
      setMessage('');
      setPicker((n) => n + 1);
    }, 'Önizleme sipariş sayfasına eklendi. Müşteriye haber verin.');

  const saveShipping = () => {
    const data = { carrier: ship.carrier, trackingNo: ship.trackingNo, url: ship.url.trim() || undefined };
    const parsed = ShippingSchema.safeParse(data);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || 'Kargo bilgisi eksik'); return; }
    run(async () => {
      await setOrderShippingAction(order.token, parsed.data);
      onChange({ ...order, shipping: parsed.data }, production);
    }, 'Kargo bilgisi kaydedildi.');
  };

  const removeShipping = () =>
    run(async () => {
      await setOrderShippingAction(order.token, null);
      setShip({ carrier: '', trackingNo: '', url: '' });
      onChange({ ...order, shipping: undefined }, production);
    }, 'Kargo bilgisi kaldırıldı.');

  return (
    <>
      <section className="card sip-card sip-track" id="sip-uretim" aria-labelledby="sip-uretim-baslik">
        <h2 id="sip-uretim-baslik" className="sip-h2">Üretim aşaması</h2>
        {production ? (
          <>
            <p className="sip-stage">{ORDER_STATUS_LABELS[production.status]}</p>
            <div className="sip-actions">
              {next && (
                <button type="button" className="btn btn-primary btn-sm" onClick={advance} disabled={busy}>
                  Sonraki aşama: {ORDER_STATUS_LABELS[next]}
                </button>
              )}
              <Link href="/admin/makine" className="btn btn-secondary btn-sm">Üretim hattı</Link>
            </div>
          </>
        ) : (
          <p className="adm-page-sub">
            {order.orderId ? 'Bağlı iş üretim hattında bulunamadı.' : 'Müşteri aşamaları görsün diye siparişi “Üretime aktar” ile üretim hattına alın.'}
          </p>
        )}
      </section>

      <section className="card sip-card sip-track" id="sip-onizleme" aria-labelledby="sip-onizleme-baslik">
        <h2 id="sip-onizleme-baslik" className="sip-h2">Baskı önizlemesi</h2>
        {proof && (
          <>
            <p className={`sip-proof-state is-${proof.state}`}>
              {PROOF_LABELS[proof.state]} · {proof.round}. tur · {when(proof.repliedAt ?? proof.sentAt)}
            </p>
            {proof.reply && <p className="sip-note"><b>Müşteri:</b> {proof.reply}</p>}
            <ul className="sip-files">
              {proof.images.map((id, i) => (
                <li key={id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={orderImageUrl(order.token, id, 240)} alt={`Gönderilen önizleme ${i + 1}`} />
                </li>
              ))}
            </ul>
            {proof.state === 'bekliyor' && (
              <a className="btn btn-secondary btn-sm sip-wa" href={notifyLink(order, 'baskı önizlemeniz hazır, onayınızı bekliyoruz:')} target="_blank" rel="noopener noreferrer">
                <IconWhatsApp size={16} /> Müşteriye haber ver
              </a>
            )}
          </>
        )}
        {!closed && (
          <>
            <label className="form-label" htmlFor="sip-proof-file">{proof ? 'Yeni hâlini gönder' : 'Önizleme görseli'} (en fazla {MAX_PROOF_IMAGES})</label>
            <input
              key={picker}
              id="sip-proof-file"
              className="form-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PROOF_IMAGES))}
            />
            <label className="form-label" htmlFor="sip-proof-note">Müşteriye not (isteğe bağlı)</label>
            <textarea id="sip-proof-note" className="form-textarea" rows={2} maxLength={MAX_PROOF_TEXT} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="sip-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={submitProof} disabled={busy || files.length === 0}>
                {busy ? 'Gönderiliyor…' : 'Onaya gönder'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card sip-card sip-track" id="sip-kargo" aria-labelledby="sip-kargo-baslik">
        <h2 id="sip-kargo-baslik" className="sip-h2">Kargo</h2>
        <label className="form-label" htmlFor="sip-firma">Firma</label>
        <input id="sip-firma" className="form-input" value={ship.carrier} maxLength={60} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
        <label className="form-label" htmlFor="sip-takip">Takip numarası</label>
        <input id="sip-takip" className="form-input" value={ship.trackingNo} maxLength={60} onChange={(e) => setShip({ ...ship, trackingNo: e.target.value })} />
        <label className="form-label" htmlFor="sip-url">Takip bağlantısı (isteğe bağlı)</label>
        <input id="sip-url" className="form-input" type="url" placeholder="https://" value={ship.url} maxLength={300} onChange={(e) => setShip({ ...ship, url: e.target.value })} />
        <div className="sip-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={saveShipping} disabled={busy}>Kargo bilgisini kaydet</button>
          {order.shipping && (
            <>
              <a className="btn btn-secondary btn-sm" href={notifyLink(order, 'siparişiniz kargoda. Takip bilgisi:')} target="_blank" rel="noopener noreferrer">
                <IconWhatsApp size={16} /> Müşteriye haber ver
              </a>
              <button type="button" className="btn btn-secondary btn-sm" onClick={removeShipping} disabled={busy}>Kaldır</button>
            </>
          )}
        </div>
      </section>
      {dialog}
    </>
  );
}
