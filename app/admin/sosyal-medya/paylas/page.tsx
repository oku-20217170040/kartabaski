'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type DragEvent } from 'react';
import Link from 'next/link';
import {
  createAndRunBroadcastAction,
  deleteBroadcastAction,
  getBroadcastPageDataAction,
  previewBroadcastCaptionsAction,
  publishBroadcastNowAction,
  retryBroadcastAction,
  saveBroadcastSettingsAction,
  updateBroadcastAction,
} from '@/lib/actions-social-broadcast';
import {
  ALL_SOCIAL_PLATFORMS,
  BROADCAST_KINDS,
  BROADCAST_KIND_LABELS,
  BROADCAST_STATUS_LABELS,
  type BroadcastKind,
  type BroadcastPageData,
  type BroadcastSettings,
  type BroadcastStatus,
  type BroadcastTargetResult,
  type GeneratedCaptions,
  type SocialBroadcast,
} from '@/lib/social-broadcast-types';
import type { SocialPlatform } from '@/lib/social-types';
import { cloudinaryThumb, cloudinaryUrl } from '@/lib/format';
import { Pill, Switch, fmtWhen, type Tone } from '@/components/admin/social/shared';
import '@/components/admin/social/social.css';
import './paylas.css';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import {
  IconAlert,
  IconCamera,
  IconCheck,
  IconClock,
  IconClose,
  IconEdit,
  IconExternal,
  IconFacebook,
  IconInstagram,
  IconPinterest,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSparkles,
  IconTelegram,
  IconThreads,
  IconTikTok,
  IconTrash,
  IconUpload,
} from '@/components/admin/icons';

interface IconProps {
  size?: number;
}

const PLATFORM_META: Record<SocialPlatform, { name: string; Icon: ComponentType<IconProps> }> = {
  instagram: { name: 'Instagram', Icon: IconInstagram },
  facebook: { name: 'Facebook', Icon: IconFacebook },
  threads: { name: 'Threads', Icon: IconThreads },
  telegram: { name: 'Telegram', Icon: IconTelegram },
  pinterest: { name: 'Pinterest', Icon: IconPinterest },
  tiktok: { name: 'TikTok', Icon: IconTikTok },
};

const MAX_IMAGES = 10;

type PoolTab = 'all' | 'queue' | 'published';

interface EditingState {
  id: string;
  title: string;
  mainCaption: string;
  shortCaption: string;
  platforms: SocialPlatform[];
  status: 'queued' | 'draft';
}

function statusTone(s: BroadcastStatus): Tone {
  if (s === 'done') return 'ok';
  if (s === 'failed' || s === 'partial') return 'err';
  if (s === 'queued' || s === 'publishing') return 'warn';
  return 'muted';
}

function targetPill(res: BroadcastTargetResult | undefined, selected: boolean): { tone: Tone; label: string } {
  if (res) {
    if (res.status === 'posted') return { tone: 'ok', label: 'Paylaşıldı' };
    if (res.status === 'failed') return { tone: 'err', label: 'Başarısız' };
    if (res.status === 'skipped') return { tone: 'muted', label: 'Atlandı' };
    return { tone: 'warn', label: 'Bekliyor' };
  }
  return selected ? { tone: 'warn', label: 'Sırada' } : { tone: 'muted', label: 'Seçilmedi' };
}

