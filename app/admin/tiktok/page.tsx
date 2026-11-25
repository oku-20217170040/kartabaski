'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getTikTokOverviewAction, requeueTikTokPostAction, postOneTikTokNowAction, disconnectTikTokAction, setTikTokEnabledAction,
  checkTikTokConnectionAction, checkRecentTikTokStatusesAction, type TikTokOverview, type RecentStatusRow,
} from '@/lib/actions-tiktok';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconAlert, IconRefresh, IconSend, IconLink, IconCheck, IconTikTok } from '@/components/admin/icons';
import '@/components/admin/social/social-extra.css';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

// TikTok: modeller fotoğraf taslağı olarak TikTok gelen kutusuna gider; yayınlamayı TikTok uygulamasında siz yaparsınız.
export default function AdminTikTokPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<TikTokOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requeuing, setRequeuing] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentStatusRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await getTikTokOverviewAction());
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
    if (q.get('bagli')) toast.success('TikTok hesabı bağlandı.');
    if (q.get('hata')) toast.error(`Bağlantı kurulamadı (${q.get('hata')}). Tekrar deneyin.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const toggle = async (enabled: boolean) => {
    try {
      await setTikTokEnabledAction(enabled);
      toast.success(enabled ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const postOne = async () => {
    const ok = await confirm({ title: 'Şimdi 1 taslak gönder', message: 'Saat penceresine bakmadan sıradaki 1 model TikTok gelen kutusuna taslak olarak gönderilsin mi?', confirmLabel: 'Gönder' });
    if (!ok) return;
    setBusy(true);
    try {
      let r = await postOneTikTokNowAction();
      // 24 saatte 5 bekleyen taslak sınırı doluysa gönderim bildirim düşürmeyebilir: açık onay iste
      if (r.skipped?.includes('bekleyen taslağa')) {
        const force = await confirm({
          title: 'Bekleyen taslak sınırı dolu',
          message: `${r.skipped}. Yine de gönderilirse TikTok bildirim düşürmeyebilir; TikTok'taki eski taslakları yayınlayıp ya da silip beklemek daha güvenli.`,
          confirmLabel: 'Yine de gönder',
          danger: true,
        });
        if (!force) return;
        r = await postOneTikTokNowAction(true);
      }
      if (r.skipped) toast.error(`Atlandı: ${r.skipped}`);
      else if (r.errors.length) toast.error(`Hata: ${r.errors.join(' | ')}`);
      else toast.success(`${r.posted} taslak gönderildi. TikTok uygulamasında Gelen Kutusu'nu açın.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      const r = await checkTikTokConnectionAction();
      if (r.ok) toast.success(`Bağlı hesap: ${r.name || '(ad alınamadı)'}`);
      else toast.error(`Bağlantı hatası: ${r.error}`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const checkRecent = async () => {
    setBusy(true);
    try {
      setRecent(await checkRecentTikTokStatusesAction(6));
    } catch (e) {
      toast.error(errorMessage(e, 'Durum kontrol edilemedi'));
    } finally {
      setBusy(false);
    }
  };

  const requeue = async (id: string) => {
    setRequeuing(id);
    try {
      await requeueTikTokPostAction(id);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Kuyruğa alınamadı'));
    } finally {
      setRequeuing(null);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({ title: 'TikTok bağlantısını kaldır', message: 'Kayıtlı TikTok erişim anahtarları silinecek.', confirmLabel: 'Kaldır', danger: true });
    if (!ok) return;
    try {
      await disconnectTikTokAction();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const stats = ov
    ? [
        { label: 'Bağlantı', value: ov.connected ? ov.displayName || 'Bağlı' : 'Bağlı değil' },
        { label: 'Bekleyen taslak (24 sa)', value: `${ov.pending} / ${ov.pendingCap}` },
        { label: 'Sıradaki model', value: String(ov.backlog) },
        { label: 'Son taslak', value: ov.lastPostAt ? fmtDate(ov.lastPostAt) : '—' },
        { label: 'Toplam taslak', value: String(ov.posted.filter((p) => p.publishId).length) },
      ]
    : [];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">TikTok</h1>
          <p className="adm-page-sub">Modeller fotoğraf karuseli taslağı olarak TikTok gelen kutusuna gönderilir</p>
        </div>
      </div>

      <p className="socx-intro">
        Taslaklar, Sosyal Medya Merkezi’nde ayarlanan saat aralığında ve günlük kotada gönderilir. TikTok 24 saatte en fazla {ov?.pendingCap ?? 5} bekleyen taslağa izin verir: taslakları TikTok&apos;ta yayınlayın ya da silin, yoksa yenileri gelmez.
        Taslağı TikTok uygulamasında açıp Yayınla&apos;ya basarsınız; gönderi böylece herkese açık olur. Pasife alınan modellerin eski taslağı güncellenmez.
      </p>

      <div className="socx-bar">
        <button className="btn btn-secondary adm-btn-icon-label" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
        {ov?.configured && !ov.connected && (
          <a className="btn btn-primary adm-btn-icon-label" href="/api/tiktok/connect"><IconLink size={16} /> TikTok&apos;a bağlan</a>
        )}
        {ov?.connected && (
          <>
            <button className="btn btn-primary adm-btn-icon-label" onClick={postOne} disabled={busy}>
              <IconSend size={16} /> {busy ? 'Çalışıyor…' : 'Şimdi 1 taslak gönder'}
            </button>
            <button className="btn btn-secondary adm-btn-icon-label" onClick={check} disabled={busy}><IconCheck size={16} /> Bağlantıyı test et</button>
            <button className="btn btn-secondary" onClick={checkRecent} disabled={busy}>Son taslakların durumu</button>
            <button className="btn btn-danger" onClick={disconnect}>Bağlantıyı kaldır</button>
          </>
        )}
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
          <span>TikTok bağlı değil: TIKTOK_CLIENT_KEY ve TIKTOK_CLIENT_SECRET tanımlanana kadar paylaşım yapılmaz. Kurulum için docs/SOSYAL_MEDYA_KURULUM_2.md dosyasına bakın.</span>
        </div>
      )}
      {ov?.configured && !ov.connected && (
        <div className="socx-notice is-warn">
          <IconAlert size={16} />
          <span>Anahtarlar tanımlı ama hesap henüz yetkilendirilmedi; &quot;TikTok&apos;a bağlan&quot; ile bağlayın.</span>
        </div>
      )}
      {error && <div className="socx-notice is-error"><IconAlert size={16} /><span>{error}</span></div>}

      {recent && (
        <ul className="socx-recent">
          {recent.length === 0 && <li>Henüz gönderilmiş taslak yok.</li>}
          {recent.map((r, i) => (
            <li key={i} className={r.ok ? '' : 'is-bad'}>{fmtDate(r.postedAt)} · {r.title}: {r.text}</li>
          ))}
        </ul>
      )}

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
            <h2 className="adm-section-title">Gönderilen taslaklar</h2>
            {ov.posted.length === 0 ? (
              <div className="adm-empty">
                <IconTikTok size={28} />
                <p>Henüz TikTok taslağı yok.</p>
              </div>
            ) : (
              <div className="socx-list">
                <table className="socx-table">
                  <thead>
                    <tr><th>Gönderim</th><th>Model</th><th>Durum</th></tr>
                  </thead>
                  <tbody>
                    {ov.posted.map((r) => (
                      <tr key={r.id}>
                        <td className="is-nowrap">{fmtDate(r.postedAt)}</td>
                        <td>{r.title}</td>
                        <td>
                          {r.error ? (
                            <span className="socx-err">
                              <IconAlert size={14} /> {r.error}
                              <button className="btn btn-secondary btn-sm" onClick={() => requeue(r.id)} disabled={requeuing !== null}>
                                {requeuing === r.id ? 'Alınıyor…' : 'Kuyruğa al'}
                              </button>
                            </span>
                          ) : (
                            <span className={r.active ? 'badge badge-green' : 'badge badge-muted'}>{r.active ? 'Taslak gönderildi' : 'Taslak gönderildi (model pasif)'}</span>
                          )}
                        </td>
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
