'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getPostsAdminAction, deletePostAction, movePostScheduleAction, publishPostNowAction,
  generateDraftNowAction, getBlogAutoStatusAction,
} from '@/lib/actions-blog';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconEdit, IconExternal, IconPlus, IconSparkles, IconTrash } from '@/components/admin/icons';
import type { Post } from '@/lib/posts-types';
import type { BlogAutoStatus } from '@/lib/blog-auto';
import { BLOG_DAILY_MAX, BLOG_MIN_GAP_MS, BLOG_QUEUE_MIN } from '@/lib/blog-cadence';
import './blog-admin.css';

const fmt = (ts?: number) =>
  ts ? new Date(ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : '—';

type Filter = 'all' | 'published' | 'scheduled' | 'draft';

const statusOf = (p: Post): Exclude<Filter, 'all'> => (p.published ? 'published' : (p.scheduledAt ?? 0) > 0 ? 'scheduled' : 'draft');

export default function AdminBlogPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [posts, setPosts] = useState<Post[]>([]);
  const [auto, setAuto] = useState<BlogAutoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const [list, status] = await Promise.all([getPostsAdminAction(), getBlogAutoStatusAction().catch(() => null)]);
      setPosts(list);
      setAuto(status);
    } catch (e) {
      setLoadError(true);
      toast.error(errorMessage(e, 'Yazılar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const queue = useMemo(
    () => posts.filter((p) => statusOf(p) === 'scheduled').sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)),
    [posts],
  );
  const counts = useMemo(() => {
    const c = { published: 0, scheduled: 0, draft: 0 };
    for (const p of posts) c[statusOf(p)]++;
    return c;
  }, [posts]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return posts.filter((p) => (filter === 'all' || statusOf(p) === filter) && (!q || p.title.toLocaleLowerCase('tr-TR').includes(q) || p.slug.includes(q)));
  }, [posts, query, filter]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error(errorMessage(e, 'İşlem başarısız.')); } finally { setBusy(false); }
  };

  const remove = async (p: Post) => {
    const yes = await confirm({ title: 'Yazı silinsin mi?', message: `"${p.title}" kalıcı olarak silinecek.`, confirmLabel: 'Sil', danger: true });
    if (yes) await run(() => deletePostAction(p.id), 'Yazı silindi.');
  };

  const publishNow = async (p: Post) => {
    const yes = await confirm({ title: 'Şimdi yayınlansın mı?', message: `"${p.title}" hemen sitede yayına girecek.`, confirmLabel: 'Yayınla' });
    if (yes) await run(() => publishPostNowAction(p.id), 'Yazı yayınlandı.');
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateDraftNowAction();
      if (!res) toast.error('Üretilecek yeni konu kalmadı. SEO sayfasından anahtar kelime hedefleri ekleyebilirsiniz.');
      else toast.success(`Taslak hazır: ${res.title}`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Taslak üretilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {dialog}
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Blog</h1>
          <p className="adm-page-sub">Rehber yazıları aramalarda görünür olmanızı sağlar; planlı yazılar vakti gelince kendiliğinden yayına çıkar.</p>
        </div>
        <div className="adm-actions-row">
          <button type="button" className="btn btn-secondary adm-btn-icon-label" onClick={generate} disabled={busy}>
            <IconSparkles size={16} /> Şimdi taslak üret
          </button>
          <Link href="/admin/blog/new" className="btn btn-primary adm-btn-icon-label"><IconPlus size={16} /> Yeni yazı</Link>
        </div>
      </div>

      <div className="adm-stat-grid">
        <div className="card adm-stat"><span className="adm-stat-value">{counts.published}</span><span className="adm-stat-label">Yayında</span></div>
        <div className="card adm-stat"><span className="adm-stat-value">{counts.scheduled}</span><span className="adm-stat-label">Planlı</span></div>
        <div className="card adm-stat"><span className="adm-stat-value">{counts.draft}</span><span className="adm-stat-label">Taslak</span></div>
      </div>

      {auto && (
        <div className="card adm-section">
          <h2 className="adm-section-title">Otomasyon</h2>
          <div className="blg-auto">
            <div className="blg-auto-row">
              <span>Otomatik üretim: <b>{auto.autoGenerate ? 'Açık' : 'Kapalı'}</b></span>
              <span>Üretici: <b>{auto.geminiConfigured ? 'Gemini' : 'Şablon (Gemini bağlı değil)'}</b></span>
              <span>Üretilen taslak: <b>{auto.autoPublish ? 'Takvime eklenir' : 'Admin onayı bekler'}</b></span>
              <span>Kullanılan konu: <b>{auto.usedTopics}</b></span>
              <span>Son üretim: <b>{fmt(auto.lastGenAt)}</b></span>
            </div>
            <div className="blg-auto-row">
              <span>Sıradaki konu: <b>{auto.nextTopic ? `${auto.nextTopic.title}${auto.nextTopic.urgent ? ' (özel gün, öne alındı)' : ''}` : 'konu kalmadı'}</b></span>
            </div>
            {auto.lastError && <div className="blg-auto-error">Son hata: {auto.lastError}</div>}
            <div className="blg-hint">
              Planlı yazılar vakti gelince yayınlanır: günde en fazla {BLOG_DAILY_MAX} yazı, iki yazı arasında en az {BLOG_MIN_GAP_MS / 3600000} saat.{' '}
              {auto.autoGenerate
                ? `Planlı yazı sayısı ${BLOG_QUEUE_MIN} adedin altına düşerse günde bir taslak üretilir.`
                : 'Kendiliğinden taslak üretilmez; taslağı "Şimdi taslak üret" düğmesiyle siz hazırlatırsınız.'}{' '}
              {auto.autoPublish && 'Üretilen taslak takvime eklenir; yaklaşan özel gün konusu hemen sıraya girer. '}
              Telegram bağlıysa bildirim gelir.
            </div>
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <div className="card adm-section">
          <h2 className="adm-section-title">Yayın takvimi ({queue.length})</h2>
          <div className="blg-queue">
            {queue.map((p, i) => (
              <div key={p.id} className="blg-queue-row">
                <span className="blg-queue-date">{fmt(p.scheduledAt)}</span>
                <span className="blg-queue-title">{p.title}</span>
                <div className="blg-queue-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy || i === 0} onClick={() => run(() => movePostScheduleAction(p.id, 'up'), 'Öne alındı.')}>Öne al</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy || i === queue.length - 1} onClick={() => run(() => movePostScheduleAction(p.id, 'down'), 'Ertelendi.')}>Ertele</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => publishNow(p)}>Şimdi yayınla</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="adm-toolbar">
        <input className="form-input" aria-label="Yazı ara" placeholder="Başlık ya da adres ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="form-select" aria-label="Durum" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">Tüm durumlar</option>
          <option value="published">Yayında</option>
          <option value="scheduled">Planlı</option>
          <option value="draft">Taslak</option>
        </select>
        <span className="adm-toolbar-count" aria-live="polite">{shown.length} yazı</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
      ) : loadError ? (
        <div className="adm-empty">
          <div className="adm-empty-title">Yazılar yüklenemedi</div>
          <button type="button" className="btn btn-secondary" onClick={() => { setLoading(true); load(); }}>Tekrar dene</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-title">{posts.length === 0 ? 'Henüz yazı yok' : 'Yazı bulunamadı'}</div>
          {posts.length === 0 && <p>İlk yazıyı ekleyin ya da &quot;Şimdi taslak üret&quot; ile bir taslak hazırlatın.</p>}
        </div>
      ) : (
        <div className="adm-list">
          {shown.map((p) => {
            const st = statusOf(p);
            return (
              <div key={p.id} className="card adm-row">
                <div className="adm-row-main">
                  <div className="adm-row-title"><span>{p.title}</span></div>
                  <div className="adm-row-slug"><span>/blog/{p.slug}</span></div>
                  <div className="blg-row-badges">
                    <span className={`badge ${st === 'published' ? 'badge-green' : 'badge-muted'}`}>{st === 'published' ? 'Yayında' : st === 'scheduled' ? 'Planlı' : 'Taslak'}</span>
                    {p.auto && <span className="badge badge-muted">Otomatik</span>}
                    <span className="adm-row-slug">{fmt(p.published ? p.publishedAt : p.scheduledAt || p.updatedAt)}</span>
                  </div>
                </div>
                <div className="adm-row-buttons">
                  {p.published && (
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="adm-icon-btn" title="Sitede gör" aria-label="Sitede gör"><IconExternal /></a>
                  )}
                  <Link href={`/admin/blog/${p.id}`} className="adm-icon-btn" title="Düzenle" aria-label="Düzenle"><IconEdit /></Link>
                  <button type="button" className="adm-icon-btn" onClick={() => remove(p)} disabled={busy} title="Sil" aria-label="Sil"><IconTrash /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
