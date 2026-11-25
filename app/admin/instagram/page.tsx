'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getInstagramOverviewAction, setInstagramEnabledAction, cancelInstagramPostAction, cancelInstagramDayAction,
  updateInstagramCaptionAction, publishInstagramNowAction, updateInstagramSettingsAction, rescheduleInstagramPostAction,
  saveInstagramCredentialsAction, updateInstagramPostItemsAction, getProductAvailableImagesAction,
  regenerateInstagramCaptionAction, resetPostToProductPhotosAction, queueProductToInstagramAction, runInstagramNowAction,
  type IgOverview,
} from '@/lib/actions-instagram';
import { trDayKey, trTime, type IgItem, type IgPost } from '@/lib/instagram-utils';
import { windowLabel } from '@/lib/social-settings-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import CategoryShareBox from '@/components/admin/CategoryShareBox';
import {
  IconRefresh, IconSend, IconAlert, IconInstagram, IconTrash, IconEdit, IconClock, IconPlus, IconCheck,
} from '@/components/admin/icons';
import { Pill, Switch, SettingsForm, fmtWhen, fmtDay, daysLeft, hhmm } from '@/components/admin/social/shared';
import '@/components/admin/social/social.css';

type StatusTab = 'queue' | 'history' | 'all';
type TypeFilter = 'all' | 'carousel' | 'story' | 'blog';
type Post = IgPost & { previews: string[] };

const KIND_LABEL: Record<IgPost['kind'], string> = { carousel: 'Gönderi', story: 'Hikâye', blog: 'Blog yazısı' };

