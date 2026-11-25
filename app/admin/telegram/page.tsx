'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getTelegramChannelOverviewAction, requeueTelegramPostAction, setTelegramEnabledAction, postOneTelegramNowAction, type TgOverview,
} from '@/lib/actions-telegram-channel';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconAlert, IconRefresh, IconSend, IconExternal, IconTelegram } from '@/components/admin/icons';
import '@/components/admin/social/social-extra.css';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

// Telegram kanalı otomatik paylaşım: günlük kota, sıradaki modeller ve paylaşılan gönderiler.
export default function AdminTelegramPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<TgOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requeuing, setRequeuing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await getTelegramChannelOverviewAction());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, 'Yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (enabled: boolean) => {
    try {
      await setTelegramEnabledAction(enabled);
      toast.success(enabled ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const postOne = async () => {
    const ok = await confirm({ title: 'Şimdi 1 gönderi paylaş', message: 'Saat penceresine bakmadan sıradaki 1 yazı veya model kanala gönderilsin mi?', confirmLabel: 'Gönder' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await postOneTelegramNowAction();
      if (r.skipped) toast.error(`Atlandı: ${r.skipped}`);
      else if (r.errors.length) toast.error(`Hata: ${r.errors.join(' | ')}`);
      else toast.success(`${r.posted} gönderi paylaşıldı.`);
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
      await requeueTelegramPostAction(key);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Kuyruğa alınamadı'));
    } finally {
      setRequeuing(null);
    }
  };

  const stats = ov
    ? [
        { label: 'Bugün gönderi', value: `${ov.todayCount} / ${ov.dailyLimit}` },
        { label: 'Sıradaki model', value: String(ov.backlog) },
        { label: 'Tahmini bitiş', value: ov.backlog === 0 ? 'Tamam' : `${ov.etaDays} gün` },
        { label: 'Son paylaşım', value: ov.lastPostAt ? fmtDate(ov.lastPostAt) : '—' },
        { label: 'Toplam paylaşılan', value: String(ov.posted.filter((p) => !p.error).length) },
      ]
    : [];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Telegram Kanalı</h1>
          <p className="adm-page-sub">Yeni kupa modelleri ve blog yazıları kanala otomatik gider</p>
        </div>
      </div>

      <p className="socx-intro">
        Modeller günde en fazla {ov?.dailyLimit ?? 3} gönderi olarak paylaşılır (kota ve saat aralığı Sosyal Medya Merkezi’nden ayarlanır); yeni yazılar ve yeni eklenen modeller önce gider.
        Bir model pasife alınırsa kanaldaki gönderisi &quot;şu an satışta değil&quot; olarak, fiyat aralığı değişirse yeni fiyatla güncellenir.
      </p>

      <div className="socx-bar">
        <button className="btn btn-secondary adm-btn-icon-label" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
        <button className="btn btn-primary adm-btn-icon-label" onClick={postOne} disabled={busy || !ov?.configured}>
          <IconSend size={16} /> {busy ? 'Gönderiliyor…' : 'Şimdi 1 gönderi paylaş'}
        </button>
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
          <span>Telegram kanalı bağlı değil: TELEGRAM_BOT_TOKEN ve TELEGRAM_CHANNEL_ID tanımlanana kadar paylaşım yapılmaz. Kurulum için docs/SOSYAL_MEDYA_KURULUM_2.md dosyasına bakın.</span>
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
            <h2 className="adm-section-title">Paylaşılan gönderiler</h2>
            {ov.posted.length === 0 ? (
              <div className="adm-empty">
                <IconTelegram size={28} />
                <p>Henüz Telegram gönderisi yok.</p>
              </div>
            ) : (
              <div className="socx-list">
                <table className="socx-table">
                  <thead>
                    <tr><th>Paylaşım</th><th>İçerik</th><th>Durum</th><th>Gönderi</th></tr>
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
                          ) : r.kind === 'blog' ? (
                            <span className="badge badge-green">Yayında</span>
                          ) : r.active ? (
                            <span className="badge badge-green">Satışta</span>
                          ) : (
                            <span className="badge badge-muted">Pasif{r.closed ? ' (gönderi güncellendi)' : ' (güncelleme bekliyor)'}</span>
                          )}
                        </td>
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
