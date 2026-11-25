'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getThreadsOverviewAction, requeueThreadsPostAction, postOneThreadsNowAction, shareThreadsProductNowAction, type ThreadsOverview,
} from '@/lib/actions-threads';
import { setSocialEnabledAction, updateSocialSettingsAction } from '@/lib/actions-social';
import { windowLabel } from '@/lib/social-settings-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconRefresh, IconSend, IconAlert, IconExternal, IconThreads } from '@/components/admin/icons';
import { Pill, Switch, SettingsForm, fmtWhen, fmtDay, daysLeft } from '@/components/admin/social/shared';
import '@/components/admin/social/social.css';

// Threads otomatik paylaşım: durum, token, kota ayarları, elle paylaşım ve paylaşılan gönderiler.
export default function AdminThreadsPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<ThreadsOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requeuing, setRequeuing] = useState<string | null>(null);
  const [shareId, setShareId] = useState('');

  const load = useCallback(async (check = false) => {
    setLoading(true);
    try {
      setOv(await getThreadsOverviewAction(check));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const postOne = async () => {
    const ok = await confirm({ title: 'Şimdi 1 model paylaş', message: 'Saat penceresine bakmadan sıradaki 1 model Threads’te paylaşılsın mı? (Günlük kota geçerli kalır.)', confirmLabel: 'Paylaş' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await postOneThreadsNowAction();
      if (r.skipped) toast.error(`Atlandı: ${r.skipped}`);
      else if (r.errors.length) toast.error(`Hata: ${r.errors.join(' | ')}`);
      else toast.success(`${r.posted} model paylaşıldı.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shareNow = async () => {
    const item = ov?.candidates.find((c) => c.id === shareId);
    if (!item) return;
    const ok = await confirm({ title: 'Şimdi paylaş', message: `"${item.title}" Threads’te hemen herkese açık paylaşılacak. Devam edilsin mi?`, confirmLabel: 'Paylaş' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await shareThreadsProductNowAction(item.id);
      if (!r.ok) throw new Error(r.reason || 'Paylaşılamadı.');
      toast.success('Threads’te paylaşıldı.');
      setShareId('');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const requeue = async (id: string) => {
    setRequeuing(id);
    try {
      await requeueThreadsPostAction(id);
      toast.success('Kuyruğa alındı.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRequeuing(null);
    }
  };

  const left = daysLeft(ov?.tokenExpiresAt);
  const published = ov?.posted.filter((p) => !p.error).length ?? 0;

  return (
    <div className="soc-page">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Threads</h1>
          <p className="adm-page-sub">Kupa modelleri, yeni blog yazıları ve özel gün kampanyaları otomatik paylaşılır.</p>
        </div>
        <div className="soc-actions">
          <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={loading}>
            <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
          <button type="button" className="btn btn-primary" onClick={postOne} disabled={busy || !ov?.configured}>
            <IconSend size={16} /> Şimdi 1 model paylaş
          </button>
        </div>
      </div>

      <p className="soc-lead">
        Her model, görsellerinden oluşan bir gönderi olarak paylaşılır; açıklama ve ayrıntılar gönderinin altına yanıt olarak eklenir
        (Threads gönderi başına 500 karakter sınırı koyar). Yeni eklenen model önce gider, ardından günlük kotaya göre sıra devam eder.
      </p>

      {error && <div className="soc-note err" role="alert"><IconAlert size={14} /> {error}</div>}

      {ov && !ov.configured && (
        <div className="soc-note warn" style={{ marginBottom: 20 }}>
          <strong>Bağlı değil.</strong> THREADS_ACCESS_TOKEN tanımlı olmadığı için paylaşım yapılmıyor.
          Kurulum adımları: docs/SOSYAL_MEDYA_KURULUM.md. Altyapı hazır; jeton girilince kendiliğinden çalışır.
        </div>
      )}
      {ov?.tokenError && <div className="soc-note err" style={{ marginBottom: 20 }}>Hesap doğrulanamadı: {ov.tokenError}</div>}

      {ov && (
        <>
          <div className="soc-panel">
            <div className="soc-actions" style={{ justifyContent: 'space-between' }}>
              <div className="soc-actions">
                <span className="soc-card-icon"><IconThreads size={20} /></span>
                <div>
                  <strong>{ov.username ? `@${ov.username}` : 'Threads hesabı'}</strong>
                  <div className="soc-muted">
                    {windowLabel(ov.settings)} · günde en fazla {ov.settings.dailyLimit}
                    {ov.tokenExpiresAt ? ` · token ${fmtDay(ov.tokenExpiresAt)} tarihine kadar${left !== undefined && left < 10 ? ` (${Math.max(0, left)} gün kaldı)` : ''}` : ''}
                  </div>
                </div>
                <Pill tone={!ov.configured ? 'warn' : ov.settings.enabled ? 'ok' : 'muted'}>
                  {!ov.configured ? 'Bağlı değil' : ov.settings.enabled ? 'Açık' : 'Kapalı'}
                </Pill>
              </div>
              <Switch
                label="Otomatik paylaşım"
                checked={ov.settings.enabled}
                disabled={busy}
                onChange={(v) => act(() => setSocialEnabledAction('threads', v), v ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.')}
              />
            </div>
          </div>

          <div className="soc-stats">
            <div className="soc-stat"><span className="soc-stat-label">Bugün gönderi</span><span className="soc-stat-value">{ov.todayCount} / {ov.settings.dailyLimit}</span></div>
            <div className="soc-stat"><span className="soc-stat-label">Sırada kalan model</span><span className="soc-stat-value">{ov.backlog}</span></div>
            <div className="soc-stat"><span className="soc-stat-label">Tahmini bitiş</span><span className="soc-stat-value">{ov.backlog === 0 ? 'Tamam' : ov.etaDays ? `${ov.etaDays} gün` : '—'}</span></div>
            <div className="soc-stat"><span className="soc-stat-label">Son paylaşım</span><span className="soc-stat-value" style={{ fontSize: '1.1rem' }}>{fmtWhen(ov.lastPostAt)}</span></div>
            <div className="soc-stat"><span className="soc-stat-label">Toplam paylaşılan</span><span className="soc-stat-value">{published}</span></div>
          </div>

          <SettingsForm
            settings={ov.settings}
            busy={busy}
            onSave={(v) => act(() => updateSocialSettingsAction('threads', { dailyLimit: v.dailyLimit, windowStart: v.windowStart, windowEnd: v.windowEnd }), 'Ayarlar kaydedildi.')}
          />

          <div className="soc-panel">
            <h2>Şimdi paylaş</h2>
            <p className="soc-muted">Kuyruğu beklemeden henüz paylaşılmamış bir modeli hemen yayınlar.</p>
            <div className="soc-form-row">
              <div className="soc-field" style={{ flex: '2 1 240px' }}>
                <label htmlFor="th-share">Model</label>
                <select id="th-share" value={shareId} onChange={(e) => setShareId(e.target.value)}>
                  <option value="">Model seçin</option>
                  {ov.candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={shareNow} disabled={busy || !shareId || !ov.configured}>Şimdi paylaş</button>
            </div>
          </div>

          <section className="soc-section">
            <div className="soc-section-head"><h2>Paylaşılan gönderiler</h2></div>
            {ov.posted.length === 0 ? (
              <div className="soc-empty">Henüz Threads gönderisi yok.</div>
            ) : (
              <div className="soc-table-wrap">
                <table className="soc-table">
                  <thead>
                    <tr><th>Paylaşım</th><th>Model</th><th>Fiyat</th><th>Durum</th><th>Gönderi</th></tr>
                  </thead>
                  <tbody>
                    {ov.posted.map((r) => (
                      <tr key={r.id}>
                        <td className="soc-nowrap">{fmtWhen(r.postedAt)}</td>
                        <td>{r.title}</td>
                        <td className="soc-nowrap">{r.priceLabel}</td>
                        <td>
                          {r.error ? (
                            <span className="soc-actions">
                              <span className="soc-error-line">{r.error}</span>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => requeue(r.id)} disabled={requeuing !== null}>
                                {requeuing === r.id ? 'Alınıyor…' : 'Kuyruğa al'}
                              </button>
                            </span>
                          ) : r.active ? <Pill tone="ok">Aktif</Pill> : <Pill>Pasif</Pill>}
                        </td>
                        <td>
                          {r.link ? <a href={r.link} target="_blank" rel="noreferrer" className="soc-actions">Aç <IconExternal size={14} /></a> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <p className="soc-muted"><Link href="/admin/sosyal-medya">Sosyal medya merkezine dön</Link></p>
      {dialog}
    </div>
  );
}
