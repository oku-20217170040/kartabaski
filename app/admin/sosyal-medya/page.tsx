'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  getSocialHubAction, runSocialCycleNowAction, setSocialEnabledAction, type SocialHub,
} from '@/lib/actions-social';
import type { CycleResult, SocialPlatform } from '@/lib/social-types';
import { windowLabel } from '@/lib/social-settings-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import {
  IconInstagram, IconFacebook, IconThreads, IconTelegram, IconPinterest, IconTikTok, IconRefresh, IconSend, IconAlert,
} from '@/components/admin/icons';
import { Pill, Switch, fmtWhen, type Tone } from '@/components/admin/social/shared';
import '@/components/admin/social/social.css';

interface IconProps { size?: number }
interface PlatformMeta { key: SocialPlatform; name: string; role: string; href: string; Icon: ComponentType<IconProps> }

const PLATFORMS: PlatformMeta[] = [
  { key: 'instagram', name: 'Instagram', role: 'Karusel, hikâye, blog ve kampanya', href: '/admin/instagram', Icon: IconInstagram },
  { key: 'facebook', name: 'Facebook', role: 'Sayfa gönderisi, blog ve kampanya', href: '/admin/facebook', Icon: IconFacebook },
  { key: 'threads', name: 'Threads', role: 'Görselli gönderi ve blog bağlantısı', href: '/admin/threads', Icon: IconThreads },
  { key: 'telegram', name: 'Telegram', role: 'Kanal gönderisi', href: '/admin/telegram', Icon: IconTelegram },
  { key: 'pinterest', name: 'Pinterest', role: 'Pano pini', href: '/admin/pinterest', Icon: IconPinterest },
  { key: 'tiktok', name: 'TikTok', role: 'Fotoğraf taslağı', href: '/admin/tiktok', Icon: IconTikTok },
];

const nameOf = (p: SocialPlatform) => PLATFORMS.find((x) => x.key === p)?.name ?? p;

function stateOf(configured: boolean, enabled: boolean): { tone: Tone; label: string } {
  if (!configured) return { tone: 'warn', label: 'Bağlı değil' };
  return enabled ? { tone: 'ok', label: 'Açık' } : { tone: 'muted', label: 'Kapalı' };
}

