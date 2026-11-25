'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SepetTalebi } from '@/lib/cart-types';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { customerWhatsappLink, requestNo } from '@/lib/cart';
import { cartImageSrc } from '@/lib/cart-products';
import {
  createOrderFromCartRequestAction,
  deleteCartRequestAction,
  getCartRequestsAction,
  updateCartRequestNoteAction,
  updateCartRequestStatusAction,
} from '@/lib/actions-cart';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconCart, IconCheck, IconClock, IconRefresh, IconTrash, IconWhatsApp, IconPrinter } from '@/components/admin/icons';
import './sepet-talepleri.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const formatDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Filter = TalepStatus | 'tumu';

export default function SepetTalepleriPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState<SepetTalebi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('tumu');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCartRequestsAction();
      setRows(data);
      setNotes(Object.fromEntries(data.map((t) => [t.id as string, t.adminNote ?? ''])));
    } catch (e) {
      toast.error(errorMessage(e, 'Talepler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = (id: string, p: Partial<SepetTalebi>) =>
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const setStatus = (id: string, status: TalepStatus) =>
    run(id, async () => {
      await updateCartRequestStatusAction(id, status);
      patch(id, { status });
    });

  const saveNote = (id: string) =>
    run(id, async () => {
      await updateCartRequestNoteAction(id, notes[id] ?? '');
      patch(id, { adminNote: notes[id] ?? '' });
      toast.success('Not kaydedildi.');
    });

  const toMachine = async (t: SepetTalebi) => {
    const ok = await confirm({
      title: 'Makineye aktarılsın mı?',
      message: `${requestNo(t.id)} numaralı talep için sipariş oluşturulacak ve talep "Siparişe alındı" olacak.`,
      confirmLabel: 'Aktar',
    });
    if (!ok) return;
    await run(t.id as string, async () => {
      const orderId = await createOrderFromCartRequestAction(t.id as string);
      patch(t.id as string, { status: 'siparis', orderId });
      toast.success('Sipariş oluşturuldu.');
    });
  };

  const remove = async (t: SepetTalebi) => {
    const ok = await confirm({
      title: 'Talep silinsin mi?',
      message: `${requestNo(t.id)} numaralı sepet talebi kalıcı olarak silinecek.`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await run(t.id as string, async () => {
      await deleteCartRequestAction(t.id as string);
      setRows((prev) => prev.filter((x) => x.id !== t.id));
      toast.success('Talep silindi.');
    });
  };

  const filtered = useMemo(() => (filter === 'tumu' ? rows : rows.filter((t) => t.status === filter)), [rows, filter]);
  const yeniCount = rows.filter((t) => t.status === 'yeni').length;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Sepet Talepleri</h1>
          <p className="adm-page-sub">
            {rows.length} talep{yeniCount > 0 ? ` · ${yeniCount} yeni` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> Yenile
        </button>
      </div>

      <div className="cart-adm-filters" role="tablist" aria-label="Durum filtresi">
        {(['tumu', ...TALEP_STATUSES] as Filter[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'tumu' ? 'Tümü' : TALEP_LABELS[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cart-adm-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCart size={36} /></div>
          <div className="empty-state-title">Sepet talebi bulunamadı</div>
          <div className="empty-state-sub">Müşteriler sepeti gönderdiğinde burada görünür.</div>
        </div>
      ) : (
        <div className="cart-adm-list">
          {filtered.map((t) => {
            const id = t.id as string;
            const st = TALEP_LABELS[t.status];
            const place = [t.district, t.city].filter(Boolean).join(' / ');
            return (
              <article key={id} className={`card cart-adm-card${t.status === 'yeni' ? ' is-new' : ''}`}>
                <header className="cart-adm-head">
                  <span className="cart-adm-no">No: {requestNo(id)}</span>
                  <span className={`cart-adm-badge cart-adm-badge-${st.tone}`}>{st.label}</span>
                  <span className="cart-adm-date"><IconClock size={14} /> {formatDate(t.createdAt)}</span>
                  <strong className="cart-adm-total">
                    {t.items.length} ürün{t.total > 0 ? ` · ≈ ${fmt(t.total)}₺` : ''}
                  </strong>
                </header>

                <ul className="cart-adm-items">
                  {t.items.map((p, i) => {
                    const src = cartImageSrc(p.image);
                    return (
                      <li key={`${p.productId}-${i}`}>
                        <span className="cart-adm-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {src ? <img src={src} alt="" /> : null}
                        </span>
                        <span className="cart-adm-item-main">
                          <Link href={`/urun/${p.slug}`} target="_blank" rel="noopener noreferrer">{p.title}</Link>
                          <small>
                            {p.qty} adet{p.color ? ` · Renk: ${p.color}` : ''}
                            {p.unitPrice > 0 ? ` · ${fmt(p.unitPrice)}₺'den başlayan` : ' · fiyat sorulacak'}
                          </small>
                          {p.note && <small className="cart-adm-pnote">Kişiselleştirme: {p.note}</small>}
                        </span>
                        {p.unitPrice > 0 && <b>≈ {fmt(p.unitPrice * p.qty)}₺</b>}
                      </li>
                    );
                  })}
                </ul>

                <dl className="cart-adm-contact">
                  <div><dt>Ad</dt><dd>{t.name || '—'}</dd></div>
                  <div><dt>Telefon</dt><dd>{t.phone ? <a href={`tel:${t.phone}`}>{t.phone}</a> : '—'}</dd></div>
                  <div><dt>İl / İlçe</dt><dd>{place || '—'}</dd></div>
                  {t.address && <div className="cart-adm-wide"><dt>Adres</dt><dd>{t.address}</dd></div>}
                </dl>
                {t.note && <p className="cart-adm-cnote">Müşteri notu: {t.note}</p>}

                <div className="cart-adm-notebox">
                  <label htmlFor={`an-${id}`} className="form-label">Not (yalnız yönetici görür)</label>
                  <textarea
                    id={`an-${id}`}
                    className="form-textarea"
                    rows={2}
                    maxLength={1000}
                    value={notes[id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))}
                  />
                  {(notes[id] ?? '') !== (t.adminNote ?? '') && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === id} onClick={() => saveNote(id)}>
                      Notu kaydet
                    </button>
                  )}
                </div>

                <footer className="cart-adm-actions">
                  {t.phone && (
                    <a href={customerWhatsappLink({ name: t.name, phone: t.phone, id })} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                      <IconWhatsApp size={16} /> WhatsApp
                    </a>
                  )}
                  {t.orderId ? (
                    <span className="cart-adm-order"><IconPrinter size={16} /> Makinede · {t.orderId.slice(0, 6).toUpperCase()}</span>
                  ) : (
                    t.status !== 'iptal' && (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy === id} onClick={() => toMachine(t)}>
                        <IconPrinter size={16} /> Makineye aktar
                      </button>
                    )
                  )}
                  {TALEP_STATUSES.filter((s) => s !== t.status && s !== 'siparis').map((s) => (
                    <button key={s} type="button" className={`btn btn-sm ${s === 'iptal' ? 'btn-danger' : 'btn-secondary'}`} disabled={busy === id} onClick={() => setStatus(id, s)}>
                      {s === 'tamamlandi' || s === 'incelendi' ? <IconCheck size={16} /> : null} {TALEP_LABELS[s].label}
                    </button>
                  ))}
                  <button type="button" className="btn btn-danger btn-sm cart-adm-del" disabled={busy === id} onClick={() => remove(t)}>
                    <IconTrash size={16} /> Sil
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {dialog}
    </div>
  );
}
