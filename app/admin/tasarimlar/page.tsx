'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listDesignsAction } from '@/lib/actions-designs';
import { Design, designNo } from '@/lib/design-types';
import { TALEP_LABELS } from '@/lib/talep-status';
import { cloudinaryUrl } from '@/lib/format';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { IconPalette, IconRefresh } from '@/components/admin/icons';
import './tasarimlar.css';

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function TasarimlarPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrafts, setShowDrafts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listDesignsAction());
    } catch (e) {
      toast.error(errorMessage(e, 'Siparişler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const drafts = rows.filter((d) => d.status === 'taslak').length;
  const shown = showDrafts ? rows : rows.filter((d) => d.status !== 'taslak');

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Tasarım Siparişleri</h1>
          <p className="adm-page-sub">Müşterinin sitede hazırlayıp WhatsApp’tan bağlantısını gönderdiği siparişler</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> Yenile
        </button>
      </div>

      {drafts > 0 && (
        <label className="dsg-adm-drafts">
          <input type="checkbox" checked={showDrafts} onChange={(e) => setShowDrafts(e.target.checked)} />
          Gönderilmemiş taslakları da göster ({drafts})
        </label>
      )}

      {loading ? (
        <div className="dsg-adm-center"><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconPalette size={36} /></div>
          <div className="empty-state-title">Henüz tasarım siparişi yok</div>
          <div className="empty-state-sub">Müşteri “WhatsApp’tan gönderin”e bastığında burada görünür.</div>
        </div>
      ) : (
        <ul className="dsg-adm-list">
          {shown.map((d) => {
            const image = d.preview ?? d.files[0];
            return (
              <li key={d.token}>
                <Link href={`/admin/tasarimlar/${d.token}`} className={`card dsg-adm-row${d.status === 'yeni' ? ' is-new' : ''}`}>
                  <span className="dsg-adm-thumb">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cloudinaryUrl(image, 'f_auto,q_auto,w_160,h_160,c_fill')} alt="" />
                    )}
                  </span>
                  <span className="dsg-adm-main">
                    <b>No: {designNo(d.token)} · {d.productTitle}</b>
                    <small>
                      {formatDate(d.createdAt)} · {d.files.length} fotoğraf{d.text ? ` · “${d.text}”` : ''}
                    </small>
                  </span>
                  <span className={`dsg-adm-badge${d.status === 'yeni' ? ' is-new' : ''}`}>
                    {d.status === 'taslak' ? 'Taslak' : TALEP_LABELS[d.status].label}
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
