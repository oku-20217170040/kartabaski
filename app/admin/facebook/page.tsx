'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getFacebookAutoOverviewAction, retryFacebookPostAction, shareFacebookProductNowAction, runFacebookNowAction, type FbAutoOverview,
} from '@/lib/actions-facebook-auto';
import { setSocialEnabledAction, updateSocialSettingsAction } from '@/lib/actions-social';
import { windowLabel } from '@/lib/social-settings-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconRefresh, IconSend, IconAlert, IconExternal, IconFacebook } from '@/components/admin/icons';
import { Pill, Switch, SettingsForm, fmtWhen } from '@/components/admin/social/shared';
import '@/components/admin/social/social.css';

// Facebook sayfası otomatik paylaşım: durum, kota ayarları, elle paylaşım ve paylaşılan gönderiler.
export default function AdminFacebookPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<FbAutoOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [shareId, setShareId] = useState('');

  const load = useCallback(async (check = false) => {
    setLoading(true);
    try {
      setOv(await getFacebookAutoOverviewAction(check));
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

  const runNow = async () => {
    const ok = await confirm({ title: 'Facebook turunu çalıştır', message: 'Yeni ürünler, blog yazısı, kampanya ve kota kuyruğu için tur şimdi bir kez çalışır. Otomasyon kapalıysa atlanır.', confirmLabel: 'Çalıştır' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await runFacebookNowAction();
      if (r.errors.length) toast.error(`Hata: ${r.errors.join(' | ')}`);
      else if (r.skipped && !r.posted) toast.error(`Atlandı: ${r.skipped}`);
      else toast.success(`${r.posted} paylaşım yapıldı.`);
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
    const ok = await confirm({ title: 'Şimdi paylaş', message: `"${item.title}" Facebook sayfasında hemen herkese açık paylaşılacak. Devam edilsin mi?`, confirmLabel: 'Paylaş' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await shareFacebookProductNowAction(item.id);
      if (!r.ok) throw new Error(r.reason || 'Paylaşılamadı.');
      toast.success('Facebook sayfasında paylaşıldı.');
      setShareId('');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const r = await retryFacebookPostAction(id);
      if (r.ok) toast.success('Yeniden paylaşıldı.'); else toast.error(`Tekrar denenemedi: ${r.reason ?? 'bilinmeyen hata'}`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRetrying(null);
    }
  };

  const published = ov?.posted.filter((p) => p.postId).length ?? 0;

  return (
    <div className="soc-page">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Facebook Sayfası</h1>
          <p className="adm-page-sub">Kupa modelleri, yeni blog yazıları ve özel gün kampanyaları sayfaya otomatik paylaşılır.</p>
        </div>
        <div className="soc-actions">
          <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={loading}>
            <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
          <button type="button" className="btn btn-primary" onClick={runNow} disabled={busy || !ov?.configured}>
            <IconSend size={16} /> Şimdi çalıştır
          </button>
        </div>
      </div>

      <p className="soc-lead">
        Yeni eklenen model hemen paylaşılır; diğerleri günlük kotaya göre sırayla gider. Liste bittiğinde 30 gündür paylaşılmayan
        modeller yeniden sıraya girer. Bir model pasife alınırsa gönderinin başına “şu an sipariş almıyor” notu yazılır.
      </p>

      {error && <div className="soc-note err" role="alert"><IconAlert size={14} /> {error}</div>}

      {ov && !ov.configured && (
        <div className="soc-note warn" style={{ marginBottom: 20 }}>
          <strong>Bağlı değil.</strong> FACEBOOK_PAGE_ID ve FACEBOOK_PAGE_ACCESS_TOKEN tanımlı olmadığı için paylaşım yapılmıyor.
          Kurulum adımları: docs/SOSYAL_MEDYA_KURULUM.md. Altyapı hazır; değişkenler girilince kendiliğinden çalışır.
        </div>
      )}
      {ov?.accountError && <div className="soc-note err" style={{ marginBottom: 20 }}>Sayfa doğrulanamadı: {ov.accountError}</div>}

      {ov && (
        <>
          <div className="soc-panel">
            <div className="soc-actions" style={{ justifyContent: 'space-between' }}>
              <div className="soc-actions">
                <span className="soc-card-icon"><IconFacebook size={20} /></span>
                <div>
                  <strong>{ov.account ? ov.account : 'Facebook sayfası'}</strong>
                  <div className="soc-muted">{windowLabel(ov.settings)} · günde en fazla {ov.settings.dailyLimit}</div>
                </div>
                <Pill tone={!ov.configured ? 'warn' : ov.settings.enabled ? 'ok' : 'muted'}>
                  {!ov.configured ? 'Bağlı değil' : ov.settings.enabled ? 'Açık' : 'Kapalı'}
                </Pill>
              </div>
              <Switch
                label="Otomatik paylaşım"
                checked={ov.settings.enabled}
                disabled={busy}
                onChange={(v) => act(() => setSocialEnabledAction('facebook', v), v ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.')}
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
            feedLabel="Günlük gönderi"
            onSave={(v) => act(() => updateSocialSettingsAction('facebook', { dailyLimit: v.dailyLimit, windowStart: v.windowStart, windowEnd: v.windowEnd }), 'Ayarlar kaydedildi.')}
          />

          <div className="soc-panel">
            <h2>Şimdi paylaş</h2>
            <p className="soc-muted">Kuyruğu beklemeden henüz paylaşılmamış bir modeli sayfada hemen yayınlar.</p>
            <div className="soc-form-row">
              <div className="soc-field" style={{ flex: '2 1 240px' }}>
                <label htmlFor="fb-share">Model</label>
                <select id="fb-share" value={shareId} onChange={(e) => setShareId(e.target.value)}>
                  <option value="">Model seçin</option>
                  {ov.candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={shareNow} disabled={busy || !shareId || !ov.configured}>Şimdi paylaş</button>
            </div>
            {ov.candidates.length === 0 && <p className="soc-muted" style={{ marginTop: 8 }}>Paylaşılmamış model kalmadı.</p>}
          </div>

          <section className="soc-section">
            <div className="soc-section-head"><h2>Paylaşılan gönderiler</h2></div>
            {ov.posted.length === 0 ? (
              <div className="soc-empty">Henüz Facebook gönderisi yok.</div>
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
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry(r.id)} disabled={retrying !== null}>
                                {retrying === r.id ? 'Deneniyor…' : 'Tekrar dene'}
                              </button>
                            </span>
                          ) : r.active ? <Pill tone="ok">Aktif</Pill> : <Pill>Pasif</Pill>}
                        </td>
                        <td>
                          {r.postId ? (
                            <a href={`https://www.facebook.com/${r.postId}`} target="_blank" rel="noreferrer" className="soc-actions">
                              Aç <IconExternal size={14} />
                            </a>
                          ) : '—'}
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
