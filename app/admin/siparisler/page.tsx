'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listOrderRequestsAction } from '@/lib/actions-siparis';
import { OrderRequest, orderImageUrl, orderNo } from '@/lib/siparis-types';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { IconCart, IconRefresh } from '@/components/admin/icons';
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

  const shown = useMemo(() => (filter === 'tumu' ? rows : rows.filter((o) => o.status === filter)), [rows, filter]);
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
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sip-center"><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCart size={36} /></div>
          <div className="empty-state-title">Sipariş bulunamadı</div>
          <div className="empty-state-sub">Müşteriler sepetten sipariş oluşturduğunda burada görünür.</div>
        </div>
      ) : (
        <ul className="sip-list">
          {shown.map((o) => {
            const image = o.items.map((i) => i.preview ?? i.files[0]).find(Boolean);
            const photos = o.items.reduce((s, i) => s + i.files.length, 0);
            return (
              <li key={o.token}>
                <Link href={`/admin/siparisler/${o.token}`} className={`card sip-row${o.status === 'yeni' ? ' is-new' : ''}`}>
                  <span className="sip-thumb">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={orderImageUrl(o.token, image, 240)} alt="" loading="lazy" />
                    )}
                  </span>
                  <span className="sip-main">
                    <b>No: {orderNo(o.token)} · {o.name}</b>
                    <small>
                      {formatDate(o.createdAt)} · {o.items.length} tasarım, {o.items.reduce((s, i) => s + i.qty, 0)} adet
                      {photos ? ` · ${photos} fotoğraf` : ''}{o.total ? ` · ≈ ${fmt(o.total)}₺` : ''}
                    </small>
                  </span>
                  <span className={`sip-badge${o.status === 'yeni' ? ' is-new' : ''}`}>
                    {o.status === 'yukleniyor' ? 'Yükleniyor' : TALEP_LABELS[o.status].label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
