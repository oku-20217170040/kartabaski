'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { SocialSettings } from '@/lib/social-settings-utils';
import './social.css';

// Merkez ve platform sayfalarının ortak küçük bileşenleri (önek: .soc-).

export type Tone = 'ok' | 'warn' | 'err' | 'muted';

export function Pill({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`soc-pill ${tone === 'muted' ? '' : tone}`}>
      <span className="soc-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className="soc-switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="soc-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

const TZ = 'Europe/Istanbul';

/** "25 Kas 14:30" (TSİ). Boş/0 ise "—". */
export function fmtWhen(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function fmtDay(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ });
}

/** Token bitişine kalan gün; yoksa undefined. */
export function daysLeft(expiresAt?: number): number | undefined {
  return expiresAt ? Math.floor((expiresAt - Date.now()) / 86400000) : undefined;
}

export const hhmm = (ts: number) => new Date(ts + 3 * 3600 * 1000).toISOString().slice(11, 16);

/**
 * Günlük kota + saat aralığı formu. `onSave` yalnızca değişen alanları değil, formdaki tüm değerleri gönderir;
 * sunucu değerleri doğrulayıp sınırlar.
 */
export function SettingsForm({
  settings, showStory, busy, onSave, feedLabel = 'Günlük gönderi',
}: {
  settings: SocialSettings;
  showStory?: boolean;
  busy?: boolean;
  feedLabel?: string;
  onSave: (v: Pick<SocialSettings, 'dailyLimit' | 'storyLimit' | 'windowStart' | 'windowEnd'>) => void;
}) {
  const [daily, setDaily] = useState(String(settings.dailyLimit));
  const [story, setStory] = useState(String(settings.storyLimit));
  const [start, setStart] = useState(String(settings.windowStart));
  const [end, setEnd] = useState(String(settings.windowEnd));

  useEffect(() => {
    setDaily(String(settings.dailyLimit));
    setStory(String(settings.storyLimit));
    setStart(String(settings.windowStart));
    setEnd(String(settings.windowEnd));
  }, [settings.dailyLimit, settings.storyLimit, settings.windowStart, settings.windowEnd]);

  const n = (v: string, d: number) => (v.trim() === '' || Number.isNaN(Number(v)) ? d : Number(v));
  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="soc-panel">
      <h2>Kota ve saat aralığı</h2>
      <p className="soc-muted">Otomasyon yalnızca bu saatler arasında (TSİ) ve günlük kotayı aşmadan paylaşım yapar.</p>
      <div className="soc-form-row">
        <div className="soc-field">
          <label htmlFor="soc-daily">{feedLabel}</label>
          <input id="soc-daily" type="number" inputMode="numeric" min={0} max={10} value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
        {showStory && (
          <div className="soc-field">
            <label htmlFor="soc-story">Günlük hikâye</label>
            <input id="soc-story" type="number" inputMode="numeric" min={0} max={10} value={story} onChange={(e) => setStory(e.target.value)} />
          </div>
        )}
        <div className="soc-field">
          <label htmlFor="soc-start">Başlangıç saati</label>
          <select id="soc-start" value={start} onChange={(e) => setStart(e.target.value)}>
            {hours.slice(0, 24).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </div>
        <div className="soc-field">
          <label htmlFor="soc-end">Bitiş saati</label>
          <select id="soc-end" value={end} onChange={(e) => setEnd(e.target.value)}>
            {hours.slice(1).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onSave({ dailyLimit: n(daily, settings.dailyLimit), storyLimit: n(story, settings.storyLimit), windowStart: n(start, settings.windowStart), windowEnd: n(end, settings.windowEnd) })}
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}
