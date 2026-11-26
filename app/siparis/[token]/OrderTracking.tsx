'use client';

import { useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { CustomerOrder, MAX_PROOF_TEXT, Proof, canReplyProof, orderImageUrl } from '@/lib/siparis-types';
import { replyProofRequest } from '@/lib/siparis-client';
import type { Tracking } from '@/lib/siparis-takip';

const date = (ts: number) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

export function Timeline({ tracking }: { tracking: Tracking }) {
  if (tracking.cancelled) return null;
  return (
    <ol className="ord-track" aria-label="Sipariş durumu">
      {tracking.steps.map((s) => (
        <li key={s.label} className={`is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <i aria-hidden="true">{s.state === 'done' && <CheckIcon size={14} />}</i>
          <span>{s.label}</span>
          {s.at && <small>{date(s.at)}</small>}
          {s.state === 'done' && <span className="sr-only">tamamlandı</span>}
        </li>
      ))}
    </ol>
  );
}

export function Shipment({ shipping }: { shipping: NonNullable<CustomerOrder['shipping']> }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shipping.trackingNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi yok */
    }
  };
  return (
    <section className="ord-ship" aria-labelledby="ord-kargo">
      <h2 id="ord-kargo" className="h3">Kargonuz yolda</h2>
      <p>{shipping.carrier} · Takip no: <b>{shipping.trackingNo}</b></p>
      <div className="ord-actions">
        <button type="button" className="btn btn-outline" onClick={copy}>{copied ? 'Kopyalandı' : 'Numarayı kopyala'}</button>
        {shipping.url && <a className="btn btn-primary" href={shipping.url} target="_blank" rel="noopener noreferrer">Kargoyu takip edin</a>}
      </div>
    </section>
  );
}

interface ProofProps {
  order: CustomerOrder;
  proof: Proof;
  onReplied: (proof: Proof) => void;
}

export function ProofReview({ order, proof, onReplied }: ProofProps) {
  const [fixing, setFixing] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = canReplyProof({ status: order.status, proof });

  const send = async (decision: 'onaylandi' | 'duzeltme') => {
    if (decision === 'duzeltme' && !reply.trim()) { setError('Neyi düzeltmemizi istediğinizi yazın.'); return; }
    setBusy(true);
    setError('');
    try {
      onReplied(await replyProofRequest(order.token, { round: proof.round, decision, reply: decision === 'duzeltme' ? reply.trim() : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`ord-proof is-${proof.state}`} aria-labelledby="ord-onizleme">
      <h2 id="ord-onizleme" className="h3">Baskı önizlemesi{proof.round > 1 ? ` (${proof.round}. hâli)` : ''}</h2>
      {proof.message && <p>{proof.message}</p>}
      <ul className="ord-proof-images">
        {proof.images.map((id, i) => (
          <li key={id}>
            <a href={orderImageUrl(order.token, id, 900)} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={orderImageUrl(order.token, id, 900)} alt={`Baskı önizlemesi ${i + 1}`} />
            </a>
          </li>
        ))}
      </ul>

      {proof.state === 'onaylandi' && <p className="ord-answer" role="status">Onayladınız. Teşekkürler, baskıya hazırlıyoruz.</p>}
      {proof.state === 'duzeltme' && <p className="ord-answer" role="status">Düzeltme isteğiniz: “{proof.reply}”. Yeni hâlini buraya koyacağız.</p>}

      {open && (
        <>
          <p>Yazımı, fotoğrafı ve yerleşimi kontrol edin. Siz onaylamadan baskıya geçmiyoruz.</p>
          {fixing ? (
            <div className="ord-fix">
              <label htmlFor="ord-duzeltme">Neyi değiştirelim?</label>
              <textarea id="ord-duzeltme" rows={3} maxLength={MAX_PROOF_TEXT} value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="ord-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send('duzeltme')}>{busy ? 'Gönderiliyor…' : 'İsteği gönderin'}</button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setFixing(false); setError(''); }}>Vazgeç</button>
              </div>
            </div>
          ) : (
            <div className="ord-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send('onaylandi')}>{busy ? 'Gönderiliyor…' : 'Onaylıyorum'}</button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setFixing(true)}>Düzeltme istiyorum</button>
            </div>
          )}
        </>
      )}
      <p className="ord-error" role="alert">{error}</p>
    </section>
  );
}