export default function SocialHubPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [hub, setHub] = useState<SocialHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState<SocialPlatform | null>(null);
  const [result, setResult] = useState<Record<SocialPlatform, CycleResult> | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHub(await getSocialHubAction());
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Merkez yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (platform: SocialPlatform, enabled: boolean) => {
    setToggling(platform);
    try {
      await setSocialEnabledAction(platform, enabled);
      toast.success(`${nameOf(platform)} otomasyonu ${enabled ? 'açıldı' : 'kapatıldı'}.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const runNow = async () => {
    const ok = await confirm({
      title: 'Otomasyonu şimdi çalıştır',
      message: 'Açık olan tüm platformların otomasyon turu bir kez çalışır; zamanı gelen taslaklar ve kuyruktaki gönderiler yayınlanır. Bağlı olmayan ya da kapalı platformlar atlanır.',
      confirmLabel: 'Çalıştır',
    });
    if (!ok) return;
    setRunning(true);
    try {
      setResult(await runSocialCycleNowAction());
      toast.success('Otomasyon turu tamamlandı.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Tur çalıştırılamadı.'));
    } finally {
      setRunning(false);
    }
  };

  const anyEnabled = hub?.statuses.some((s) => s.enabled && s.configured) ?? false;

  return (
    <div className="soc-page">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Sosyal Medya</h1>
          <p className="adm-page-sub">Altı platformda ürün, blog ve özel gün paylaşımları tek yerden.</p>
        </div>
        <div className="soc-actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <IconRefresh size={16} /> {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
          <button type="button" className="btn btn-primary" onClick={runNow} disabled={running || loading}>
            <IconSend size={16} /> {running ? 'Çalışıyor…' : 'Şimdi çalıştır'}
          </button>
        </div>
      </div>

      <p className="soc-lead">
        Otomasyon, sunucudaki zamanlayıcı tarafından düzenli aralıklarla çalıştırılır. Bir platformun jetonları tanımlı değilse
        kart <strong>Bağlı değil</strong> gösterir ve o platform sessizce atlanır; jetonlar girilince ek bir işlem gerekmez.
      </p>

      {error && <div className="soc-note err" role="alert"><IconAlert size={14} /> {error}</div>}
      {hub && !anyEnabled && !error && (
        <div className="soc-note warn" style={{ marginBottom: 20 }}>
          Şu an otomatik paylaşım yapan bir platform yok. Jetonlar tanımlandıktan sonra kartlardaki anahtarlarla platformları açın.
        </div>
      )}

      <section className="soc-section" aria-label="Platformlar">
        <div className="soc-grid">
          {PLATFORMS.map(({ key, name, role, href, Icon }) => {
            const st = hub?.statuses.find((s) => s.platform === key);
            const cfg = hub?.settings[key];
            const state = st ? stateOf(st.configured, st.enabled) : { tone: 'muted' as Tone, label: '…' };
            return (
              <article key={key} className="soc-card">
                <div className="soc-card-head">
                  <Link href={href} className="soc-card-id">
                    <span className="soc-card-icon"><Icon size={20} /></span>
                    <span>{name}</span>
                  </Link>
                  <Pill tone={state.tone}>{state.label}</Pill>
                </div>
                <p className="soc-card-note">{role}</p>
                <dl className="soc-kv">
                  <dt>Son paylaşım</dt><dd>{fmtWhen(st?.lastPostAt)}</dd>
                  <dt>Son tur</dt><dd>{fmtWhen(st?.lastRunAt)}</dd>
                  <dt>Kuyruk</dt><dd>{st?.queued ?? '—'}</dd>
                  {cfg && (key === 'instagram' || key === 'facebook' || key === 'threads') && (
                    <><dt>Saat aralığı</dt><dd>{windowLabel(cfg)}</dd></>
                  )}
                </dl>
                {st?.detail && <p className="soc-card-note">{st.detail}</p>}
                <div className="soc-card-foot">
                  <Switch
                    label="Otomasyon"
                    checked={!!st?.enabled}
                    disabled={!st || toggling === key}
                    onChange={(v) => toggle(key, v)}
                  />
                  <Link href={href} className="btn btn-secondary btn-sm">Yönet</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {result && (
        <section className="soc-panel" aria-label="Tur sonucu">
          <h2>Son çalıştırma sonucu</h2>
          <div className="soc-results">
            {PLATFORMS.map(({ key, name }) => {
              const r = result[key];
              if (!r) return null;
              const tone: Tone = r.errors.length ? 'err' : r.skipped && !r.posted.length ? 'warn' : 'ok';
              return (
                <div key={key} className="soc-result">
                  <div className="soc-card-head">
                    <strong>{name}</strong>
                    <Pill tone={tone}>{r.errors.length ? `${r.errors.length} hata` : r.skipped && !r.posted.length ? 'Atlandı' : `${r.posted.length} paylaşım`}</Pill>
                  </div>
                  {r.skipped && !r.posted.length && <span className="soc-muted">{r.skipped}</span>}
                  {r.errors.length > 0 && (
                    <ul className="soc-result-err">{r.errors.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}</ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="soc-section" aria-label="Canlı akış">
        <div className="soc-section-head">
          <h2>Canlı akış</h2>
          <span className="soc-muted">Son paylaşım turları</span>
        </div>
        {!hub || hub.activity.length === 0 ? (
          <div className="soc-empty">Henüz bir paylaşım ya da hata kaydı yok. Platformlar bağlanıp açıldığında burada görünür.</div>
        ) : (
          <div className="soc-panel" style={{ padding: '4px 16px' }}>
            <ul className="soc-feed">
              {hub.activity.map((a) => (
                <li key={a.id} className="soc-feed-item">
                  <span className="soc-feed-time">{fmtWhen(a.at)}</span>
                  <span className="soc-feed-main">
                    {nameOf(a.platform)}
                    <small>
                      {a.labels.length > 0 ? a.labels.slice(0, 3).join(' · ') + (a.labels.length > 3 ? ` +${a.labels.length - 3}` : '') : 'Paylaşım yok'}
                      {a.errors.length > 0 && ` — ${a.errors[0]}`}
                    </small>
                  </span>
                  <Pill tone={a.errors.length ? 'err' : 'ok'}>{a.errors.length ? 'Hata' : `${a.posted.length}`}</Pill>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
