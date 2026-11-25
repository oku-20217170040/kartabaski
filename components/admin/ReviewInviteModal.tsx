'use client';

import { useEffect, useState } from 'react';
import {
  createReviewInviteAction, listProductOptionsAction, type CreatedInvite, type ProductOption,
} from '@/lib/actions-reviews';
import { waLink, waPhone } from '@/lib/reviews-utils';
import '@/app/admin/yorumlar/yorumlar.css';

interface Props {
  /** Verilirse ürün sabit seçilir (ör. satış sonrası ürün sayfasından). Verilmezse ürün seçici açılır. */
  fixed?: { productId: string; title: string };
  onClose: () => void;
}

const GENERAL = '';

/** Müşteriye tek kullanımlık yorum bağlantısı üretir; WhatsApp'ta hazır mesajla açar veya kopyalar. */
export default function ReviewInviteModal({ fixed, onClose }: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<string>(fixed?.productId ?? GENERAL);
  const [phone, setPhone] = useState('');
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (fixed) return;
    listProductOptionsAction().then(setProducts).catch(() => setError('Ürünler yüklenemedi.'));
  }, [fixed]);

  const normalized = phone.trim() ? waPhone(phone) : null;
  const phoneInvalid = phone.trim() !== '' && !normalized;
  const selectedTitle = fixed ? fixed.title : (products.find((p) => p.id === selected)?.title ?? 'Genel yorum');

  // Aynı seçimle tekrar basılırsa yeni bağlantı üretmez
  const ensureInvite = async (): Promise<CreatedInvite | null> => {
    if (invite) return invite;
    const res = await createReviewInviteAction(selected);
    if ('error' in res) { setError(res.error); return null; }
    setInvite(res);
    return res;
  };

  const onSelect = (value: string) => {
    setSelected(value);
    setInvite(null); // farklı ürün = yeni bağlantı
    setCopied(false);
  };

  const sendWhatsApp = async () => {
    if (phoneInvalid) { setError('Telefon numarası tanınmadı (örn. 0532 123 45 67).'); return; }
    setError('');
    setBusy(true);
    const win = window.open('', '_blank'); // açılır pencere engelini aşmak için tıklama anında aç
    try {
      const inv = await ensureInvite();
      if (!inv) { win?.close(); return; }
      const link = waLink(inv.message, normalized);
      if (win) win.location.href = link;
      else window.location.href = link;
    } catch {
      win?.close();
      setError('Bağlantı oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setError('');
    setBusy(true);
    try {
      const inv = await ensureInvite();
      if (!inv) return;
      await navigator.clipboard.writeText(inv.message);
      setCopied(true);
    } catch {
      setError('Kopyalanamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal yor-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="yor-invite-title">
        <h3 id="yor-invite-title" className="adm-modal-title">Müşteriden yorum iste</h3>

        {fixed ? (
          <p className="adm-modal-text">{selectedTitle}</p>
        ) : (
          <div className="yor-field">
            <label htmlFor="yor-product" className="form-label">Ürün</label>
            <select id="yor-product" className="form-select" value={selected} onChange={(e) => onSelect(e.target.value)}>
              <option value={GENERAL}>Genel yorum (ürüne bağlı değil)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="yor-field">
          <label htmlFor="yor-phone" className="form-label">Müşterinin telefonu (isteğe bağlı)</label>
          <input
            id="yor-phone"
            className="form-input"
            type="tel"
            inputMode="tel"
            placeholder="0532 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="yor-hint">
            Boş bırakırsanız WhatsApp&apos;ta kişi seçersiniz. Bağlantı tek kullanımlıktır, ilk açan cihaza kilitlenir ve 30 gün geçerlidir.
          </div>
        </div>

        {invite && (
          <div className="yor-hint yor-link">Bağlantı: {invite.url}</div>
        )}
        {error && <div className="yor-error" role="alert">{error}</div>}

        <div className="adm-modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Kapat</button>
          <button className="btn btn-secondary btn-sm" onClick={copy} disabled={busy}>{copied ? 'Kopyalandı' : 'Mesajı kopyala'}</button>
          <button className="btn btn-primary btn-sm" onClick={sendWhatsApp} disabled={busy || phoneInvalid}>
            {busy ? 'Hazırlanıyor…' : 'WhatsApp’ta gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