export default function SocialBroadcastPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [data, setData] = useState<BroadcastPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Otomatik mod ayar taslağı
  const [settingsDraft, setSettingsDraft] = useState<BroadcastSettings | null>(null);
  const settingsInitRef = useRef(false);

  // Yeni gönderi oluşturucu state'i
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [kind, setKind] = useState<BroadcastKind>('musteri');
  const [note, setNote] = useState('');
  const [studioEnhance, setStudioEnhance] = useState(false);
  const [studioSceneId, setStudioSceneId] = useState('beyaz-fon');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([...ALL_SOCIAL_PLATFORMS]);
  const [instagramStory, setInstagramStory] = useState(true);

  // Metin önizleme & düzenleme
  const [title, setTitle] = useState('');
  const [mainCaption, setMainCaption] = useState('');
  const [shortCaption, setShortCaption] = useState('');
  const [previewLink, setPreviewLink] = useState('');

  // Havuz filtresi ve satır içi düzenleme
  const [poolTab, setPoolTab] = useState<PoolTab>('all');
  const [editing, setEditing] = useState<EditingState | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getBroadcastPageDataAction();
      setData(res);
      setSettingsDraft((cur) => cur ?? res.settings);
      if (!settingsInitRef.current) {
        settingsInitRef.current = true;
        setKind(res.settings.defaultKind);
        setPlatforms(
          res.settings.defaultPlatforms.length > 0 ? res.settings.defaultPlatforms : [...ALL_SOCIAL_PLATFORMS],
        );
        setStudioEnhance(res.studioAvailable && res.settings.defaultStudioEnhance);
        setStudioSceneId(res.settings.defaultStudioSceneId || res.scenes[0]?.id || 'beyaz-fon');
        setInstagramStory(res.settings.defaultInstagramStory);
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Sayfa verileri yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const settingsDirty = useMemo(
    () => !!data && !!settingsDraft && JSON.stringify(data.settings) !== JSON.stringify(settingsDraft),
    [data, settingsDraft],
  );

  const patchSettings = (patch: Partial<BroadcastSettings>) => {
    setSettingsDraft((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  const handleSaveSettings = () =>
    runBusy('settings', async () => {
      if (!settingsDraft) return;
      const clampedQueue = Math.min(3, Math.max(1, Number(settingsDraft.queuePerCycle) || 1));
      const saved = await saveBroadcastSettingsAction({
        ...settingsDraft,
        queuePerCycle: clampedQueue,
        defaultKind: kind,
        defaultPlatforms: platforms,
        defaultStudioEnhance: studioEnhance,
        defaultStudioSceneId: studioSceneId,
        defaultInstagramStory: instagramStory,
      });
      setSettingsDraft(saved);
      toast.success('Varsayılan ayarlar kaydedildi.');
      await load();
    });

  const selectedProduct = useMemo(
    () => data?.products.find((p) => p.id === productId) ?? null,
    [data, productId],
  );

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const q = productSearch.trim().toLocaleLowerCase('tr-TR');
    if (!q) return data.products;
    return data.products.filter(
      (p) =>
        p.title.toLocaleLowerCase('tr-TR').includes(q) ||
        p.category.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [data, productSearch]);

  const buildCustomCaptions = (): Partial<GeneratedCaptions> | undefined => {
    const t = title.trim();
    const m = mainCaption.trim();
    const s = shortCaption.trim();
    if (!t && !m && !s) return undefined;
    return {
      ...(t ? { title: t } : {}),
      ...(m ? { mainCaption: m } : {}),
      ...(s ? { shortCaption: s } : {}),
    };
  };

  const submitBroadcast = async (ids: string[], mode: 'instant' | 'queue' | 'draft', autoTriggered = false) => {
    if (ids.length === 0) {
      toast.error('En az 1 fotoğraf ekleyin.');
      return;
    }
    if (platforms.length === 0) {
      toast.error('En az 1 hedef platform seçin.');
      return;
    }

    const created = await createAndRunBroadcastAction({
      imageIds: ids,
      kind,
      note: note.trim() || undefined,
      productId: productId || undefined,
      platforms,
      instagramStory: platforms.includes('instagram') ? instagramStory : false,
      studioEnhance: data?.studioAvailable ? studioEnhance : false,
      studioSceneId: data?.studioAvailable && studioEnhance ? studioSceneId : undefined,
      customCaptions: buildCustomCaptions(),
      mode,
    });

    if (mode === 'instant') {
      if (created.status === 'done') {
        toast.success(autoTriggered ? 'Fotoğraf yüklendi ve tüm platformlarda yayınlandı.' : 'Gönderi tüm platformlarda yayınlandı.');
      } else if (created.status === 'partial') {
        toast.success('Gönderi kısmen yayınlandı. Detayları havuzdan inceleyin.');
      } else {
        toast.error('Gönderi yayınlanamadı. Hata ayrıntılarını aşağıda görebilirsiniz.');
      }
    } else if (mode === 'queue') {
      toast.success(autoTriggered ? 'Fotoğraf yüklendi ve otomatik paylaşım sırasına eklendi.' : 'Gönderi sıraya eklendi.');
    } else {
      toast.success('Taslak kaydedildi.');
    }

    // Başarılı oluşturma sonrasında form görsellerini ve notu sıfırla
    setImageIds([]);
    setNote('');
    setTitle('');
    setMainCaption('');
    setShortCaption('');
    setPreviewLink('');
    await load();
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((f) => f.size > 0);
    if (incoming.length === 0) return;

    const autoMode = !!settingsDraft?.instantOnUpload;
    const room = autoMode ? MAX_IMAGES : Math.max(0, MAX_IMAGES - imageIds.length);
    if (room === 0) {
      toast.error(`En fazla ${MAX_IMAGES} fotoğraf ekleyebilirsiniz.`);
      return;
    }

    const batch = incoming.slice(0, room);
    if (incoming.length > room) {
      toast.error(`En fazla ${MAX_IMAGES} fotoğraf desteklenir; ilk ${room} dosya yükleniyor.`);
    }

    setBusy('upload');
    setUploadState({ done: 0, total: batch.length });

    const uploadedIds: string[] = [];
    const failedNames: string[] = [];

    try {
      let completed = 0;
      const results = await Promise.all(
        batch.map(async (file) => {
          const form = new FormData();
          form.append('file', file);
          form.append('folder', 'sosyal');
          try {
            const res = await fetch('/api/upload', { method: 'POST', body: form });
            const json = (await res.json().catch(() => ({}))) as { public_id?: string; error?: string };
            if (!res.ok || !json.public_id) {
              throw new Error(json.error || 'Yüklenemedi');
            }
            return { ok: true as const, id: json.public_id };
          } catch (err) {
            return {
              ok: false as const,
              name: file.name,
              reason: err instanceof Error ? err.message : 'Hata',
            };
          } finally {
            completed += 1;
            setUploadState({ done: completed, total: batch.length });
          }
        }),
      );

      for (const r of results) {
        if (r.ok) uploadedIds.push(r.id);
        else failedNames.push(`${r.name}: ${r.reason}`);
      }

      if (failedNames.length > 0) {
        toast.error(`Yüklenemeyen dosya: ${failedNames[0]}`);
      }

      if (uploadedIds.length > 0) {
        if (autoMode && settingsDraft) {
          await submitBroadcast(uploadedIds, settingsDraft.defaultMode, true);
        } else {
          setImageIds((prev) => [...prev, ...uploadedIds].slice(0, MAX_IMAGES));
          toast.success(`${uploadedIds.length} fotoğraf eklendi.`);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Fotoğraf yüklenirken hata oluştu.'));
    } finally {
      setUploadState(null);
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  const handleSelectProduct = (newId: string) => {
    setProductId(newId);
    if (!newId || !data) return;
    const prod = data.products.find((p) => p.id === newId);
    if (!prod || prod.images.length === 0) return;

    setImageIds((prev) => {
      const existing = new Set(prev);
      const added = prod.images.filter((img) => !existing.has(img));
      const merged = [...prev, ...added].slice(0, MAX_IMAGES);
      const diff = merged.length - prev.length;
      if (diff > 0) {
        toast.success(`"${prod.title}" ürününden ${diff} fotoğraf eklendi.`);
      }
      return merged;
    });
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    const next = index + delta;
    if (next < 0 || next >= imageIds.length) return;
    setImageIds((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(next, 0, moved);
      return copy;
    });
  };

  const removeImage = (index: number) => {
    setImageIds((prev) => prev.filter((_, i) => i !== index));
  };

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handlePreviewCaptions = () =>
    runBusy('preview', async () => {
      const generated = await previewBroadcastCaptionsAction({
        kind,
        note: note.trim() || undefined,
        productTitle: selectedProduct?.title,
        productSlug: selectedProduct?.slug,
        productCategory: selectedProduct?.category,
        priceMin: selectedProduct?.priceMin,
        priceMax: selectedProduct?.priceMax,
        seed: String(Date.now()),
      });
      setTitle(generated.title);
      setMainCaption(generated.mainCaption);
      setShortCaption(generated.shortCaption);
      setPreviewLink(generated.linkUrl);
      toast.success('Gönderi metinleri yenilendi.');
    });

  const handleCreate = (mode: 'instant' | 'queue' | 'draft') =>
    runBusy(`create:${mode}`, async () => {
      await submitBroadcast(imageIds, mode, false);
    });

  const handlePublishItem = (item: SocialBroadcast) =>
    runBusy(`pub:${item.id}`, async () => {
      const updated = await publishBroadcastNowAction(item.id);
      if (updated.status === 'done') toast.success('Gönderi yayınlandı.');
      else if (updated.status === 'partial') toast.success('Gönderi kısmen yayınlandı.');
      else toast.error('Gönderi yayınlanamadı.');
      await load();
    });

  const handleRetryItem = (item: SocialBroadcast) =>
    runBusy(`retry:${item.id}`, async () => {
      const updated = await retryBroadcastAction(item.id);
      if (updated.status === 'done') toast.success('Hatalı platformlar tamamlandı.');
      else if (updated.status === 'partial') toast.success('Bazı platformlar yeniden denendi.');
      else toast.error('Yeniden deneme başarısız oldu.');
      await load();
    });

  const handleDeleteItem = async (item: SocialBroadcast) => {
    const ok = await confirm({
      title: 'Gönderiyi sil',
      message: 'Bu gönderi kaydı havuzdan kalıcı olarak silinsin mi?',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await runBusy(`del:${item.id}`, async () => {
      await deleteBroadcastAction(item.id, false);
      toast.success('Gönderi silindi.');
      await load();
    });
  };

  const startEditing = (item: SocialBroadcast) => {
    setEditing({
      id: item.id,
      title: item.captions.title,
      mainCaption: item.captions.mainCaption,
      shortCaption: item.captions.shortCaption,
      platforms: [...item.platforms],
      status: item.status === 'draft' ? 'draft' : 'queued',
    });
  };

  const saveEditing = () =>
    runBusy('edit', async () => {
      if (!editing) return;
      if (editing.platforms.length === 0) {
        toast.error('En az 1 platform seçili olmalıdır.');
        return;
      }
      await updateBroadcastAction(editing.id, {
        captions: {
          title: editing.title.trim(),
          mainCaption: editing.mainCaption.trim(),
          shortCaption: editing.shortCaption.trim(),
        },
        platforms: editing.platforms,
        status: editing.status,
      });
      setEditing(null);
      toast.success('Gönderi güncellendi.');
      await load();
    });

  if (loading || !data || !settingsDraft) {
    return (
      <div className="pay-page">
        <Link href="/admin/sosyal-medya" className="soc-back">
          ← Sosyal Medya Merkezine dön
        </Link>
        <div className="soc-panel" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p className="soc-muted">Hızlı paylaşım verileri yükleniyor…</p>
        </div>
      </div>
    );
  }

  const connectedCount = data.platforms.filter((p) => p.configured).length;
  const queuedCount = data.items.filter((i) => i.status === 'queued').length;
  const publishedCount = data.items.filter((i) => i.status === 'done' || i.status === 'partial').length;

  const visibleItems = data.items.filter((item) => {
    if (poolTab === 'queue') return item.status === 'queued' || item.status === 'draft' || item.status === 'publishing';
    if (poolTab === 'published') return item.status === 'done' || item.status === 'partial' || item.status === 'failed';
    return true;
  });

  return (
    <div className="pay-page">
      <Link href="/admin/sosyal-medya" className="soc-back">
        ← Sosyal Medya Merkezine dön
      </Link>

      {/* 1. Üst Başlık & Özet Hapları */}
      <div className="pay-head">
        <div>
          <h1 className="adm-page-title">Hızlı Paylaşım & Gönderi Havuzu</h1>
          <p className="adm-page-sub">
            Fotoğrafları tek yerden yükleyin; metni otomatik hazırlayıp bağlı 6 sosyal medya platformunda anında yayınlayın veya sıraya ekleyin.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm adm-btn-icon-label"
          onClick={() => runBusy('refresh', load)}
          disabled={!!busy}
        >
          <IconRefresh size={16} />
          {busy === 'refresh' ? 'Yenileniyor…' : 'Yenile'}
        </button>
      </div>

      <div className="pay-pills">
        <Pill tone={connectedCount > 0 ? 'ok' : 'warn'}>Bağlı {connectedCount}/6 platform</Pill>
        <Pill tone={queuedCount > 0 ? 'warn' : 'muted'}>Sırada {queuedCount}</Pill>
        <Pill tone={publishedCount > 0 ? 'ok' : 'muted'}>Yayınlanan {publishedCount}</Pill>
        <Pill tone={data.studioAvailable ? 'ok' : 'muted'}>
          {data.studioAvailable
            ? `Stüdyo hazır${data.studioProviderLabel ? ` (${data.studioProviderLabel})` : ''}`
            : 'Stüdyo bağlı değil'}
        </Pill>
      </div>

      {data.warnings.length > 0 && (
        <div className="pay-warn-list">
          {data.warnings.map((w) => (
            <div key={w} className="soc-note warn pay-warn-item">
              <IconAlert size={16} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2. Otomatik Mod Çubuğu (Ayarlar Paneli) */}
      <section className="soc-panel pay-auto-bar" aria-label="Otomatik mod ayarları">
        <div className="pay-auto-top">
          <div>
            <h2>Otomatik Paylaşım Modu</h2>
            <p className="soc-muted">
              Açıkken fotoğraf seçip bıraktığınız anda ek düğmeye basmadan seçili varsayılan modda gönderi oluşturulur.
            </p>
          </div>
          <Switch
            label="Fotoğraf yüklenince otomatik paylaş / sıraya al"
            checked={settingsDraft.instantOnUpload}
            disabled={!!busy}
            onChange={(v) => patchSettings({ instantOnUpload: v })}
          />
        </div>

        <div className="pay-auto-controls">
          <div className="soc-field">
            <label htmlFor="pay-default-mode">Otomatik varsayılan mod</label>
            <select
              id="pay-default-mode"
              className="pay-select"
              value={settingsDraft.defaultMode}
              onChange={(e) =>
                patchSettings({ defaultMode: e.target.value === 'instant' ? 'instant' : 'queue' })
              }
            >
              <option value="instant">Hemen tüm platformlarda yayınla</option>
              <option value="queue">Kuyruğa ekle, sırayla paylaşsın</option>
            </select>
          </div>

          <div className="soc-field">
            <label htmlFor="pay-queue-cycle">Tur başına kuyruk adedi (1–3)</label>
            <input
              id="pay-queue-cycle"
              className="pay-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={3}
              value={settingsDraft.queuePerCycle}
              onChange={(e) =>
                patchSettings({ queuePerCycle: Math.min(3, Math.max(1, Number(e.target.value) || 1)) })
              }
            />
          </div>

          <div className="pay-auto-save">
            <button
              type="button"
              className="btn btn-primary btn-sm adm-btn-icon-label"
              onClick={handleSaveSettings}
              disabled={!!busy}
            >
              <IconCheck size={16} />
              {busy === 'settings' ? 'Kaydediliyor…' : 'Varsayılanları kaydet'}
            </button>
            {settingsDirty && <span className="soc-muted">Kaydedilmemiş değişiklik var.</span>}
          </div>
        </div>
      </section>

      {/* 3. Yeni Gönderi Oluşturucu */}
      <section className="soc-panel pay-composer" aria-label="Yeni gönderi oluşturucu">
        <div>
          <h2>Yeni Gönderi Oluşturucu</h2>
          <p className="soc-muted">
            {settingsDraft.instantOnUpload
              ? 'Otomatik mod açık: fotoğrafı bıraktığınız anda aşağıdaki tür, stüdyo ve platform seçimleriyle hemen işleme alınır.'
              : 'Fotoğrafları ekleyip adımları tamamlayın; isterseniz hemen yayınlayın, isterseniz sıraya koyun.'}
          </p>
        </div>

        {/* Adım 1 — Fotoğraflar */}
        <div className="pay-step">
          <h3 className="pay-step-title">
            <span>Adım 1 — Fotoğraflar ({imageIds.length}/{MAX_IMAGES})</span>
            {uploadState && (
              <Pill tone="warn">
                Yükleniyor ({uploadState.done}/{uploadState.total})…
              </Pill>
            )}
          </h3>

          <div
            role="button"
            tabIndex={0}
            aria-label="Fotoğraf yükle veya sürükleyip bırak"
            className={`pay-dropzone ${dragOver ? 'is-drag' : ''} ${busy === 'upload' ? 'is-busy' : ''}`}
            onClick={() => {
              if (!busy) fileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <IconUpload size={24} />
            <span className="pay-dropzone-title">
              {uploadState
                ? `Fotoğraflar yükleniyor (${uploadState.done}/${uploadState.total})…`
                : 'Fotoğraf seçmek için tıklayın veya sürükleyip bırakın'}
            </span>
            <span className="pay-dropzone-sub">
              Tek seferde en çok {MAX_IMAGES} görsel (JPG, PNG, WEBP, HEIC · en fazla 10 MB)
            </span>
            <input
              ref={fileInputRef}
              className="pay-file-input"
              type="file"
              accept="image/*"
              multiple
              disabled={!!busy}
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files);
              }}
            />
          </div>

          <div className="pay-product-picker">
            <div className="soc-field">
              <label htmlFor="pay-prod-search">Katalogda ürün ara</label>
              <input
                id="pay-prod-search"
                className="pay-input"
                type="search"
                placeholder="Ürün veya kategori adı…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            <div className="soc-field">
              <label htmlFor="pay-prod-select">Mevcut üründen fotoğraf çek & bağla</label>
              <select
                id="pay-prod-select"
                className="pay-select"
                value={productId}
                onChange={(e) => handleSelectProduct(e.target.value)}
              >
                <option value="">Ürün seçin (isteğe bağlı)…</option>
                {selectedProduct && !filteredProducts.some((p) => p.id === selectedProduct.id) && (
                  <option value={selectedProduct.id}>
                    {selectedProduct.title} ({selectedProduct.images.length} foto)
                  </option>
                )}
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.images.length} foto)
                  </option>
                ))}
              </select>
            </div>

            {productId && (
              <button
                type="button"
                className="btn btn-secondary btn-sm pay-product-clear"
                onClick={() => setProductId('')}
              >
                Ürün bağını kaldır
              </button>
            )}
          </div>

          {imageIds.length > 0 && (
            <div className="pay-thumbs" aria-label="Seçilen fotoğraflar">
              {imageIds.map((id, idx) => (
                <div key={`${id}-${idx}`} className={`pay-thumb-card ${idx === 0 ? 'is-cover' : ''}`}>
                  <a
                    href={cloudinaryUrl(id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pay-thumb-link"
                    aria-label={`${idx + 1}. fotoğrafı büyüt`}
                  >
                    <img src={cloudinaryThumb(id)} alt={`Yüklenen görsel ${idx + 1}`} loading="lazy" />
                  </a>
                  <div className="pay-thumb-meta">
                    <span>{idx === 0 ? '1 · Kapak' : `${idx + 1}. görsel`}</span>
                  </div>
                  <div className="pay-thumb-btns">
                    <button
                      type="button"
                      className="pay-thumb-btn"
                      aria-label="Sola taşı"
                      title="Sola taşı"
                      disabled={idx === 0}
                      onClick={() => moveImage(idx, -1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="pay-thumb-btn"
                      aria-label="Sağa taşı"
                      title="Sağa taşı"
                      disabled={idx === imageIds.length - 1}
                      onClick={() => moveImage(idx, 1)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="pay-thumb-btn is-danger"
                      aria-label="Fotoğrafı çıkar"
                      title="Çıkar"
                      onClick={() => removeImage(idx)}
                    >
                      <IconClose size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adım 2 — İçerik Türü & Kısa Not */}
        <div className="pay-step">
          <h3 className="pay-step-title">Adım 2 — İçerik Türü & Kısa Not</h3>
          <div className="pay-chips" role="group" aria-label="İçerik türü">
            {BROADCAST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className="pay-chip"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {BROADCAST_KIND_LABELS[k]}
              </button>
            ))}
          </div>

          <div className="soc-field">
            <label htmlFor="pay-note">Kısa not (isteğe bağlı)</label>
            <input
              id="pay-note"
              className="pay-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn. Elif Hanım için hazırladığımız fotoğraflı kupa"
            />
          </div>
        </div>

        {/* Adım 3 — Ücretsiz Stüdyo Arka Planı */}
        <div className="pay-step">
          <h3 className="pay-step-title">Adım 3 — Ücretsiz Stüdyo Arka Planı (İsteğe Bağlı)</h3>
          <label className="soc-check">
            <input
              type="checkbox"
              checked={studioEnhance}
              disabled={!data.studioAvailable}
              onChange={(e) => setStudioEnhance(e.target.checked)}
            />
            <span>Paylaşmadan önce ilk fotoğrafa ücretsiz stüdyo arka planı ekle (0 TL)</span>
          </label>

          {!data.studioAvailable && (
            <div className="soc-note warn pay-warn-item">
              <IconAlert size={16} />
              <span>
                Ücretsiz stüdyo sağlayıcısı henüz bağlı değil. Fotoğraflar olduğu gibi paylaşılır;{' '}
                <Link href="/admin/studio" style={{ textDecoration: 'underline' }}>
                  Ürün Fotoğrafları Stüdyosu
                </Link>{' '}
                sayfasından ortam değişkenlerini kontrol edebilirsiniz.
              </span>
            </div>
          )}

          {data.studioAvailable && studioEnhance && (
            <div className="soc-field">
              <label htmlFor="pay-scene">Stüdyo sahnesi</label>
              <select
                id="pay-scene"
                className="pay-select"
                value={studioSceneId}
                onChange={(e) => setStudioSceneId(e.target.value)}
              >
                {data.scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Adım 4 — Hedef Platformlar */}
        <div className="pay-step">
          <h3 className="pay-step-title">Adım 4 — Hedef Platformlar</h3>
          <div className="pay-chips" role="group" aria-label="Hedef platformlar">
            {ALL_SOCIAL_PLATFORMS.map((p) => {
              const info = data.platforms.find((x) => x.platform === p);
              const { name, Icon } = PLATFORM_META[p];
              const selected = platforms.includes(p);
              const configured = !!info?.configured;
              return (
                <button
                  key={p}
                  type="button"
                  className="pay-chip"
                  aria-pressed={selected}
                  onClick={() => togglePlatform(p)}
                >
                  <Icon size={17} />
                  <span>{name}</span>
                  <span className={`pay-chip-status ${configured ? 'is-ok' : ''}`}>
                    {configured ? 'Bağlı' : 'Bağlı değil'}
                  </span>
                </button>
              );
            })}
          </div>

          {platforms.includes('instagram') && (
            <label className="soc-check">
              <input
                type="checkbox"
                checked={instagramStory}
                onChange={(e) => setInstagramStory(e.target.checked)}
              />
              <span>Instagram Hikâye (Story) olarak da paylaş</span>
            </label>
          )}
        </div>

        {/* Adım 5 — Otomatik Gönderi Metni Önizleme & Düzenleme */}
        <div className="pay-step">
          <div className="pay-caption-head">
            <h3 className="pay-step-title">Adım 5 — Otomatik Gönderi Metni Önizleme & Düzenleme</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-btn-icon-label"
              onClick={handlePreviewCaptions}
              disabled={!!busy}
            >
              <IconSparkles size={16} />
              {busy === 'preview' ? 'Üretiliyor…' : 'Metni otomatik üret / Yenile'}
            </button>
          </div>
          <p className="pay-step-hint">
            Alanları boş bırakırsanız gönderi oluşturulurken seçtiğiniz türe ve nota göre otomatik Türkçe metin üretilir.
            {previewLink ? ` Bağlantı: ${previewLink}` : ''}
          </p>

          <div className="pay-caption-grid">
            <div className="soc-field">
              <div className="pay-label-row">
                <label htmlFor="pay-cap-title">Başlık (Pinterest & TikTok)</label>
                <span className={`pay-counter ${title.length > 90 ? 'is-over' : ''}`}>
                  {title.length} / 90 kr
                </span>
              </div>
              <input
                id="pay-cap-title"
                className="pay-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Boş bırakılırsa otomatik üretilir…"
              />
            </div>

            <div className="soc-field">
              <div className="pay-label-row">
                <label htmlFor="pay-cap-main">Ana Metin (Instagram, Facebook, Telegram, Pinterest)</label>
                <span className="pay-counter">{mainCaption.length} kr</span>
              </div>
              <textarea
                id="pay-cap-main"
                className="pay-textarea"
                value={mainCaption}
                onChange={(e) => setMainCaption(e.target.value)}
                placeholder="Boş bırakılırsa otomatik üretilir…"
              />
            </div>

            <div className="soc-field">
              <div className="pay-label-row">
                <label htmlFor="pay-cap-short">Kısa Metin (Threads)</label>
                <span className={`pay-counter ${shortCaption.length > 500 ? 'is-over' : ''}`}>
                  {shortCaption.length} / 500 kr
                </span>
              </div>
              <textarea
                id="pay-cap-short"
                className="pay-textarea pay-textarea-short"
                value={shortCaption}
                onChange={(e) => setShortCaption(e.target.value)}
                placeholder="Boş bırakılırsa otomatik üretilir…"
              />
            </div>
          </div>
        </div>

        {/* Eylem Butonları */}
        <div className="pay-cta-bar">
          <button
            type="button"
            className="btn btn-primary adm-btn-icon-label"
            onClick={() => handleCreate('instant')}
            disabled={!!busy}
          >
            <IconSend size={16} />
            {busy === 'create:instant' ? 'Yayınlanıyor…' : 'Şimdi Tüm Platformlarda Yayınla'}
          </button>
          <button
            type="button"
            className="btn btn-secondary adm-btn-icon-label"
            onClick={() => handleCreate('queue')}
            disabled={!!busy}
          >
            <IconClock size={16} />
            {busy === 'create:queue' ? 'Ekleniyor…' : 'Kuyruğa Ekle (Sırayla Otomatik Paylaşsın)'}
          </button>
          <button
            type="button"
            className="btn btn-secondary adm-btn-icon-label"
            onClick={() => handleCreate('draft')}
            disabled={!!busy}
          >
            <IconPlus size={16} />
            {busy === 'create:draft' ? 'Kaydediliyor…' : 'Taslak Kaydet'}
          </button>
        </div>
      </section>

      {/* 4. Gönderi Havuzu & Geçmiş Listesi */}
      <section className="soc-section" aria-label="Gönderi havuzu ve geçmiş">
        <div className="soc-section-head">
          <h2>Gönderi Havuzu & Geçmiş ({data.items.length})</h2>
          <div className="soc-tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="soc-tab"
              aria-pressed={poolTab === 'all'}
              onClick={() => setPoolTab('all')}
            >
              Tümü ({data.items.length})
            </button>
            <button
              type="button"
              className="soc-tab"
              aria-pressed={poolTab === 'queue'}
              onClick={() => setPoolTab('queue')}
            >
              Sırada & Taslak
            </button>
            <button
              type="button"
              className="soc-tab"
              aria-pressed={poolTab === 'published'}
              onClick={() => setPoolTab('published')}
            >
              Yayınlanan & Hatalı
            </button>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="soc-empty">
            Bu görünümde gönderi yok. Yukarıdan fotoğraf yükleyip hemen yayınlayabilir veya sıraya ekleyebilirsiniz.
          </div>
        ) : (
          <div className="pay-list">
            {visibleItems.map((item) => {
              const images = item.finalImageIds.length > 0 ? item.finalImageIds : item.rawImageIds;
              const isEditing = editing?.id === item.id;
              const canEdit = item.status === 'queued' || item.status === 'draft';
              const canPublish = item.status === 'queued' || item.status === 'draft';
              const canRetry = item.status === 'partial' || item.status === 'failed';

              return (
                <article
                  key={item.id}
                  className={`pay-item ${
                    item.status === 'done' ? 'is-done' : item.status === 'failed' ? 'is-failed' : ''
                  }`}
                >
                  <div className="pay-item-head">
                    <div>
                      <h3 className="pay-item-title">
                        {BROADCAST_KIND_LABELS[item.kind]}
                        {item.productTitle ? ` · ${item.productTitle}` : ''}
                      </h3>
                      <div className="pay-item-meta">
                        Oluşturma: {fmtWhen(item.createdAt)}
                        {item.publishedAt ? ` · Yayın: ${fmtWhen(item.publishedAt)}` : ''}
                        {item.studioEnhance ? ' · Stüdyo arka planlı' : ''}
                        {item.instagramStory ? ' · IG Hikâye dahil' : ''}
                      </div>
                    </div>
                    <Pill tone={statusTone(item.status)}>{BROADCAST_STATUS_LABELS[item.status]}</Pill>
                  </div>

                  {images.length > 0 && (
                    <div className="pay-item-thumbs">
                      {images.map((imgId, idx) => (
                        <a
                          key={`${imgId}-${idx}`}
                          href={cloudinaryUrl(imgId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pay-item-thumb"
                          aria-label={`Gönderi fotoğrafı ${idx + 1}`}
                        >
                          <img src={cloudinaryThumb(imgId)} alt={`Gönderi görseli ${idx + 1}`} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}

                  {item.note && (
                    <p className="soc-muted" style={{ margin: 0 }}>
                      Not: {item.note}
                    </p>
                  )}

                  {item.studioError && (
                    <div className="soc-note err pay-warn-item">
                      <IconCamera size={16} />
                      <span>Stüdyo arka planı uyarısı: {item.studioError}</span>
                    </div>
                  )}

                  {isEditing && editing ? (
                    <div className="pay-edit-box">
                      <div className="soc-field">
                        <label htmlFor={`edit-title-${item.id}`}>Başlık</label>
                        <input
                          id={`edit-title-${item.id}`}
                          className="pay-input"
                          type="text"
                          value={editing.title}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        />
                      </div>
                      <div className="soc-field">
                        <label htmlFor={`edit-main-${item.id}`}>Ana Metin</label>
                        <textarea
                          id={`edit-main-${item.id}`}
                          className="pay-textarea"
                          value={editing.mainCaption}
                          onChange={(e) => setEditing({ ...editing, mainCaption: e.target.value })}
                        />
                      </div>
                      <div className="soc-field">
                        <div className="pay-label-row">
                          <label htmlFor={`edit-short-${item.id}`}>Kısa Metin (Threads)</label>
                          <span className={`pay-counter ${editing.shortCaption.length > 500 ? 'is-over' : ''}`}>
                            {editing.shortCaption.length} / 500 kr
                          </span>
                        </div>
                        <textarea
                          id={`edit-short-${item.id}`}
                          className="pay-textarea pay-textarea-short"
                          value={editing.shortCaption}
                          onChange={(e) => setEditing({ ...editing, shortCaption: e.target.value })}
                        />
                      </div>
                      <div className="pay-chips">
                        {ALL_SOCIAL_PLATFORMS.map((p) => {
                          const { name, Icon } = PLATFORM_META[p];
                          const on = editing.platforms.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              className="pay-chip"
                              aria-pressed={on}
                              onClick={() =>
                                setEditing({
                                  ...editing,
                                  platforms: on
                                    ? editing.platforms.filter((x) => x !== p)
                                    : [...editing.platforms, p],
                                })
                              }
                            >
                              <Icon size={16} />
                              <span>{name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="soc-field">
                        <label htmlFor={`edit-status-${item.id}`}>Durum</label>
                        <select
                          id={`edit-status-${item.id}`}
                          className="pay-select"
                          value={editing.status}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              status: e.target.value === 'draft' ? 'draft' : 'queued',
                            })
                          }
                        >
                          <option value="queued">Sırada (otomatik paylaşım)</option>
                          <option value="draft">Taslak</option>
                        </select>
                      </div>
                      <div className="soc-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm adm-btn-icon-label"
                          onClick={saveEditing}
                          disabled={!!busy}
                        >
                          <IconCheck size={16} />
                          {busy === 'edit' ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(null)}
                          disabled={!!busy}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="soc-caption">{item.captions.mainCaption || item.captions.title}</div>
                  )}

                  {/* 6 Platform Sonucu */}
                  <div className="pay-targets" aria-label="Platform sonuçları">
                    {ALL_SOCIAL_PLATFORMS.map((p) => {
                      const { name, Icon } = PLATFORM_META[p];
                      const res = item.targets[p];
                      const selected = item.platforms.includes(p);
                      const pill = targetPill(res, selected);
                      const stateClass = res
                        ? res.status === 'posted'
                          ? 'is-posted'
                          : res.status === 'failed'
                            ? 'is-failed'
                            : res.status === 'skipped'
                              ? 'is-skipped'
                              : ''
                        : !selected
                          ? 'is-skipped'
                          : '';

                      return (
                        <div key={p} className={`pay-target ${stateClass}`}>
                          <div className="pay-target-top">
                            <span className="pay-target-name">
                              <Icon size={15} />
                              {name}
                            </span>
                            <Pill tone={pill.tone}>{pill.label}</Pill>
                          </div>
                          {res?.error && <div className="pay-target-msg">{res.error}</div>}
                          {res?.permalink && (
                            <a
                              href={res.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pay-target-link"
                            >
                              Gönderiyi aç
                              <IconExternal size={13} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {item.storyStatus && (
                    <div className="soc-muted" style={{ fontSize: 12 }}>
                      Instagram Hikâye: {targetPill(item.storyStatus, true).label}
                      {item.storyStatus.error ? ` — ${item.storyStatus.error}` : ''}
                    </div>
                  )}

                  {/* Kart Aksiyonları */}
                  <div className="soc-post-actions">
                    {canPublish && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm adm-btn-icon-label"
                        onClick={() => handlePublishItem(item)}
                        disabled={!!busy}
                      >
                        <IconSend size={15} />
                        {busy === `pub:${item.id}` ? 'Yayınlanıyor…' : 'Şimdi Yayınla'}
                      </button>
                    )}
                    {canRetry && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm adm-btn-icon-label"
                        onClick={() => handleRetryItem(item)}
                        disabled={!!busy}
                      >
                        <IconRefresh size={15} />
                        {busy === `retry:${item.id}` ? 'Deneniyor…' : 'Hatalıları Yeniden Dene'}
                      </button>
                    )}
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm adm-btn-icon-label"
                        onClick={() => startEditing(item)}
                        disabled={!!busy}
                      >
                        <IconEdit size={15} />
                        Düzenle
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm adm-btn-icon-label soc-spacer"
                      onClick={() => handleDeleteItem(item)}
                      disabled={!!busy}
                    >
                      <IconTrash size={15} />
                      {busy === `del:${item.id}` ? 'Siliniyor…' : 'Sil'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {dialog}
    </div>
  );
}
