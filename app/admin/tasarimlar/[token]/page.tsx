'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteDesignAction, getDesignAction, updateDesignAdminNoteAction, updateDesignStatusAction,
} from '@/lib/actions-designs';
import { Design, designNo, designUrl } from '@/lib/design-types';
import { TALEP_LABELS, TALEP_STATUSES, type TalepStatus } from '@/lib/talep-status';
import { cloudinaryUrl } from '@/lib/format';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconTrash } from '@/components/admin/icons';
import '../tasarimlar.css';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function TasarimDetayPage({ params }: { params: { token: string } }) {
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    getDesignAction(params.token)
      .then((d) => { setDesign(d); setNote(d?.adminNote ?? ''); })
      .catch((e) => toast.error(errorMessage(e, 'Sipariş yüklenemedi.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  if (loading) return <div className="dsg-adm-center"><div className="spinner" /></div>;
  if (!design) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Sipariş bulunamadı</div>
        <Link href="/admin/tasarimlar" className="btn btn-secondary btn-sm">Listeye dön</Link>
      </div>
    );
  }

  const run = async (job: () => Promise<void>, done: string) => {
    try { await job(); toast.success(done); } catch (e) { toast.error(errorMessage(e)); }
  };

  const setStatus = (status: TalepStatus) =>
    run(async () => {
      await updateDesignStatusAction(design.token, status);
      setDesign({ ...design, status });
    }, 'Durum güncellendi.');

  const remove = async () => {
    const ok = await confirm({
      title: 'Sipariş silinsin mi?',
      message: `${designNo(design.token)} numaralı sipariş ve fotoğrafları kalıcı olarak silinecek.`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await deleteDesignAction(design.token);
      router.push('/admin/tasarimlar');
    }, 'Sipariş silindi.');
  };

  const place = design.placement;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Sipariş {designNo(design.token)}</h1>
          <p className="adm-page-sub">{new Date(design.createdAt).toLocaleString('tr-TR')}</p>
        </div>
        <Link href="/admin/tasarimlar" className="btn btn-secondary btn-sm">Tüm siparişler</Link>
      </div>

      <div className="dsg-adm-detail">
        <section className="card dsg-adm-card">
          <dl className="dsg-adm-facts">
            <div><dt>Kupa</dt><dd><Link href={`/urun/${design.productSlug}`}>{design.productTitle}</Link></dd></div>
            {design.color && <div><dt>Renk</dt><dd>{design.color}</dd></div>}
            {design.text && <div><dt>Yazı ({design.font === 'el' ? 'el yazısı' : 'düz yazı'})</dt><dd>{design.text}</dd></div>}
            {design.removeBg && <div><dt>Arka plan</dt><dd>Silinsin</dd></div>}
            {place && (
              <div>
                <dt>Fotoğraf yerleşimi</dt>
                <dd>Boyut {pct(place.scale)} · yatay {pct(place.x)} · dikey {pct(place.y)} · açı {Math.round(place.rotate)}°</dd>
              </div>
            )}
          </dl>
          {design.note && <p className="dsg-adm-note"><b>Müşteri notu:</b> {design.note}</p>}

          <label className="form-label" htmlFor="dsg-durum">Durum</label>
          <select
            id="dsg-durum"
            className="form-select"
            value={design.status}
            onChange={(e) => setStatus(e.target.value as TalepStatus)}
          >
            {design.status === 'taslak' && <option value="taslak" disabled>Taslak (gönderilmedi)</option>}
            {TALEP_STATUSES.map((s) => <option key={s} value={s}>{TALEP_LABELS[s].label}</option>)}
          </select>

          <label className="form-label" htmlFor="dsg-admin-not">İç not</label>
          <textarea id="dsg-admin-not" className="form-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="dsg-adm-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => run(() => updateDesignAdminNoteAction(design.token, note), 'Not kaydedildi.')}
            >
              Notu kaydet
            </button>
            <a className="btn btn-secondary btn-sm" href={`${designUrl(design.token, '')}?musteri=1`} target="_blank" rel="noopener noreferrer">
              Müşteri sayfası
            </a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={remove}>
              <IconTrash size={16} /> Sil
            </button>
          </div>
        </section>

        <section className="dsg-adm-media">
          {design.preview && (
            <figure className="card dsg-adm-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cloudinaryUrl(design.preview, 'f_auto,q_auto,w_900,c_limit')} alt="Müşterinin gördüğü önizleme" />
              <figcaption>Müşterinin gördüğü önizleme</figcaption>
            </figure>
          )}
          <div className="card dsg-adm-card">
            <h2 className="dsg-adm-h2">Müşteri fotoğrafları ({design.files.length})</h2>
            {design.files.length === 0 ? (
              <p className="adm-page-sub">Fotoğraf eklenmedi.</p>
            ) : (
              <ul className="dsg-adm-files">
                {design.files.map((id, i) => (
                  <li key={id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cloudinaryUrl(id, 'f_auto,q_auto,w_400,h_400,c_limit')} alt={`Müşteri fotoğrafı ${i + 1}`} />
                    <a className="btn btn-secondary btn-sm" href={cloudinaryUrl(id, 'fl_attachment')}>Orijinali indir</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      {dialog}
    </div>
  );
}