function remaining(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Zamanı geldi, sıradaki turda yayınlanır';
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} sa ${mins % 60} dk kaldı` : `${mins} dk kaldı`;
}

export default function AdminInstagramPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [ov, setOv] = useState<IgOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('queue');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [queueId, setQueueId] = useState('');
  const [queueKind, setQueueKind] = useState<'carousel' | 'story'>('carousel');

  const load = useCallback(async (check = false) => {
    try {
      setOv(await getInstagramOverviewAction(check));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 60000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'İşlem başarısız.'));
    } finally {
      setBusy(false);
    }
  };

  const runCycle = async () => {
    const ok = await confirm({ title: 'Instagram turunu çalıştır', message: 'Günlük plan (yoksa) hazırlanır ve zamanı gelen taslaklar yayınlanır. Otomasyon kapalıysa atlanır.', confirmLabel: 'Çalıştır' });
    if (!ok) return;
    await run(async () => {
      const r = await runInstagramNowAction();
      if (r.skipped) throw new Error(`Atlandı: ${r.skipped}`);
      if (r.errors.length) throw new Error(r.errors.join(' | '));
      toast.success(`${r.posted} paylaşım yayınlandı${r.planCreated ? `, ${r.planCreated} taslak hazırlandı` : ''}.`);
    });
  };

  const saveToken = () =>
    run(async () => {
      const r = await saveInstagramCredentialsAction({ token: tokenInput, userId: userIdInput });
      if (!r.ok) throw new Error(r.error || 'Kaydedilemedi.');
      setTokenInput('');
      setUserIdInput('');
      setShowToken(false);
      toast.success(`Bağlandı: @${r.username}`);
    });

  const publishNow = async (p: Post) => {
    const ok = await confirm({ title: 'Hemen paylaş', message: 'Bu gönderi Instagram hesabında HEMEN yayınlansın mı?', confirmLabel: 'Paylaş' });
    if (!ok) return;
    await run(async () => {
      const r = await publishInstagramNowAction(p.id);
      if (!r.ok) throw new Error(r.error || 'Yayınlanamadı.');
    }, 'Instagram hesabında yayınlandı.');
  };

  const removePost = async (p: Post) => {
    const ok = await confirm({ title: 'İptal et ve sil', message: 'Bu taslak sıradan ve veritabanından tamamen silinsin mi? Bu işlem geri alınamaz.', confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    await run(() => cancelInstagramPostAction(p.id), 'Taslak silindi.');
  };

  const cancelDay = async (day: string, n: number) => {
    const ok = await confirm({ title: `${day} taslaklarını sil`, message: `Bu güne ait ${n} taslak silinecek. Yayınlananlar etkilenmez.`, confirmLabel: 'Hepsini sil', danger: true });
    if (!ok) return;
    await run(() => cancelInstagramDayAction(day), 'Günün taslakları silindi.');
  };

  const reschedule = (p: Post, addMin: number) =>
    run(() => rescheduleInstagramPostAction(p.id, p.publishAt + addMin * 60000), `Paylaşım ${addMin} dk ertelendi.`);

  const toWindowStart = (p: Post) => {
    const h = ov?.settings.windowStart ?? 10;
    return run(() => rescheduleInstagramPostAction(p.id, trTime(p.day, h, 0)), `Paylaşım ${String(h).padStart(2, '0')}:00 TSİ olarak ayarlandı.`);
  };

  const moveSlide = async (p: Post, from: number, to: number) => {
    if (to < 0 || to >= p.items.length) return;
    const items = [...p.items];
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    await run(() => updateInstagramPostItemsAction(p.id, items), 'Slayt sırası güncellendi.');
  };

  const removeSlide = async (p: Post, i: number) => {
    if (p.items.length <= 1) { toast.error('Karuselde en az 1 görsel kalmalı.'); return; }
    const ok = await confirm({ title: 'Görseli çıkar', message: `${i + 1}. görsel bu gönderiden çıkarılsın mı?`, confirmLabel: 'Çıkar', danger: true });
    if (!ok) return;
    await run(() => updateInstagramPostItemsAction(p.id, p.items.filter((_, k) => k !== i)), 'Görsel çıkarıldı.');
  };

  const addMissing = (p: Post) =>
    run(async () => {
      const all = await getProductAvailableImagesAction(p.items[0].productId);
      const have = new Set(p.items.map((i) => i.imageId));
      const missing = all.filter((id) => !have.has(id));
      if (!missing.length) { toast.success('Modelin tüm fotoğrafları zaten ekli.'); return; }
      const base = p.items[0];
      const items: IgItem[] = [...p.items, ...missing.map((imageId) => ({ ...base, imageId }))].slice(0, 10);
      await updateInstagramPostItemsAction(p.id, items);
      toast.success(`${items.length - p.items.length} görsel eklendi.`);
    });

  const queueProduct = () =>
    run(async () => {
      const r = await queueProductToInstagramAction(queueId, queueKind);
      if (!r.ok) throw new Error(r.error || 'Kuyruğa eklenemedi.');
      setQueueId('');
    }, 'Taslak kuyruğa eklendi; yaklaşık 15 dk sonra yayınlanır.');

  const all = (ov?.posts ?? []).filter((p) => p.status !== 'iptal');
  const pool = statusTab === 'queue' ? all.filter((p) => p.status === 'taslak') : statusTab === 'history' ? all.filter((p) => p.status === 'yayinlandi') : all;
  const filtered = typeFilter === 'all' ? pool : pool.filter((p) => p.kind === typeFilter);
  const days = Array.from(new Set(filtered.map((p) => p.day))).sort();
  const today = trDayKey(Date.now());
  const left = daysLeft(ov?.tokenExpiresAt);

  const renderPost = (p: Post) => {
    const draft = p.status === 'taslak';
    const slides = p.kind === 'carousel';
    return (
      <article key={p.id} className={`soc-post ${p.status === 'yayinlandi' ? 'is-published' : ''}`}>
        <div className="soc-post-head">
          <span className="soc-actions">
            <Pill tone={p.kind === 'story' ? 'warn' : 'muted'}>{KIND_LABEL[p.kind]}{slides ? ` · ${p.items.length} görsel` : ''}</Pill>
            <strong className="soc-post-title">{hhmm(p.publishAt)} · {p.items[0]?.title ?? 'Gönderi'}</strong>
          </span>
          {draft && <Pill tone="warn">{remaining(p.publishAt)}</Pill>}
          {p.status === 'yayinlandi' && <Pill tone="ok">Yayınlandı</Pill>}
          {p.status === 'hata' && <Pill tone="err">Hata</Pill>}
        </div>
        {p.theme && <p className="soc-muted" style={{ margin: 0 }}>Özel gün kampanyası gönderisi</p>}
        {p.error && <span className="soc-error-line">{p.error}</span>}

        <div className="soc-strip">
          {p.items.map((item, i) => (
            <div key={`${item.imageId}-${i}`} className={`soc-slide ${p.kind === 'story' ? 'is-story' : ''}`}>
              <span className="soc-slide-label">{i === 0 ? '1. kapak' : `${i + 1}. görsel`}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previews[i] || item.imageId} alt={item.title} loading="lazy" />
              {draft && slides && (
                <div className="soc-slide-btns">
                  <button type="button" disabled={busy || i === 0} onClick={() => moveSlide(p, i, i - 1)} aria-label="Sola kaydır">‹</button>
                  <button type="button" disabled={busy || p.items.length <= 1} onClick={() => removeSlide(p, i)} aria-label="Görseli çıkar"><IconTrash size={14} /></button>
                  <button type="button" disabled={busy || i === p.items.length - 1} onClick={() => moveSlide(p, i, i + 1)} aria-label="Sağa kaydır">›</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {draft && slides && !p.theme && (
          <div className="soc-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
              onClick={async () => { if (await confirm({ title: 'Fotoğrafları sıfırla', message: 'Gönderi, modelin sitedeki tüm fotoğraflarıyla baştan eşitlensin mi?', confirmLabel: 'Sıfırla' })) run(() => resetPostToProductPhotosAction(p.id), 'Fotoğraflar eşitlendi.'); }}>
              <IconRefresh size={14} /> Modelin fotoğraflarını yenile
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => addMissing(p)}><IconPlus size={14} /> Eksik fotoğrafları ekle</button>
          </div>
        )}

        {p.kind !== 'story' && (editing?.id === p.id ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <textarea className="soc-textarea" value={editing.text} onChange={(e) => setEditing({ id: p.id, text: e.target.value })} rows={9} aria-label="Açıklama" />
            <div className="soc-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await updateInstagramCaptionAction(p.id, editing.text); setEditing(null); }, 'Açıklama kaydedildi.')}>Kaydet</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Vazgeç</button>
            </div>
          </div>
        ) : (
          <p className="soc-caption">{p.caption}</p>
        ))}

        {draft && editing?.id !== p.id && (
          <div className="soc-post-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !ov?.configured} onClick={() => publishNow(p)}><IconSend size={14} /> Hemen paylaş</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => reschedule(p, 30)}><IconClock size={14} /> +30 dk</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => reschedule(p, 60)}><IconClock size={14} /> +1 saat</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => toWindowStart(p)}>{String(ov?.settings.windowStart ?? 10).padStart(2, '0')}:00&apos;e al</button>
            {p.kind === 'carousel' && !p.theme && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => regenerateInstagramCaptionAction(p.id), 'Açıklama yeniden oluşturuldu.')}><IconRefresh size={14} /> Açıklamayı yenile</button>
            )}
            {p.kind !== 'story' && <button type="button" className="btn btn-secondary" onClick={() => setEditing({ id: p.id, text: p.caption })}><IconEdit size={14} /> Düzenle</button>}
            <button type="button" className="btn btn-danger soc-spacer" disabled={busy} onClick={() => removePost(p)}><IconTrash size={14} /> İptal et ve sil</button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="soc-page">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Instagram</h1>
          <p className="adm-page-sub">@kartabaskii için günlük plan: karusel gönderi, hikâye, blog yazısı ve özel gün kampanyası taslakları.</p>
        </div>
        <div className="soc-actions">
          <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={loading}><IconRefresh size={16} /> Yenile</button>
          <button type="button" className="btn btn-primary" onClick={runCycle} disabled={busy || !ov?.configured}><IconSend size={16} /> Şimdi çalıştır</button>
        </div>
      </div>

      <p className="soc-lead">
        Her sabah (06:00 sonrası) seçili kotaya göre taslaklar hazırlanır; itiraz etmezseniz zamanı gelince yayınlanır. Taslakların fotoğraf
        sırasını, açıklamasını ve saatini değiştirebilir ya da silebilirsiniz. Yayın anında model hâlâ aktif mi yeniden denetlenir.
      </p>

      {error && <div className="soc-note err" role="alert"><IconAlert size={14} /> {error}</div>}

      {ov && !ov.configured && (
        <div className="soc-note warn" style={{ marginBottom: 20 }}>
          <strong>Bağlı değil.</strong> INSTAGRAM_ACCESS_TOKEN tanımlı değil; paylaşım yapılmıyor ve taslak üretilmiyor. Jetonu aşağıdaki
          “Bağlantıyı düzenle” bölümünden girebilir ya da ortam değişkeni olarak tanımlayabilirsiniz (docs/SOSYAL_MEDYA_KURULUM.md).
        </div>
      )}
      {ov?.accountError && <div className="soc-note err" style={{ marginBottom: 20 }}>Bağlantı doğrulanamadı: {ov.accountError}</div>}
      {ov?.campaign && (
        <div className="soc-note" style={{ marginBottom: 20 }}>
          Yaklaşan özel gün: <strong>{ov.campaign.name}</strong> ({ov.campaign.daysLeft === 0 ? 'bugün' : `${ov.campaign.daysLeft} gün sonra`}). Plan, ilk karuseli kampanya gönderisine çevirir.
        </div>
      )}

      {ov && (
        <>
          <div className="soc-panel">
            <div className="soc-actions" style={{ justifyContent: 'space-between' }}>
              <div className="soc-actions">
                <span className="soc-card-icon"><IconInstagram size={20} /></span>
                <div>
                  <strong>{ov.account ? `@${ov.account}` : 'Instagram hesabı'}</strong>
                  <div className="soc-muted">
                    {windowLabel(ov.settings)} · günde {ov.settings.dailyLimit} gönderi, {ov.settings.storyLimit} hikâye
                    {ov.tokenExpiresAt ? ` · token ${fmtDay(ov.tokenExpiresAt)} tarihine kadar${left !== undefined && left < 10 ? ` (${Math.max(0, left)} gün kaldı)` : ''}` : ''}
                  </div>
                </div>
                <Pill tone={!ov.configured ? 'warn' : ov.enabled ? 'ok' : 'muted'}>{!ov.configured ? 'Bağlı değil' : ov.enabled ? 'Açık' : 'Kapalı'}</Pill>
              </div>
              <Switch label="Otomatik paylaşım" checked={ov.enabled} disabled={busy}
                onChange={(v) => run(() => setInstagramEnabledAction(v), v ? 'Otomasyon açıldı.' : 'Otomasyon kapatıldı.')} />
            </div>
            <div className="soc-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowToken((v) => !v)}>{showToken ? 'Kapat' : 'Bağlantıyı düzenle'}</button>
            </div>
            {showToken && (
              <div className="soc-form-row">
                <div className="soc-field" style={{ flex: '2 1 260px' }}>
                  <label htmlFor="ig-token">Erişim tokenı (60 gün geçerli, otomatik yenilenir)</label>
                  <input id="ig-token" type="password" autoComplete="off" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
                </div>
                <div className="soc-field">
                  <label htmlFor="ig-uid">Hesap kimliği (isteğe bağlı)</label>
                  <input id="ig-uid" inputMode="numeric" autoComplete="off" value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary" disabled={busy || !tokenInput.trim()} onClick={saveToken}><IconCheck size={14} /> Kaydet ve doğrula</button>
              </div>
            )}
          </div>

          <SettingsForm
            settings={ov.settings} showStory busy={busy} feedLabel="Günlük gönderi"
            onSave={(v) => run(() => updateInstagramSettingsAction(v), 'Ayarlar kaydedildi.')}
          />

          <div className="soc-panel">
            <h2>Elle kuyruğa ekle</h2>
            <p className="soc-muted">Seçilen modeli taslak olarak sıraya alır; yaklaşık 15 dakika içinde yayınlanır. Düzenlemek için taslağı aşağıdan açın.</p>
            <div className="soc-form-row">
              <div className="soc-field" style={{ flex: '2 1 240px' }}>
                <label htmlFor="ig-queue">Model</label>
                <select id="ig-queue" value={queueId} onChange={(e) => setQueueId(e.target.value)}>
                  <option value="">Model seçin</option>
                  {ov.candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="soc-field">
                <label htmlFor="ig-kind">Tür</label>
                <select id="ig-kind" value={queueKind} onChange={(e) => setQueueKind(e.target.value as 'carousel' | 'story')}>
                  <option value="carousel">Gönderi (karusel)</option>
                  <option value="story">Hikâye</option>
                </select>
              </div>
              <button type="button" className="btn btn-primary" disabled={busy || !queueId} onClick={queueProduct}><IconPlus size={14} /> Kuyruğa ekle</button>
            </div>
          </div>

          <section className="soc-section">
            <div className="soc-section-head"><h2>Taslaklar ve paylaşımlar</h2><span className="soc-muted">Dün – 3 gün sonrası</span></div>
            <div className="soc-tabs" role="group" aria-label="Durum">
              {([['queue', 'Sıradakiler'], ['history', 'Yayınlananlar'], ['all', 'Tümü']] as const).map(([k, l]) => (
                <button key={k} type="button" className="soc-tab" aria-pressed={statusTab === k} onClick={() => setStatusTab(k)}>{l}</button>
              ))}
            </div>
            <div className="soc-tabs" role="group" aria-label="Tür">
              {([['all', 'Hepsi'], ['carousel', 'Gönderi'], ['story', 'Hikâye'], ['blog', 'Blog']] as const).map(([k, l]) => (
                <button key={k} type="button" className="soc-tab" aria-pressed={typeFilter === k} onClick={() => setTypeFilter(k)}>{l}</button>
              ))}
            </div>
            {days.length === 0 ? (
              <div className="soc-empty">Bu filtrede paylaşım yok. Otomasyon açık ve bağlıysa plan sabah 06:00’dan sonra hazırlanır.</div>
            ) : (
              days.map((day) => {
                const list = filtered.filter((p) => p.day === day);
                const drafts = list.filter((p) => p.status === 'taslak').length;
                return (
                  <div key={day} style={{ marginBottom: 24 }}>
                    <div className="soc-section-head">
                      <h3 style={{ margin: 0, fontSize: 15 }}>{day === today ? 'Bugün' : new Date(trTime(day, 12)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })} · {list.length} paylaşım</h3>
                      {drafts > 0 && <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => cancelDay(day, drafts)}>Günün taslaklarını sil</button>}
                    </div>
                    {list.map(renderPost)}
                  </div>
                );
              })
            )}
          </section>

          <CategoryShareBox products={ov.categoryRows} />
        </>
      )}
      <p className="soc-muted"><Link href="/admin/sosyal-medya">Sosyal medya merkezine dön</Link></p>
      {dialog}
    </div>
  );
}
