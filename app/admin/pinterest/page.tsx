'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getPinterestOverviewAction, requeuePinterestPostAction, postOnePinterestNowAction, disconnectPinterestAction,
  setPinterestEnabledAction, type PinterestOverview,
} from '@/lib/actions-pinterest';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconAlert, IconRefresh, IconSend, IconExternal, IconLink, IconPinterest } from '@/components/admin/icons';
import '@/components/admin/social/social-extra.css';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

// Pinterest otomatik paylaşım: bağlantı, günlük kota, sıradaki modeller ve paylaşılan pinler.
export default function AdminPinterestPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<PinterestOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requeuing, setRequeuing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await getPinterestOverviewAction());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get('bagli')) toast.success('Pinterest hesabı bağlandı.');
    if (q.get('hata')) toast.error(`Bağlantı kurulamadı (${q.get('hata')}). Tekrar deneyin.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const toggle = async (enabled: boolean) => {
    try {
      await setPinterestEnabledAction(enabled);
      toast.success(enabled ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const disconnect = async () => {
    const ok = await confirm({ title: 'Pinterest bağlantısını kaldır', message: 'Kayıtlı Pinterest erişim anahtarları silinecek.', confirmLabel: 'Kaldır', danger: true });
    if (!ok) return;
    try {
      await disconnectPinterestAction();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const postOne = async () => {
    const ok = await confirm({ title: 'Şimdi 1 pin paylaş', message: 'Saat penceresine bakmadan sıradaki 1 yazı veya model Pinterest\'te pinlensin mi?', confirmLabel: 'Pinle' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await postOnePinterestNowAction();
      if (r.skipped) toast.error(`Atlandı: ${r.skipped}`);
      else if (r.errors.length) toast.error(`Hata: ${r.errors.join(' | ')}`);
      else toast.success(`${r.posted} pin paylaşıldı.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const requeue = async (key: string) => {
    setRequeuing(key);
    try {
      await requeuePinterestPostAction(key);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Kuyruğa alınamadı'));
    } finally {
      setRequeuing(null);
    }
  };

  const stats = ov
    ? [
        { label: 'Bağlantı', value: ov.configured ? (ov.connection.viaOAuth ? 'Bağlı (OAuth)' : 'Bağlı (token)') : 'Bağlı değil' },
        { label: 'Bugün pin', value: `${ov.todayCount} / ${ov.dailyLimit}` },
        { label: 'Sıradaki model', value: String(ov.backlog) },
        { label: 'Tahmini bitiş', value: ov.backlog === 0 ? 'Tamam' : `${ov.etaDays} gün` },
        { label: 'Son paylaşım', value: ov.lastPostAt ? fmtDate(ov.lastPostAt) : '—' },
        { label: 'Toplam pin', value: String(ov.posted.filter((p) => !p.error).length) },
      ]
    : [];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Pinterest</h1>
          <p className="adm-page-sub">Kupa modelleri kategori panolarına, blog yazıları &quot;Kupa Rehberi&quot; panosuna pinlenir</p>
        </div>
      </div>

      <p className="socx-intro">
        Günde en fazla {ov?.dailyLimit ?? 3} pin paylaşılır (kota ve saat aralığı Sosyal Medya Merkezi’nden ayarlanır); yeni yazılar ve yeni eklenen modeller önce gider. Her kupa kategorisi için bir pano
        (örn. Lüks Kupa, Sihirli Kupa, Kurumsal) hesapta yoksa kendiliğinden oluşturulur; çok fotoğraflı modeller çok görselli pin olur. Pasife alınan modelin pini kalır, bağlantı ürün sayfasına gider.
        Trial erişimde atılan pinler yalnızca hesap sahibine görünür; herkese açık olması için Standard erişim gerekir.
      </p>

      <div className="socx-bar">
        <button className="btn btn-secondary adm-btn-icon-label" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
        <button className="btn btn-primary adm-btn-icon-label" onClick={postOne} disabled={busy || !ov?.configured}>
          <IconSend size={16} /> {busy ? 'Paylaşılıyor…' : 'Şimdi 1 pin paylaş'}
        </button>
        {ov?.oauthReady && (
          <a className="btn btn-secondary adm-btn-icon-label" href="/api/pinterest/connect">
            <IconLink size={16} /> {ov.connection.viaOAuth ? "Pinterest'e yeniden bağlan" : "Pinterest'e bağlan"}
          </a>
        )}
        {ov?.connection.viaOAuth && <button className="btn btn-danger" onClick={disconnect}>Bağlantıyı kaldır</button>}
        {ov && (
          <label className="socx-toggle">
            <input type="checkbox" checked={ov.enabled} onChange={(e) => toggle(e.target.checked)} />
            Otomasyon açık
          </label>
        )}
      </div>

      {ov && !ov.configured && (
        <div className="socx-notice is-warn">
          <IconAlert size={16} />
          <span>
            {ov.oauthReady
              ? "Pinterest bağlı değil; \"Pinterest'e bağlan\" ile hesabı yetkilendirene kadar paylaşım yapılmaz."
              : 'Pinterest bağlı değil: PINTEREST_APP_ID ve PINTEREST_APP_SECRET (ya da PINTEREST_ACCESS_TOKEN) tanımlanmalı. Kurulum için docs/SOSYAL_MEDYA_KURULUM_2.md dosyasına bakın.'}
          </span>
        </div>
      )}
      {error && <div className="socx-notice is-error"><IconAlert size={16} /><span>{error}</span></div>}

      {ov && (
        <>
          <div className="adm-stat-grid">
            {stats.map((s) => (
              <div key={s.label} className="card adm-stat">
                <div className="adm-stat-value">{s.value}</div>
                <div className="adm-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card adm-section">
            <h2 className="adm-section-title">Paylaşılan pinler</h2>
            {ov.posted.length === 0 ? (
              <div className="adm-empty">
                <IconPinterest size={28} />
                <p>Henüz Pinterest pini yok.</p>
              </div>
            ) : (
              <div className="socx-list">
                <table className="socx-table">
                  <thead>
                    <tr><th>Paylaşım</th><th>İçerik</th><th>Durum</th><th>Pano</th><th>Pin</th></tr>
                  </thead>
                  <tbody>
                    {ov.posted.map((r) => (
                      <tr key={r.id}>
                        <td className="is-nowrap">{fmtDate(r.postedAt)}</td>
                        <td><span className="socx-kind">{r.kind === 'blog' ? 'Yazı' : 'Model'}</span>{r.title}</td>
                        <td>
                          {r.error ? (
                            <span className="socx-err">
                              <IconAlert size={14} /> {r.error}
                              <button className="btn btn-secondary btn-sm" onClick={() => requeue(r.id)} disabled={requeuing !== null}>
                                {requeuing === r.id ? 'Alınıyor…' : 'Kuyruğa al'}
                              </button>
                            </span>
                          ) : r.active ? (
                            <span className="badge badge-green">{r.kind === 'blog' ? 'Yayında' : 'Satışta'}</span>
                          ) : (
                            <span className="badge badge-muted">Pasif</span>
                          )}
                        </td>
                        <td>{r.board ?? '—'}</td>
                        <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer">Aç <IconExternal size={14} /></a> : <span className="socx-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}
