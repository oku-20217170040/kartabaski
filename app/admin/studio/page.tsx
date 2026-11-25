'use client';
/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  approveAction, deleteJobAction, enqueueAction, getPhotoAutoDataAction, rejectAction, retryJobAction, runNowAction,
  saveSettingsAction,
} from '@/lib/actions-photo-auto';
import {
  JOB_STATUS_LABEL, RESULT_STATUS_LABEL, isOpenStatus,
  type PhotoAutoData, type PhotoAutoSettings, type PhotoJob, type PhotoResult,
} from '@/lib/photo-auto-utils';
import { cloudinaryThumb, cloudinaryUrl } from '@/lib/format';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconAlert, IconCamera, IconCheck, IconClose, IconRefresh, IconSparkles, IconTrash } from '@/components/admin/icons';
import './studio.css';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const keyOf = (jobId: string, sceneId: string) => `${jobId}|${sceneId}`;

function PhotoAutoContent() {
  const params = useSearchParams();
  const queryProductId = params.get('productId');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [data, setData] = useState<PhotoAutoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<PhotoAutoSettings | null>(null);

  const [productId, setProductId] = useState<string>(queryProductId ?? '');
  const [productSearch, setProductSearch] = useState('');
  const [manualScenes, setManualScenes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const manualRef = useRef<HTMLElement | null>(null);
  const scenesInit = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await getPhotoAutoDataAction();
      setData(d);
      setDraft((cur) => cur ?? d.settings);
      if (!scenesInit.current) {
        scenesInit.current = true;
        setManualScenes(d.settings.sceneIds.slice(0, d.settings.perProduct));
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Veriler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (queryProductId && data && manualRef.current) manualRef.current.scrollIntoView({ block: 'start' });
    // yalnızca ilk veri geldiğinde
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  const sceneLabel = useCallback((id: string) => data?.scenes.find((s) => s.id === id)?.label ?? id, [data]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const dirty = useMemo(() => !!data && !!draft && JSON.stringify(data.settings) !== JSON.stringify(draft), [data, draft]);

  const patch = (p: Partial<PhotoAutoSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const toggleScene = (id: string) =>
    patch({ sceneIds: draft ? (draft.sceneIds.includes(id) ? draft.sceneIds.filter((s) => s !== id) : [...draft.sceneIds, id]) : [] });

  const saveSettings = () =>
    run('settings', async () => {
      if (!draft) return;
      if (!draft.sceneIds.length) {
        toast.error('En az bir sahne seçin.');
        return;
      }
      const s = await saveSettingsAction(draft);
      setDraft(s);
      toast.success('Ayarlar kaydedildi.');
      await load();
    });

  const generate = () =>
    run('manual', async () => {
      if (!productId) {
        toast.error('Önce bir ürün seçin.');
        return;
      }
      if (!manualScenes.length) {
        toast.error('En az bir sahne seçin.');
        return;
      }
      const q = await enqueueAction(productId, manualScenes);
      if (!q.jobId) {
        toast.error(q.reason || 'İş açılamadı.');
        return;
      }
      if (!q.created && q.reason) toast.success(q.reason);
      const r = await runNowAction(q.jobId);
      if (r.failed && !r.generated) toast.error(r.message || 'Üretim başarısız oldu.');
      else toast.success(`${r.generated} fotoğraf üretildi${r.failed ? `, ${r.failed} hata` : ''}.`);
      await load();
    });

  const runJob = (j: PhotoJob) =>
    run(`run:${j.id}`, async () => {
      const r = await runNowAction(j.id);
      if (r.failed && !r.generated) toast.error(r.message || 'Üretim başarısız oldu.');
      else toast.success(`${r.generated} fotoğraf üretildi${r.failed ? `, ${r.failed} hata` : ''}.`);
      await load();
    });

  const retryJob = (j: PhotoJob) =>
    run(`retry:${j.id}`, async () => {
      await retryJobAction(j.id);
      const r = await runNowAction(j.id);
      if (r.failed && !r.generated) toast.error(r.message || 'Üretim başarısız oldu.');
      else toast.success(`${r.generated} fotoğraf üretildi${r.failed ? `, ${r.failed} hata` : ''}.`);
      await load();
    });

  const approve = (j: PhotoJob, sceneIds: string[]) =>
    run(`ap:${j.id}`, async () => {
      const r = await approveAction(j.id, sceneIds);
      toast.success(`${r.approved} fotoğraf ürüne eklendi.`);
      setSelected(new Set());
      await load();
    });

  const reject = async (j: PhotoJob, sceneIds: string[]) => {
    const ok = await confirm({
      title: 'Fotoğraflar reddedilsin mi?',
      message: `${sceneIds.length} görsel kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: 'Reddet ve sil',
      danger: true,
    });
    if (!ok) return;
    await run(`rj:${j.id}`, async () => {
      const r = await rejectAction(j.id, sceneIds);
      toast.success(`${r.rejected} görsel silindi.`);
      setSelected(new Set());
      await load();
    });
  };

  const removeJob = async (j: PhotoJob) => {
    const ok = await confirm({
      title: 'İş silinsin mi?',
      message: 'Onaylanmamış görseller de silinir. Ürüne eklenmiş (onaylı) görsellere dokunulmaz.',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await run(`del:${j.id}`, async () => {
      await deleteJobAction(j.id);
      toast.success('İş silindi.');
      await load();
    });
  };

  const toggleSel = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  if (loading || !data || !draft) {
    return (
      <div className="pf-page">
        <div className="pf-loading">
          <div className="spinner" />
          Yükleniyor…
        </div>
      </div>
    );
  }

  const { status, providers, scenes, jobs, products } = data;
  const filtered = products.filter((p) => !productSearch.trim() || p.title.toLocaleLowerCase('tr-TR').includes(productSearch.trim().toLocaleLowerCase('tr-TR')));
  const picked = products.find((p) => p.id === productId);
  const chosenProvider = draft.provider === 'auto' ? providers.find((p) => p.id === status.activeProvider) : providers.find((p) => p.id === draft.provider);
  const noProvider = !providers.some((p) => p.configured);

  return (
    <div className="pf-page">
      <div className="pf-head">
        <div>
          <h1 className="adm-page-title">Ürün Fotoğrafları</h1>
          <p className="pf-sub">Ürünün fotoğraflarından, ürünü bozmadan stüdyo ortamında yeni fotoğraflar üretir.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm adm-btn-icon-label" onClick={() => { setLoading(true); void load(); }} disabled={!!busy}>
          <IconRefresh size={16} /> Yenile
        </button>
      </div>

      <div className="pf-pills">
        <span className={`pf-pill ${draft.enabled ? 'ok' : ''}`}>{data.settings.enabled ? 'Otomatik açık' : 'Otomatik kapalı'}</span>
        <span className="pf-pill">Bugün {status.usedToday}/{data.settings.dailyLimit}</span>
        <span className="pf-pill">Sırada {status.queued}</span>
        {status.running > 0 && <span className="pf-pill ok">Çalışan {status.running}</span>}
        <span className={`pf-pill ${status.pendingReview ? 'ok' : ''}`}>Onay bekleyen {status.pendingReview}</span>
      </div>

      {data.warnings.map((w) => (
        <div key={w} className="pf-warn"><IconAlert size={16} /> <span>{w}</span></div>
      ))}
      {noProvider && (
        <div className="pf-warn">
          <IconAlert size={16} />
          <span>Bağlı bir sağlayıcı yok. Aşağıdaki kartlarda yazan ortam değişkenini sunucuya ekleyin (ücretsiz seçenekler için “Ücretsiz” rozetine bakın).</span>
        </div>
      )}

      {/* (a) Sağlayıcılar */}
      <section className="card pf-panel">
        <h2>Sağlayıcı</h2>
        <p className="pf-hint">Fotoğrafları üreten servis. “Otomatik” ilk bağlı olanı kullanır. Seçimi aşağıdaki Ayarlar bölümünden kaydedin.</p>
        <div className="pf-providers">
          <button type="button" className={`pf-prov ${draft.provider === 'auto' ? 'on' : ''}`} onClick={() => patch({ provider: 'auto' })} aria-pressed={draft.provider === 'auto'}>
            <div className="pf-prov-top"><b>Otomatik</b>{draft.provider === 'auto' && <span className="pf-pill ok">Seçili</span>}</div>
            <small>{chosenProvider ? `Şu an: ${chosenProvider.label}` : 'Bağlı sağlayıcı bulunamadı'}</small>
          </button>
          {providers.map((p) => (
            <button key={p.id} type="button" className={`pf-prov ${draft.provider === p.id ? 'on' : ''} ${p.configured ? '' : 'off'}`} onClick={() => patch({ provider: p.id })} aria-pressed={draft.provider === p.id}>
              <div className="pf-prov-top">
                <b>{p.label}</b>
                {draft.provider === p.id && <span className="pf-pill ok">Seçili</span>}
              </div>
              <div className="pf-badges">
                <span className={`pf-pill ${p.configured ? 'ok' : 'warn'}`}>{p.configured ? 'Bağlı' : 'Bağlı değil'}</span>
                {p.free && <span className="pf-pill ok">Ücretsiz</span>}
              </div>
              <small>Model: {p.defaultModel}</small>
              {!p.configured && p.missingEnv.length > 0 && <code>{p.missingEnv.join(', ')}</code>}
            </button>
          ))}
        </div>
      </section>

      {/* (b) Ayarlar */}
      <section className="card pf-panel">
        <h2>Ayarlar</h2>
        <label className="pf-check">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          Ürün eklenince otomatik fotoğraf üret
        </label>

        <span className="pf-label">Sahneler (üretimde sırayla kullanılır)</span>
        <div className="pf-scenes">
          {scenes.map((s) => (
            <button key={s.id} type="button" className={`pf-chip ${draft.sceneIds.includes(s.id) ? 'on' : ''}`} aria-pressed={draft.sceneIds.includes(s.id)} onClick={() => toggleScene(s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="pf-grid">
          <label className="pf-field">
            Ürün başına fotoğraf (1–8)
            <input className="form-input" type="number" inputMode="numeric" min={1} max={8} value={draft.perProduct} onChange={(e) => patch({ perProduct: Number(e.target.value) || 1 })} />
          </label>
          <label className="pf-field">
            Referans fotoğraf sayısı (1–3)
            <input className="form-input" type="number" inputMode="numeric" min={1} max={3} value={draft.referenceCount} onChange={(e) => patch({ referenceCount: Number(e.target.value) || 1 })} />
            <small>Ürünün ilk N fotoğrafı yapay zekaya gösterilir.</small>
          </label>
          <label className="pf-field">
            Günlük limit (maliyet freni)
            <input className="form-input" type="number" inputMode="numeric" min={1} max={500} value={draft.dailyLimit} onChange={(e) => patch({ dailyLimit: Number(e.target.value) || 1 })} />
            <small>Günde en çok bu kadar fotoğraf üretilir (TSİ).</small>
          </label>
          <label className="pf-field">
            Üretilenler
            <select className="form-select" value={draft.autoApply} onChange={(e) => patch({ autoApply: e.target.value === 'append' ? 'append' : 'review' })}>
              <option value="review">Onayımı bekle (önerilen)</option>
              <option value="append">Doğrudan ürüne ekle</option>
            </select>
            <small>Eklenenler ürün fotoğraflarının sonuna gider; kapak değişmez.</small>
          </label>
          <label className="pf-field">
            Model (isteğe bağlı)
            <input className="form-input" type="text" value={draft.model ?? ''} placeholder={chosenProvider?.defaultModel ?? 'Varsayılan'} onChange={(e) => patch({ model: e.target.value || undefined })} />
          </label>
        </div>

        <div className="pf-actions">
          <button type="button" className="btn btn-primary btn-sm adm-btn-icon-label" onClick={saveSettings} disabled={!dirty || busy === 'settings'}>
            <IconCheck size={16} /> {busy === 'settings' ? 'Kaydediliyor…' : 'Ayarları kaydet'}
          </button>
          {dirty && <span className="pf-sub">Kaydedilmemiş değişiklik var.</span>}
        </div>
      </section>

      {/* (c) Elle üret */}
      <section className="card pf-panel" ref={manualRef}>
        <h2>Elle üret</h2>
        <p className="pf-hint">Ürünü ve sahneleri seçin; iş kuyruğa eklenir ve hemen çalıştırılır (birkaç dakika sürebilir, sayfadan ayrılmayın).</p>
        <div className="pf-manual">
          <div>
            <label className="pf-field">
              Ürün ara
              <input className="form-input" type="search" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Ürün adı" />
            </label>
            <label className="pf-field" style={{ marginTop: 10 }}>
              Ürün
              <select className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Ürün seçin…</option>
                {picked && !filtered.some((p) => p.id === picked.id) && <option value={picked.id}>{picked.title}</option>}
                {filtered.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} ({p.imageCount} foto)</option>
                ))}
              </select>
            </label>
          </div>
          {picked ? <img className="pf-manual-thumb" src={cloudinaryThumb(picked.cover)} alt={picked.title} /> : <div className="pf-manual-thumb" aria-hidden />}
        </div>

        <span className="pf-label">Sahneler</span>
        <div className="pf-scenes">
          {scenes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pf-chip ${manualScenes.includes(s.id) ? 'on' : ''}`}
              aria-pressed={manualScenes.includes(s.id)}
              onClick={() => setManualScenes((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : cur.length >= 8 ? cur : [...cur, s.id]))}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="pf-actions">
          <button type="button" className="btn btn-primary btn-sm adm-btn-icon-label" onClick={generate} disabled={!!busy || !productId || noProvider}>
            <IconSparkles size={16} /> {busy === 'manual' ? 'Üretiliyor…' : 'Kuyruğa ekle ve çalıştır'}
          </button>
          <span className="pf-sub">{manualScenes.length} sahne seçili</span>
        </div>
      </section>

      {/* (d) İşler */}
      <section>
        <h2 className="adm-page-title" style={{ fontSize: '1.1rem', margin: '4px 0 12px' }}>İşler</h2>
        {jobs.length === 0 && (
          <div className="card pf-panel"><div className="pf-empty">Henüz iş yok. Yukarıdan bir ürün seçip üretim başlatın.</div></div>
        )}
        {jobs.map((j) => {
          const pending = j.results.filter((r) => r.status === 'pending');
          const sel = pending.filter((r) => selected.has(keyOf(j.id, r.sceneId))).map((r) => r.sceneId);
          const resultOf = (sceneId: string): PhotoResult | undefined => j.results.find((r) => r.sceneId === sceneId);
          const hasFailed = j.results.some((r) => r.status === 'failed') || j.status === 'failed';
          const live = busy?.endsWith(j.id);
          return (
            <article key={j.id} className={`card pf-job ${j.productId === queryProductId ? 'hl' : ''}`}>
              <div className="pf-job-head">
                <div style={{ minWidth: 0 }}>
                  <h3>{j.productTitle || j.productId}</h3>
                  <div className="pf-meta">{fmtDate(j.createdAt)} · {j.provider}{j.model ? ` · ${j.model}` : ''}{j.attempts > 1 ? ` · ${j.attempts}. deneme` : ''}</div>
                </div>
                <div className="pf-job-tools">
                  <span className={`pf-pill ${j.status === 'done' ? 'ok' : j.status === 'failed' ? 'warn' : ''}`}>{JOB_STATUS_LABEL[j.status]}</span>
                  {j.status === 'queued' && (
                    <button type="button" className="btn btn-secondary btn-sm adm-btn-icon-label" onClick={() => runJob(j)} disabled={!!busy}>
                      <IconSparkles size={16} /> {busy === `run:${j.id}` ? 'Çalışıyor…' : 'Şimdi çalıştır'}
                    </button>
                  )}
                  {!isOpenStatus(j.status) && hasFailed && (
                    <button type="button" className="btn btn-secondary btn-sm adm-btn-icon-label" onClick={() => retryJob(j)} disabled={!!busy}>
                      <IconRefresh size={16} /> {busy === `retry:${j.id}` ? 'Deneniyor…' : 'Yeniden dene'}
                    </button>
                  )}
                  <button type="button" className="adm-icon-btn" aria-label="İşi sil" title="İşi sil" onClick={() => removeJob(j)} disabled={!!busy}>
                    <IconTrash size={18} />
                  </button>
                </div>
              </div>

              <div className="pf-refs">
                <IconCamera size={16} /> Referans:
                {j.referenceIds.map((id) => (
                  <a key={id} href={cloudinaryUrl(id)} target="_blank" rel="noopener noreferrer">
                    <img className="pf-ref" src={cloudinaryThumb(id)} alt="Referans ürün fotoğrafı" loading="lazy" />
                  </a>
                ))}
              </div>

              {j.error && (
                <p className="pf-err"><IconAlert size={16} /> <span>{j.error}</span></p>
              )}

              {pending.length > 0 && (
                <div className="pf-bar">
                  <button type="button" className="btn btn-primary btn-sm adm-btn-icon-label" onClick={() => approve(j, sel.length ? sel : pending.map((r) => r.sceneId))} disabled={!!busy}>
                    <IconCheck size={16} /> {sel.length ? `Seçilenleri onayla (${sel.length})` : `Tümünü onayla (${pending.length})`}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm adm-btn-icon-label" onClick={() => reject(j, sel.length ? sel : pending.map((r) => r.sceneId))} disabled={!!busy}>
                    <IconClose size={16} /> {sel.length ? `Seçilenleri reddet (${sel.length})` : `Tümünü reddet (${pending.length})`}
                  </button>
                </div>
              )}

              <div className="pf-results" aria-busy={!!live}>
                {j.scenes.map((sid) => {
                  const r = resultOf(sid);
                  const k = keyOf(j.id, sid);
                  if (r && r.publicId && r.status !== 'rejected') {
                    return (
                      <div key={sid} className={`pf-res ${selected.has(k) ? 'sel' : ''}`}>
                        <div className="pf-res-img">
                          <a href={cloudinaryUrl(r.publicId, 'f_auto,q_auto,w_1800,c_limit')} target="_blank" rel="noopener noreferrer" aria-label={`${sceneLabel(sid)} görselini büyüt`}>
                            <img src={cloudinaryThumb(r.publicId)} alt={`${j.productTitle} — ${sceneLabel(sid)}`} loading="lazy" />
                          </a>
                          {r.status === 'pending' && (
                            <label className="pf-res-pick">
                              <input type="checkbox" checked={selected.has(k)} onChange={() => toggleSel(k)} aria-label={`${sceneLabel(sid)} seç`} />
                            </label>
                          )}
                        </div>
                        <div className="pf-res-foot">
                          <b>{sceneLabel(sid)}</b>
                          <small>{RESULT_STATUS_LABEL[r.status]}</small>
                          {r.status === 'pending' && (
                            <div className="pf-res-btns">
                              <button type="button" className="btn btn-primary btn-sm" aria-label="Onayla" title="Onayla" onClick={() => approve(j, [sid])} disabled={!!busy}><IconCheck size={16} /></button>
                              <button type="button" className="btn btn-danger btn-sm" aria-label="Reddet" title="Reddet" onClick={() => reject(j, [sid])} disabled={!!busy}><IconClose size={16} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={sid} className="pf-res">
                      <div className={`pf-res-empty ${r?.status === 'failed' ? 'bad' : ''}`}>
                        {r?.status === 'failed' ? r.error || 'Hata' : r?.status === 'rejected' ? 'Reddedildi' : j.status === 'running' ? 'Üretiliyor…' : 'Bekliyor'}
                      </div>
                      <div className="pf-res-foot"><b>{sceneLabel(sid)}</b></div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
      {dialog}
    </div>
  );
}

export default function PhotoAutoPage() {
  return (
    <Suspense fallback={null}>
      <PhotoAutoContent />
    </Suspense>
  );
}
