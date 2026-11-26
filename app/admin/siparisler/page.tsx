'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listOrderRequestsAction } from '@/lib/actions-siparis';
import { lineFiles, OrderRequest, PROOF_LABELS, orderImageUrl, orderNo } from '@/lib/siparis-types';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { cartImageSrc } from '@/lib/cart-products';
import { searchKey } from '@/lib/address';
import { displayTitle } from '@/lib/format';
import { IconCart, IconRefresh, IconWhatsApp } from '@/components/admin/icons';
import { customerWhatsappLink } from '@/lib/cart';
import { trackingLink } from './takip-linki';
import './siparisler.css';

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const formatDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Filter = TalepStatus | 'tumu';

export default function SiparislerPage() {
  const toast = useToast();
  const [rows, setRows] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('tumu');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOrderRequestsAction());
    } catch (e) {
      toast.error(errorMessage(e, 'Siparişler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = searchKey(query);
    const digits = query.replace(/\D/g, '');
    return rows.filter((o) => {
      if (filter !== 'tumu' && o.status !== filter) return false;
      if (!q) return true;
      const text = searchKey([o.name, orderNo(o), o.city, o.district, o.recipient?.name, ...o.items.map((i) => i.title)].filter(Boolean).join(' '));
      return text.includes(q) || (digits.length >= 4 && o.phone.replace(/\D/g, '').includes(digits));
    });
  }, [rows, filter, query]);
  const fresh = rows.filter((o) => o.status === 'yeni').length;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Siparişler</h1>
          <p className="adm-page-sub">{rows.length} sipariş{fresh > 0 ? ` · ${fresh} yeni` : ''}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> Yenile
        </button>
      </div>

      <input
        type="search"
        className="form-input sip-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ad, telefon, sipariş kodu ya da ürün ara"
        aria-label="Sipariş ara"
        autoComplete="off"
      />

      <div className="sip-filters" role="tablist" aria-label="Durum filtresi">
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
            {` (${s === 'tumu' ? rows.length : rows.filter((o) => o.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sip-center"><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCart size={36} /></div>
          <div className="empty-state-title">Sipariş bulunamadı</div>
          <div className="empty-state-sub">{query || filter !== 'tumu' ? 'Aramayı ya da süzgeci değiştirin.' : 'Müşteriler sepetten sipariş oluşturduğunda burada görünür.'}</div>
        </div>
      ) : (
        <ul className="sip-list">
          {shown.map((o) => {
            const own = o.items.map((i) => i.preview ?? lineFiles(i)[0]).find(Boolean);
            const wide = o.items.some((i) => i.back && i.preview === own);
            const image = own ? orderImageUrl(o.token, own, 240) : cartImageSrc(o.items.find((i) => i.ready?.image)?.ready?.image);
            const photos = o.items.reduce((s, i) => s + lineFiles(i).length, 0);
            return (
              <li key={o.token}>
                <Link href={`/admin/siparisler/${o.token}`} className={`card sip-row${o.status === 'yeni' ? ' is-new' : ''}`}>
                  <span className="sip-thumb">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" loading="lazy" className={wide ? 'is-wide' : undefined} />
                    )}
                  </span>
                  <span className="sip-main">
                    <b>{o.name}</b>
                    <small className="sip-code">{orderNo(o)}</small>
                    <small className="sip-items-line">{o.items.map((i) => `${i.qty}× ${displayTitle(i.title)}${i.color ? ` (${i.color})` : ''}${i.back ? ', iki yüz' : ''}`).join(' · ')}</small>
                    <small>
                      {formatDate(o.createdAt)}{o.district ? ` · ${o.district} / ${o.city}` : ''}
                      {photos ? ` · ${photos} fotoğraf` : ''}{o.total ? ` · ≈ ${fmt(o.total)}₺` : ''}
                    </small>
                  </span>
                  <span className="sip-badges">
                    {o.proof && o.status !== 'tamamlandi' && o.status !== 'iptal' && (
                      <span className={`sip-badge${o.attention ? ' is-new' : ''}`}>{PROOF_LABELS[o.proof.state]}</span>
                    )}
                    <span className={`sip-badge${o.status === 'yeni' ? ' is-new' : ''}`}>
                      {o.status === 'yukleniyor' ? 'Yükleniyor' : TALEP_LABELS[o.status].label}
                    </span>
                  </span>
                </Link>
                <div className="sip-quick">
                  <a className="btn btn-secondary btn-sm" href={`tel:${o.phone}`}>Ara</a>
                  <a className="btn btn-secondary btn-sm" href={customerWhatsappLink({ name: o.name, phone: o.phone, id: o.token, code: o.code })} target="_blank" rel="noopener noreferrer">
                    <IconWhatsApp size={16} /> WhatsApp
                  </a>
                  <a className="btn btn-secondary btn-sm" href={trackingLink(o)} target="_blank" rel="noopener noreferrer">Takip linki</a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
