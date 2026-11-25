'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listReviewsAdminAction, listInvitesAdminAction, getReviewStatsAction, setReviewStatusAction,
  setReviewReplyAction, deleteReviewAction,
} from '@/lib/actions-reviews';
import type { InviteRow } from '@/lib/reviews';
import { stars, displayName, type Review, type ReviewStatus } from '@/lib/reviews-utils';
import ReviewPhotos from '@/components/reviews/ReviewPhotos';
import ReviewInviteModal from '@/components/admin/ReviewInviteModal';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconMessage, IconPlus, IconTrash } from '@/components/admin/icons';
import './yorumlar.css';

const TABS: [ReviewStatus, string][] = [
  ['bekliyor', 'Onay bekleyen'],
  ['onayli', 'Yayında'],
  ['gizli', 'Gizli'],
  ['reddedildi', 'Reddedilen'],
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  bekliyor: 'Onay bekliyor',
  onayli: 'Yayında',
  gizli: 'Gizli',
  reddedildi: 'Reddedildi',
};

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

function inviteLabel(i: InviteRow): [string, string] {
  if (i.used) return ['yorum yazıldı', 'ok'];
  if (i.expiresAt < Date.now()) return ['süresi doldu', ''];
  if (i.claimed) return ['açıldı, yazılmadı', 'warn'];
  return ['henüz açılmadı', ''];
}

type Stats = { pending: number; approved: number; average: number };

