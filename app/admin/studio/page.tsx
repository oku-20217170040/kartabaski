'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getStudioDataAction,
  saveStudioSettingsAction,
  generateDraftAction,
  approveDraftsAction,
  rejectDraftsAction,
  revertPhotoAction,
  purgeOriginalsAction,
} from '@/lib/actions-studio';
import type { PhotoroomEnv, StudioDraft, StudioOverviewData, StudioProduct } from '@/lib/studio-types';
import { STUDIO_SCENES, MODE_LABEL, getScene, sceneToOptions, DEFAULT_SCENE_ID } from '@/lib/studio-scenes';
import { isRemoteId } from '@/lib/studio-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconAlert, IconCamera, IconCheck, IconClose, IconCog, IconRefresh, IconSparkles, IconTrash, IconClock, IconSearch } from '@/components/admin/icons';
import './studio.css';

type Tab = 'generate' | 'pending' | 'history';

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const thumb = (id: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_240,h_240,q_auto,f_auto/${id}`;
const pairThumb = (id: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_400,h_300,q_auto,f_auto/${id}`;
const huge = (id: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/c_limit,w_1800,q_auto,f_auto/${id}`;
const usd = (n: number) => `$${n.toFixed(2)}`;
const keyOf = (productId: string, publicId: string) => `${productId}|${publicId}`;
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_LABEL: Record<string, string> = {
  generating: 'Üretiliyor',
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  failed: 'Başarısız',
  reverted: 'Geri alındı',
};

const CUSTOM_SCENE = 'custom';

interface Job { productId: string; publicId: string; title: string }

/** Ürünün fotoğraf bölümleri: kapak + renk varyantları (yalnızca Cloudinary görselleri). */
function variantsOf(p: StudioProduct): { label: string; ids: string[] }[] {
  const out: { label: string; ids: string[] }[] = [];
  const cover = p.images.filter((i) => !isRemoteId(i));
  if (cover.length) out.push({ label: 'Kapak / varsayılan', ids: cover });
  for (const c of p.colors) {
    const ids = c.images.filter((i) => !isRemoteId(i));
    if (ids.length) out.push({ label: `Renk: ${c.name || 'adsız'}`, ids });
  }
  return out;
}
const realIds = (p: StudioProduct) => Array.from(new Set(variantsOf(p).flatMap((v) => v.ids)));

function StudioContent() {
  const params = useSearchParams();
  const highlightId = params.get('productId');
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [data, setData] = useState<StudioOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('generate');
  const [search, setSearch] = useState('');
  const [onlyTodo, setOnlyTodo] = useState(true);

  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());

  // Üretim ayarları (oturum)
  const [sceneId, setSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const [customPrompt, setCustomPrompt] = useState('');
  const [env, setEnv] = useState<PhotoroomEnv>('live');
  const [blur, setBlur] = useState(0.02);
  const [cost, setCost] = useState(0.02);
  const [showSettings, setShowSettings] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const cancelRef = useRef(false);
  const inFlight = useRef<Set<string>>(new Set());
  const [deleteOriginals, setDeleteOriginals] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getStudioDataAction();
      setData(res);
      setEnv(res.settings.activeEnvironment);
      setBlur(res.settings.defaultBlur);
      setCost(res.settings.costPerImageUSD);
      if (!silent) {
        const match = STUDIO_SCENES.find((s) => s.mode === res.settings.defaultMode && (s.prompt === '' || s.prompt === res.settings.defaultPrompt));
        if (match) setSceneId(match.id);
        else if (res.settings.defaultMode === 'studio_staging') {
          setSceneId(CUSTOM_SCENE);
          setCustomPrompt(res.settings.defaultPrompt);
        }
        if (res.drafts.some((d) => d.status === 'pending')) setTab('pending');
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Veriler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Seçili sahneden üretim seçenekleri */
  const genOptions = useCallback(() => {
    if (sceneId === CUSTOM_SCENE) {
      return { mode: 'studio_staging' as const, prompt: customPrompt.trim() || undefined, blurRadius: blur, environment: env, sceneId: CUSTOM_SCENE };
    }
    const sc = getScene(sceneId) ?? STUDIO_SCENES[0];
    return { ...sceneToOptions(sc), blurRadius: blur, environment: env };
  }, [sceneId, customPrompt, blur, env]);

  const pendingDrafts = useMemo(() => (data?.drafts || []).filter((d) => d.status === 'pending'), [data]);
  const approvableDrafts = useMemo(() => pendingDrafts.filter((d) => d.environment !== 'sandbox'), [pendingDrafts]);
  const approvableSet = useMemo(() => new Set(approvableDrafts.map((d) => d.id)), [approvableDrafts]);
  const sandboxDrafts = useMemo(() => pendingDrafts.filter((d) => d.environment === 'sandbox'), [pendingDrafts]);

  const pendingGroups = useMemo(() => {
    const order = new Map((data?.products || []).map((p) => [p.id, realIds(p)]));
    const m = new Map<string, { productId: string; title: string; drafts: StudioDraft[] }>();
    for (const d of pendingDrafts) {
      const g = m.get(d.productId) ?? { productId: d.productId, title: d.productTitle, drafts: [] };
      g.drafts.push(d);
      m.set(d.productId, g);
    }
    return Array.from(m.values()).map((g) => {
      const imgs = order.get(g.productId) || [];
      const pos = (d: StudioDraft) => { const i = imgs.indexOf(d.originalPublicId); return i === -1 ? 999 : i; };
      return { ...g, drafts: [...g.drafts].sort((a, b) => pos(a) - pos(b)) };
    });
  }, [pendingDrafts, data]);

  // Büyütme (lightbox)
  const [lightbox, setLightbox] = useState<{ productId: string; idx: number } | null>(null);
  const [lbZoom, setLbZoom] = useState(false);
  const lbGroup = lightbox ? pendingGroups.find((g) => g.productId === lightbox.productId) : undefined;
  const lbIdx = lightbox && lbGroup ? Math.min(lightbox.idx, lbGroup.drafts.length - 1) : 0;
  const lbCount = lbGroup?.drafts.length ?? 0;

  useEffect(() => {
    if (!lightbox) return;
    if (!lbCount) { setLightbox(null); return; }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') { setLbZoom(false); setLightbox((l) => l && { ...l, idx: Math.min(l.idx + 1, lbCount - 1) }); }
      else if (e.key === 'ArrowLeft') { setLbZoom(false); setLightbox((l) => l && { ...l, idx: Math.max(l.idx - 1, 0) }); }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox, lbCount]);

  const pendingKeys = useMemo(() => new Set(pendingDrafts.map((d) => keyOf(d.productId, d.originalPublicId))), [pendingDrafts]);

  const products = useMemo(() => {
    if (!data) return [] as StudioProduct[];
    let list = data.products.filter((p) => p.active && realIds(p).length > 0);
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (q) list = list.filter((p) => p.title.toLocaleLowerCase('tr-TR').includes(q));
    if (onlyTodo) {
      list = list.filter((p) => {
        const done = new Set(p.studioPhotos.map((x) => x.publicId));
        return realIds(p).some((i) => !done.has(i));
      });
    }
    if (highlightId) list = [...list].sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0));
    return list;
  }, [data, search, onlyTodo, highlightId]);

  /** Üretilebilir fotoğraflar (stüdyosuz + bekleyen taslağı olmayan) */
  const todoPhotos = useCallback((p: StudioProduct): string[] => {
    const done = new Set(p.studioPhotos.map((x) => x.publicId));
    return realIds(p).filter((i) => !done.has(i) && !pendingKeys.has(keyOf(p.id, i)));
  }, [pendingKeys]);

  const photoStats = useMemo(() => {
    let total = 0, done = 0;
    for (const p of data?.products || []) {
      if (!p.active) continue;
      const real = realIds(p);
      const d = new Set(p.studioPhotos.map((x) => x.publicId));
      total += real.length;
      done += real.filter((i) => d.has(i)).length;
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [data]);

  const toggle = (set: Set<string>, key: string) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  };

  const toggleProduct = (p: StudioProduct) => {
    const photos = todoPhotos(p).map((i) => keyOf(p.id, i));
    const all = photos.length > 0 && photos.every((k) => selectedPhotos.has(k));
    const n = new Set(selectedPhotos);
    photos.forEach((k) => (all ? n.delete(k) : n.add(k)));
    setSelectedPhotos(n);
  };

  const allTodoJobs = useMemo<Job[]>(
    () => products.flatMap((p) => todoPhotos(p).map((i) => ({ productId: p.id, publicId: i, title: p.title }))),
    [products, todoPhotos]
  );
  const selectedJobs = useMemo<Job[]>(
    () => allTodoJobs.filter((j) => selectedPhotos.has(keyOf(j.productId, j.publicId))),
    [allTodoJobs, selectedPhotos]
  );

  /** Seri (2 paralel) üretim: her çağrı kısa → sunucu zaman aşımı olmaz, hata durumunda diğerleri devam eder. */
  const runJobs = async (jobs: Job[], label: string) => {
    if (busy || !jobs.length) return;
    const est = env === 'live' ? ` Tahmini maliyet: ${usd(jobs.length * cost)}.` : ' (Sandbox: filigranlı, onaylanamaz.)';
    const ok = await confirm({
      title: 'Üretim başlatılsın mı?',
      message: `${jobs.length} fotoğraf üretilecek (${label}).${est}`,
      confirmLabel: 'Üret',
    });
    if (!ok) return;

    setBusy(true);
    cancelRef.current = false;
    let done = 0, failed = 0;
    const errors: string[] = [];
    setProgress({ done: 0, total: jobs.length, failed: 0 });
    const opts = genOptions();

    const queue = [...jobs];
    const worker = async () => {
      while (queue.length && !cancelRef.current) {
        const job = queue.shift()!;
        const k = keyOf(job.productId, job.publicId);
        if (inFlight.current.has(k)) continue;
        inFlight.current.add(k);
        try {
          const res = await generateDraftAction(job.productId, job.publicId, opts);
          if (!res.ok) { failed++; errors.push(`${job.title}: ${res.error}`); }
        } catch (e) {
          failed++; errors.push(`${job.title}: ${errorMessage(e, 'hata')}`);
        } finally {
          inFlight.current.delete(k);
          done++;
          setProgress({ done, total: jobs.length, failed });
        }
      }
    };
    await Promise.all([worker(), worker()]);

    setBusy(false);
    setProgress(null);
    setSelectedPhotos(new Set());
    await load(true);
    if (failed) toast.error(`${failed} fotoğraf üretilemedi (Geçmiş sekmesinde görünür): ${errors.slice(0, 3).join(' | ')}`);
    if (done - failed > 0) {
      toast.success(`${done - failed} taslak hazır${cancelRef.current ? ' (durduruldu)' : ''}. Onay Bekleyenler sekmesinden kıyaslayıp onaylayın.`);
      setTab('pending');
    }
  };

  const handleDecision = async (kind: 'approve' | 'reject', rawIds: string[]) => {
    const ids = kind === 'approve' ? rawIds.filter((id) => approvableSet.has(id)) : rawIds;
    if (busy) return;
    if (!ids.length) {
      if (kind === 'approve' && rawIds.length) toast.error('Seçilen taslaklar sandbox (filigranlı); yayınlanamaz. Live ortamda yeniden üretin.');
      return;
    }
    if (kind === 'approve' && deleteOriginals) {
      const ok = await confirm({
        title: 'Orijinaller silinsin mi?',
        message: `${ids.length} fotoğrafın ORİJİNALLERİ Cloudinary'den kalıcı silinecek, geri dönüş olmayacak.`,
        confirmLabel: 'Onayla ve sil',
        danger: true,
      });
      if (!ok) return;
    }
    if (kind === 'reject') {
      const ok = await confirm({
        title: 'Taslaklar silinsin mi?',
        message: `${ids.length} taslak silinecek. Sitedeki fotoğraflara dokunulmaz.`,
        confirmLabel: 'Sil',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = kind === 'approve' ? await approveDraftsAction(ids, deleteOriginals) : await rejectDraftsAction(ids);
      const bad = res.results.filter((r) => !r.ok);
      const okN = res.results.length - bad.length;
      if (okN) {
        toast.success(kind === 'approve'
          ? `${okN} fotoğraf sitede yayınlandı${deleteOriginals ? ' (orijinaller silindi)' : ' (orijinaller saklandı)'}.`
          : `${okN} taslak silindi.`);
      }
      if (bad.length) toast.error(`${bad.length} işlem başarısız: ${bad.slice(0, 3).map((b) => b.error).join(' | ')}`);
      setSelectedDrafts(new Set());
      await load(true);
    } catch (e) {
      toast.error(errorMessage(e, 'İşlem başarısız.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async (p: StudioProduct, publicId: string) => {
    if (busy) return;
    const ok = await confirm({
      title: 'Orijinale dönülsün mü?',
      message: 'Bu fotoğraf orijinaline döndürülecek ve stüdyo görseli silinecek.',
      confirmLabel: 'Orijinale dön',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await revertPhotoAction(p.id, publicId);
      if (res.ok) toast.success('Orijinal fotoğraf geri yüklendi.'); else toast.error(res.error || 'Geri alınamadı.');
    } catch (e) {
      toast.error(errorMessage(e, 'Geri alınamadı.'));
    }
    await load(true);
    setBusy(false);
  };

  const preservedOriginals = useMemo(
    () => (data?.products || []).reduce((n, p) => n + p.studioPhotos.filter((x) => !x.originalPurged).length, 0),
    [data]
  );

  const handlePurge = async () => {
    if (busy || !preservedOriginals) return;
    const ok = await confirm({
      title: 'Orijinaller kalıcı silinsin mi?',
      message: `Onaylanmış ${preservedOriginals} fotoğrafın orijinali Cloudinary'den KALICI silinecek. Bunlar için "Orijinale dön" artık çalışmaz.`,
      confirmLabel: 'Kalıcı sil',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await purgeOriginalsAction();
      if (res.ok) toast.success(`${res.purged} orijinal fotoğraf silindi.`); else toast.error(res.error || 'Silinemedi.');
    } catch (e) {
      toast.error(errorMessage(e, 'Silinemedi.'));
    }
    await load(true);
    setBusy(false);
  };

  const saveSettings = async () => {
    const opts = genOptions();
    try {
      const res = await saveStudioSettingsAction({
        activeEnvironment: env,
        defaultMode: opts.mode,
        ...(opts.prompt ? { defaultPrompt: opts.prompt } : {}),
        defaultBlur: blur,
        costPerImageUSD: cost,
      });
      if (res.ok) {
        toast.success('Stüdyo ayarları kaydedildi.');
        setShowSettings(false);
        await load(true);
      } else {
        toast.error(res.error || 'Kaydedilemedi.');
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Kaydedilemedi.'));
    }
  };

  if (loading) {
    return (
      <div className="studio-loading">
        <div className="spinner" />
        <p>AI Stüdyo yükleniyor…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="studio-page">
        <div className="studio-warn"><IconAlert size={18} /><span>Veriler yüklenemedi.</span></div>
        <button className="btn btn-secondary" onClick={() => load(false)}>Tekrar dene</button>
      </div>
    );
  }

  const stats = data.stats;
  const keys = data.keys;
  const productById = new Map(data.products.map((p) => [p.id, p]));
  const activeScene = sceneId === CUSTOM_SCENE ? null : getScene(sceneId);
  const sceneName = sceneId === CUSTOM_SCENE ? 'Özel tarif' : activeScene?.label ?? '';
  const sceneLabelOf = (d: StudioDraft) => (d.sceneId === CUSTOM_SCENE ? 'Özel tarif' : getScene(d.sceneId)?.label ?? MODE_LABEL[d.mode]);

  return (
    <div className="studio-page">
      <div className="studio-head">
        <div>
          <h1 className="adm-page-title">AI Stüdyo</h1>
          <p className="adm-page-sub">
            Kupa fotoğraflarını hazır sahnelerle yenileyin. Onay verene kadar orijinal ve yeni görsel birlikte durur, site değişmez.
          </p>
        </div>
        <div className="studio-head-tools">
          <span className={`studio-pill ${keys.live ? 'ok' : 'warn'}`}>{keys.live ? 'Live anahtar var' : 'Live anahtar yok'}</span>
          <span className={`studio-pill ${keys.sandbox ? 'ok' : ''}`}>{keys.sandbox ? 'Sandbox anahtar var' : 'Sandbox yok'}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings((v) => !v)}><IconCog size={16} /> Ayarlar</button>
          <button className="btn btn-secondary btn-sm" onClick={() => load(false)} aria-label="Yenile"><IconRefresh size={16} /></button>
        </div>
      </div>

      {data.warnings.map((w, i) => (
        <div key={i} className="studio-warn"><IconAlert size={18} /><span>{w}</span></div>
      ))}

      {showSettings && (
        <div className="card studio-panel">
          <h2>Stüdyo ayarları</h2>
          <p className="studio-hint">
            API anahtarları güvenlik için buradan girilmez; sunucu ortam değişkenlerinde tutulur. Varsayılan sahne, aşağıda seçili sahneden alınır.
          </p>
          <div className="studio-grid">
            <label className="studio-field">Ortam
              <select className="form-select" value={env} onChange={(e) => setEnv(e.target.value as PhotoroomEnv)}>
                <option value="live">Live (filigransız, ücretli)</option>
                <option value="sandbox">Sandbox (filigranlı, yayınlanamaz)</option>
              </select>
            </label>
            <label className="studio-field">Görsel başı maliyet (USD)
              <input className="form-input" type="number" step="0.005" min="0" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </label>
            {(activeScene?.mode === 'bokeh') && (
              <label className="studio-field">Bokeh gücü ({blur})
                <input type="range" min="0.005" max="0.05" step="0.005" value={blur} onChange={(e) => setBlur(Number(e.target.value))} />
              </label>
            )}
          </div>
          <div className="studio-keys">
            <div className="studio-key">
              <strong>Live anahtar</strong>
              <span className={`studio-pill ${keys.live ? 'ok' : 'warn'}`}>{keys.live ? 'Tanımlı' : 'Tanımlı değil'}</span>
              <code>PHOTOROOM_LIVE_API_KEY</code>
            </div>
            <div className="studio-key">
              <strong>Sandbox anahtar</strong>
              <span className={`studio-pill ${keys.sandbox ? 'ok' : 'warn'}`}>{keys.sandbox ? 'Tanımlı' : 'Tanımlı değil'}</span>
              <code>PHOTOROOM_SANDBOX_API_KEY</code>
            </div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn btn-primary btn-sm" onClick={saveSettings}>Kaydet</button></div>
        </div>
      )}

      <div className="adm-stat-grid">
        <div className="adm-stat"><div className="adm-stat-value">{stats.generatedThisMonth} · {usd(stats.costThisMonthUSD)}</div><div className="adm-stat-label">Bu ay üretim / maliyet (toplam {stats.generatedTotal} · {usd(stats.costTotalUSD)})</div></div>
        <div className="adm-stat"><div className="adm-stat-value">%{photoStats.pct} ({photoStats.done}/{photoStats.total})</div><div className="adm-stat-label">Stüdyo tamamlanma (kapak + renk fotoğrafları)</div></div>
        <div className="adm-stat"><div className="adm-stat-value">{pendingDrafts.length}</div><div className="adm-stat-label">Onay bekleyen (saklanan orijinal: {preservedOriginals})</div></div>
        <div className="adm-stat"><div className="adm-stat-value">{stats.failedTotal}</div><div className="adm-stat-label">Başarısız üretim (nedenleri Geçmiş sekmesinde)</div></div>
      </div>

      <div className="studio-toolbar">
        <div className="studio-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'generate'} className={tab === 'generate' ? 'on' : ''} onClick={() => setTab('generate')}>Üret</button>
          <button role="tab" aria-selected={tab === 'pending'} className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Onay bekleyenler ({pendingDrafts.length})</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Geçmiş ve maliyet</button>
        </div>
        {tab === 'generate' && (
          <div className="studio-filters">
            <label className="studio-check"><input type="checkbox" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} /> Yalnızca yapılacaklar</label>
            <input className="form-input" placeholder="Ürün ara…" aria-label="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      {/* ÜRET */}
      {tab === 'generate' && (
        <>
          <div className="card studio-panel">
            <h2><span><IconSparkles size={18} /> Sahne seçin</span><span className={`studio-pill ${env === 'live' ? 'ok' : 'warn'}`}>{env === 'live' ? 'Live' : 'Sandbox'}</span></h2>
            <div className="studio-scenes">
              {STUDIO_SCENES.map((s) => (
                <button key={s.id} type="button" className={`studio-scene${sceneId === s.id ? ' on' : ''}`} disabled={busy} onClick={() => setSceneId(s.id)} aria-pressed={sceneId === s.id}>
                  <b>{s.label}</b>
                  <span>{s.hint}</span>
                </button>
              ))}
              <button type="button" className={`studio-scene${sceneId === CUSTOM_SCENE ? ' on' : ''}`} disabled={busy} onClick={() => setSceneId(CUSTOM_SCENE)} aria-pressed={sceneId === CUSTOM_SCENE}>
                <b>Özel tarif</b>
                <span>Kendi arka plan tarifinizi (İngilizce) yazın</span>
              </button>
            </div>
            {sceneId === CUSTOM_SCENE && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="studio-custom">Arka plan tarifi (İngilizce)</label>
                <input id="studio-custom" className="form-input" value={customPrompt} maxLength={300} placeholder="örn. cozy autumn table with cinnamon sticks and warm light" onChange={(e) => setCustomPrompt(e.target.value)} />
              </div>
            )}
          </div>

          <div className="card studio-bar">
            <button className="btn btn-primary btn-sm" disabled={busy || !selectedJobs.length} onClick={() => runJobs(selectedJobs, `${sceneName} · seçilenler`)}>
              Seçilenleri üret ({selectedJobs.length})
            </button>
            <button className="btn btn-secondary btn-sm" disabled={busy || !allTodoJobs.length} onClick={() => runJobs(allTodoJobs, `${sceneName} · listelenen tüm fotoğraflar`)}>
              Hepsini üret ({allTodoJobs.length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPhotos(new Set(allTodoJobs.map((j) => keyOf(j.productId, j.publicId))))} disabled={busy}>Tümünü seç</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPhotos(new Set())} disabled={busy}>Temizle</button>
            {progress && (
              <span className="studio-bar-end">
                {progress.done}/{progress.total} (hata: {progress.failed})
                <button className="btn btn-secondary btn-sm" onClick={() => { cancelRef.current = true; }}>Durdur</button>
              </span>
            )}
          </div>

          {products.length === 0 && <div className="card studio-empty">Gösterilecek ürün yok.</div>}
          {products.map((p) => {
            const todo = todoPhotos(p);
            const allSel = todo.length > 0 && todo.every((i) => selectedPhotos.has(keyOf(p.id, i)));
            const doneMap = new Map(p.studioPhotos.map((x) => [x.publicId, x]));
            return (
              <div key={p.id} className={`card studio-prod${highlightId === p.id ? ' hl' : ''}`}>
                <div className="studio-prod-head">
                  <h3>{p.title} {p.studioEnhanced && <span className="studio-pill ok"><IconCheck size={12} /> Tümü stüdyo</span>}</h3>
                  {todo.length > 0 && (
                    <label className="studio-check">
                      <input type="checkbox" checked={allSel} onChange={() => toggleProduct(p)} /> {todo.length} fotoğrafı seç
                    </label>
                  )}
                </div>
                {variantsOf(p).map((v) => (
                  <div key={v.label} className="studio-variant">
                    <div className="studio-variant-name">{v.label}</div>
                    <div className="studio-photos">
                      {v.ids.map((id) => {
                        const done = doneMap.get(id);
                        const pend = pendingKeys.has(keyOf(p.id, id));
                        const k = keyOf(p.id, id);
                        return (
                          <div key={`${v.label}|${id}`} className="studio-photo">
                            <div className={`studio-photo-img${selectedPhotos.has(k) ? ' sel' : ''}`}>
                              <img src={thumb(id)} alt="" width={120} height={120} loading="lazy" />
                              {!done && !pend && (
                                <label className="studio-photo-check" aria-label="Fotoğrafı seç">
                                  <input type="checkbox" checked={selectedPhotos.has(k)} onChange={() => setSelectedPhotos((s) => toggle(s, k))} />
                                </label>
                              )}
                            </div>
                            {done ? (
                              <>
                                <span className="studio-pill ok"><IconCheck size={12} /> Stüdyo</span>
                                <button className="btn btn-secondary btn-sm" disabled={busy || !!done.originalPurged} onClick={() => handleRevert(p, id)}
                                  title={done.originalPurged ? 'Orijinal silinmiş' : 'Orijinale dön'}>Orijinale dön</button>
                              </>
                            ) : pend ? <span className="studio-pill warn"><IconClock size={12} /> Onay bekliyor</span>
                              : (
                                <button className="btn btn-secondary btn-sm" disabled={busy}
                                  onClick={() => runJobs([{ productId: p.id, publicId: id, title: p.title }], `${sceneName} · tek fotoğraf`)}>Bunu üret</button>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* ONAY BEKLEYENLER */}
      {tab === 'pending' && (
        <>
          <div className="card studio-bar">
            <button className="btn btn-primary btn-sm" disabled={busy || !selectedDrafts.size} onClick={() => handleDecision('approve', Array.from(selectedDrafts))}><IconCheck size={16} /> Seçilenleri onayla ({Array.from(selectedDrafts).filter((id) => approvableSet.has(id)).length})</button>
            <button className="btn btn-secondary btn-sm" disabled={busy || !approvableDrafts.length} onClick={() => handleDecision('approve', approvableDrafts.map((d) => d.id))}>Hepsini onayla ({approvableDrafts.length})</button>
            <button className="btn btn-danger btn-sm" disabled={busy || !selectedDrafts.size} onClick={() => handleDecision('reject', Array.from(selectedDrafts))}><IconClose size={16} /> Seçilenleri reddet ({selectedDrafts.size})</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDrafts(new Set(pendingDrafts.map((d) => d.id)))}>Tümünü seç</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDrafts(new Set())}>Temizle</button>
            {sandboxDrafts.length > 0 && (
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDecision('reject', sandboxDrafts.map((d) => d.id))}><IconTrash size={16} /> Sandbox taslaklarını sil ({sandboxDrafts.length})</button>
            )}
            <label className="studio-check studio-bar-end">
              <input type="checkbox" checked={deleteOriginals} onChange={(e) => setDeleteOriginals(e.target.checked)} /> Onaylananların orijinallerini Cloudinary&apos;den sil
            </label>
          </div>
          {pendingDrafts.length === 0 && <div className="card studio-empty">Onay bekleyen taslak yok.</div>}
          {sandboxDrafts.length > 0 && (
            <div className="studio-warn"><IconAlert size={18} /><span>{sandboxDrafts.length} taslak sandbox (filigranlı) ortamda üretildi ve yayınlanamaz. Live ortamda yeniden üretin veya &quot;Sandbox taslaklarını sil&quot; ile temizleyin.</span></div>
          )}
          <div className="studio-groups">
            {pendingGroups.map((g) => {
              const ids = g.drafts.map((d) => d.id);
              const allSel = ids.every((id) => selectedDrafts.has(id));
              const okIds = ids.filter((id) => approvableSet.has(id));
              const sbN = g.drafts.length - okIds.length;
              return (
                <div key={g.productId} className="card studio-group">
                  <div className="studio-group-head">
                    <label>
                      <input type="checkbox" checked={allSel} onChange={() => setSelectedDrafts((s) => {
                        const n = new Set(s);
                        ids.forEach((id) => (allSel ? n.delete(id) : n.add(id)));
                        return n;
                      })} />
                      <b>{g.title}</b>
                    </label>
                    <span className="studio-pill">{g.drafts.length} fotoğraf</span>
                    {sbN > 0 && <span className="studio-pill warn">{sbN} sandbox</span>}
                  </div>
                  <div className="studio-pairs">
                    {g.drafts.map((d, i) => (
                      <div key={d.id} className={`studio-pair${selectedDrafts.has(d.id) ? ' sel' : ''}`}>
                        <button type="button" className="studio-pair-imgs" onClick={() => { setLbZoom(false); setLightbox({ productId: g.productId, idx: i }); }} aria-label={`${g.title} ${i + 1}. fotoğrafı büyüt`}>
                          <span className="studio-tag">Orijinal</span>
                          <img src={pairThumb(d.originalPublicId)} alt="Orijinal" loading="lazy" />
                          <span className="studio-tag right">Stüdyo</span>
                          {d.draftPublicId && <img src={pairThumb(d.draftPublicId)} alt="Stüdyo taslağı" loading="lazy" />}
                          <span className="studio-zoom"><IconSearch size={12} /> Büyüt</span>
                        </button>
                        <div className="studio-pair-foot">
                          <label><input type="checkbox" checked={selectedDrafts.has(d.id)} onChange={() => setSelectedDrafts((s) => toggle(s, d.id))} /> {i + 1}. foto{d.environment === 'sandbox' ? ' · sandbox' : ''}</label>
                          <div className="studio-pair-btns">
                            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleDecision('reject', [d.id])} aria-label="Reddet"><IconClose size={16} /></button>
                            <button className="btn btn-primary btn-sm" disabled={busy || d.environment === 'sandbox'} onClick={() => handleDecision('approve', [d.id])} aria-label="Onayla" title={d.environment === 'sandbox' ? 'Sandbox taslak yayınlanamaz' : 'Onayla'}><IconCheck size={16} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="studio-group-actions">
                    <span className="studio-group-meta">{sceneLabelOf(g.drafts[0])} · {fmtDate(g.drafts[0].createdAt)}</span>
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleDecision('reject', ids)}>Hepsini reddet</button>
                    <button className="btn btn-primary btn-sm" disabled={busy || !okIds.length} onClick={() => handleDecision('approve', okIds)}>Hepsini onayla ({okIds.length})</button>
                  </div>
                </div>
              );
            })}
          </div>

          {lightbox && lbGroup && lbGroup.drafts[lbIdx] && (() => {
            const d = lbGroup.drafts[lbIdx];
            return (
              <div className="studio-lb" role="dialog" aria-modal="true" aria-label="Fotoğraf karşılaştırma" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
                <div className="studio-lb-head">
                  <div>
                    <strong>{lbGroup.title}</strong>
                    <span> · {lbIdx + 1} / {lbCount}{d.environment === 'sandbox' ? ' · sandbox' : ''}</span>
                  </div>
                  <div className="studio-lb-tools">
                    <button className="btn btn-secondary btn-sm" onClick={() => setLbZoom((z) => !z)}>{lbZoom ? 'Sığdır' : 'Gerçek boyut'}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setLightbox(null)} aria-label="Kapat"><IconClose size={16} /> Kapat</button>
                  </div>
                </div>
                <div className={`studio-lb-body${lbZoom ? ' zoomed' : ''}`}>
                  <figure>
                    <img src={huge(d.originalPublicId)} alt="Orijinal" onClick={() => setLbZoom((z) => !z)} />
                    <figcaption>Orijinal (sitede)</figcaption>
                  </figure>
                  <figure>
                    {d.draftPublicId && <img src={huge(d.draftPublicId)} alt="Stüdyo taslağı" onClick={() => setLbZoom((z) => !z)} />}
                    <figcaption>Stüdyo taslağı</figcaption>
                  </figure>
                </div>
                <div className="studio-lb-foot">
                  <button className="btn btn-secondary btn-sm" disabled={lbIdx === 0} onClick={() => { setLbZoom(false); setLightbox({ ...lightbox, idx: lbIdx - 1 }); }}>Önceki</button>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleDecision('reject', [d.id])}>Reddet</button>
                  <button className="btn btn-primary btn-sm" disabled={busy || d.environment === 'sandbox'} onClick={() => handleDecision('approve', [d.id])}>Onayla</button>
                  <button className="btn btn-secondary btn-sm" disabled={lbIdx >= lbCount - 1} onClick={() => { setLbZoom(false); setLightbox({ ...lightbox, idx: lbIdx + 1 }); }}>Sonraki</button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* GEÇMİŞ */}
      {tab === 'history' && (
        <div className="card studio-panel">
          <h2>
            <span><IconCamera size={18} /> Üretim geçmişi</span>
            <button className="btn btn-danger btn-sm" disabled={busy || !preservedOriginals} onClick={handlePurge}>
              <IconTrash size={16} /> Onaylıların orijinallerini temizle ({preservedOriginals})
            </button>
          </h2>
          <div className="studio-table-wrap">
            <table className="studio-table">
              <thead><tr><th>Tarih</th><th>Ürün</th><th>Sahne</th><th>Ortam</th><th>Durum</th><th className="num">Maliyet</th></tr></thead>
              <tbody>
                {data.drafts.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDate(d.createdAt)}</td>
                    <td>{productById.get(d.productId)?.title || d.productTitle}</td>
                    <td>{sceneLabelOf(d)}</td>
                    <td>{d.environment}</td>
                    <td>
                      <span className={`studio-pill ${d.status === 'approved' ? 'ok' : d.status === 'failed' ? 'warn' : ''}`}>{STATUS_LABEL[d.status] || d.status}</span>
                      {d.error && <div className="studio-err">{d.error}</div>}
                    </td>
                    <td className="num">{usd(d.costUSD || 0)}</td>
                  </tr>
                ))}
                {data.drafts.length === 0 && <tr><td colSpan={6} className="studio-empty">Henüz üretim yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioContent />
    </Suspense>
  );
}