export default function AdminReviewsPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<ReviewStatus>('bekliyor');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadStats = useCallback(() => {
    getReviewStatsAction().then(setStats).catch(() => {});
  }, []);

  const loadInvites = useCallback(() => {
    listInvitesAdminAction().then(setInvites).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    listReviewsAdminAction(tab)
      .then((list) => { if (!cancelled) setReviews(list); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => { loadStats(); loadInvites(); }, [loadStats, loadInvites]);

  /** Yorumu listeden çıkar (sekme artık eşleşmiyorsa) ya da yerinde güncelle. */
  const patchLocal = (id: string, patch: Partial<Review> | null) => {
    setReviews((prev) => {
      if (patch === null) return prev.filter((r) => r.id !== id);
      return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
    });
  };

  const moderate = async (r: Review, status: ReviewStatus) => {
    if (status === 'reddedildi') {
      const ok = await confirm({
        title: 'Yorum reddedilsin mi?',
        message: 'Yorum reddedilir ve fotoğrafları kalıcı olarak silinir.',
        confirmLabel: 'Reddet',
        danger: true,
      });
      if (!ok) return;
    }
    setBusyId(r.id);
    try {
      await setReviewStatusAction(r.id, status);
      toast.success(`Yorum: ${STATUS_LABEL[status]}`);
      patchLocal(r.id, tab === status ? { status } : null);
      loadStats();
    } catch (e) {
      toast.error(errorMessage(e, 'İşlem yapılamadı.'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Review) => {
    const ok = await confirm({
      title: 'Yorum silinsin mi?',
      message: 'Yorum ve fotoğrafları kalıcı olarak silinir. Bu işlem geri alınamaz.',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await deleteReviewAction(r.id);
      toast.success('Yorum silindi.');
      patchLocal(r.id, null);
      loadStats();
    } catch (e) {
      toast.error(errorMessage(e, 'Silinemedi.'));
    } finally {
      setBusyId(null);
    }
  };

  const saveReply = async (r: Review, text: string, setSaving: (v: boolean) => void) => {
    setSaving(true);
    try {
      await setReviewReplyAction(r.id, text);
      patchLocal(r.id, { adminReply: text.trim() || undefined });
      toast.success(text.trim() ? 'Yanıt kaydedildi.' : 'Yanıt kaldırıldı.');
    } catch (e) {
      toast.error(errorMessage(e, 'Yanıt kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="yor-page">
      <div className="yor-head">
        <div>
          <h1 className="adm-page-title">Müşteri yorumları</h1>
          <p className="adm-page-sub">Onayladıklarınız sitede görünür. Yorum istemek için müşteriye bağlantı oluşturun.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
          <IconPlus size={16} /> Yorum bağlantısı oluştur
        </button>
      </div>

      <div className="adm-stat-grid">
        <div className="card adm-stat">
          <span className="adm-stat-value">{stats ? stats.pending : '–'}</span>
          <span className="adm-stat-label">Onay bekleyen</span>
        </div>
        <div className="card adm-stat">
          <span className="adm-stat-value">{stats ? stats.approved : '–'}</span>
          <span className="adm-stat-label">Yayında</span>
        </div>
        <div className="card adm-stat">
          <span className="adm-stat-value">
            {stats && stats.approved ? stats.average.toLocaleString('tr-TR') : '–'}
          </span>
          <span className="adm-stat-label">Ortalama puan (5 üzerinden)</span>
        </div>
      </div>

      <div className="yor-tabs" role="tablist" aria-label="Yorum durumu">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`yor-tab${tab === k ? ' on' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError && <div className="yor-error" role="alert">Yorumlar yüklenemedi.</div>}

      {loading ? (
        <p className="adm-muted-center">Yükleniyor…</p>
      ) : reviews.length === 0 ? (
        <div className="card adm-empty">
          <IconMessage size={28} />
          <p className="adm-empty-title">Bu bölümde yorum yok</p>
        </div>
      ) : (
        <div className="yor-grid">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              busy={busyId === r.id}
              onModerate={moderate}
              onDelete={remove}
              onSaveReply={saveReply}
            />
          ))}
        </div>
      )}

      <section className="card adm-section">
        <h2 className="adm-section-title">Son gönderilen bağlantılar</h2>
        {invites.length === 0 ? (
          <p className="adm-muted-center">Henüz bağlantı oluşturulmadı.</p>
        ) : (
          <ul className="yor-invites">
            {invites.map((i) => {
              const [label, cls] = inviteLabel(i);
              return (
                <li key={i.token} className="yor-invite">
                  <span>
                    {i.productTitle}
                    <small className="yor-muted"> · {fmtDate(i.createdAt)}</small>
                  </span>
                  <span className={`yor-pill ${cls}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {inviteOpen && (
        <ReviewInviteModal
          onClose={() => {
            setInviteOpen(false);
            loadInvites();
          }}
        />
      )}
      {dialog}
    </div>
  );
}

function ReviewCard({
  review: r,
  busy,
  onModerate,
  onDelete,
  onSaveReply,
}: {
  review: Review;
  busy: boolean;
  onModerate: (r: Review, status: ReviewStatus) => void;
  onDelete: (r: Review) => void;
  onSaveReply: (r: Review, text: string, setSaving: (v: boolean) => void) => void;
}) {
  const [reply, setReply] = useState(r.adminReply ?? '');
  const [savingReply, setSavingReply] = useState(false);
  const replyChanged = reply.trim() !== (r.adminReply ?? '');

  return (
    <article className="card yor-card">
      <div className="yor-card-head">
        <span className="yor-stars" aria-label={`${r.rating} yıldız`}>{stars(r.rating)}</span>
        <small className="yor-muted">{fmtDate(r.createdAt)}</small>
      </div>
      <span className={`yor-pill ${r.status === 'onayli' ? 'ok' : r.status === 'bekliyor' ? 'warn' : ''}`}>{STATUS_LABEL[r.status]}</span>

      <p className="yor-text">{r.text}</p>

      {r.images.length > 0 && (
        <ReviewPhotos
          images={r.images}
          alt="Müşteri fotoğrafı"
          caption={{ rating: r.rating, text: r.text, by: r.name, product: r.productTitle || 'Genel yorum' }}
          size={88}
        />
      )}

      <div className="yor-meta">
        <strong>{displayName(r.name)}</strong> · {r.productTitle || 'Genel yorum'}
      </div>

      <div className="yor-reply">
        <label className="form-label" htmlFor={`reply-${r.id}`}>Yanıt (sitede herkese açık görünür)</label>
        <textarea
          id={`reply-${r.id}`}
          className="form-textarea"
          maxLength={600}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Teşekkür veya açıklama yazın (isteğe bağlı)"
        />
        <div className="yor-reply-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={!replyChanged || savingReply || busy}
            onClick={() => onSaveReply(r, reply, setSavingReply)}
          >
            {savingReply ? 'Kaydediliyor…' : 'Yanıtı kaydet'}
          </button>
        </div>
      </div>

      <div className="yor-actions">
        {r.status !== 'onayli' && (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onModerate(r, 'onayli')}>Yayınla</button>
        )}
        {(r.status === 'bekliyor' || r.status === 'onayli') && (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onModerate(r, 'gizli')}>Gizle</button>
        )}
        {r.status !== 'reddedildi' && (
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => onModerate(r, 'reddedildi')}>Reddet</button>
        )}
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onDelete(r)} aria-label="Yorumu sil">
          <IconTrash size={14} /> Sil
        </button>
      </div>
    </article>
  );
}
