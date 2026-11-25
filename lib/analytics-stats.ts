import { COUNT_MAPS, NUM_FIELDS, type Counts, type DailyStats } from './analytics-types';
import { mergeCounts } from './analytics-utils';

// Panelde kullanılan saf toplama/hesaplama fonksiyonları (istemci + sunucu).

export function emptyDay(day: string): DailyStats {
  const d = { day } as DailyStats;
  for (const f of NUM_FIELDS) d[f] = 0;
  for (const m of COUNT_MAPS) d[m] = {};
  return d;
}

const toNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Firestore'dan gelen ham belgeyi güvenli DailyStats'a çevirir (eksik/bozuk alanlar 0/{}). */
export function normalizeDay(day: string, raw: Record<string, unknown> | undefined): DailyStats {
  const d = emptyDay(day);
  if (!raw) return d;
  for (const f of NUM_FIELDS) d[f] = toNum(raw[f]);
  for (const m of COUNT_MAPS) {
    const src = raw[m];
    if (src && typeof src === 'object') {
      const out: Counts = {};
      for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        const n = toNum(v);
        if (n) out[k] = n;
      }
      d[m] = out;
    }
  }
  return d;
}

export function mergeDays(a: DailyStats, b: DailyStats): DailyStats {
  const out = emptyDay(a.day);
  for (const f of NUM_FIELDS) out[f] = a[f] + b[f];
  for (const m of COUNT_MAPS) out[m] = mergeCounts(a[m], b[m]);
  return out;
}

export function sumDays(days: DailyStats[], label = 'toplam'): DailyStats {
  return days.reduce((acc, d) => mergeDays(acc, d), emptyDay(label));
}

// ── Tarih yardımcıları (YYYY-MM-DD, UTC aritmetiği: saat dilimi kaymasından etkilenmez) ──

const toUTC = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

/** endDay dahil, geriye doğru n günlük aralık (eskiden yeniye). */
export function dayRange(endDay: string, n: number): string[] {
  const end = toUTC(endDay);
  return Array.from({ length: n }, (_, i) => fromUTC(end - (n - 1 - i) * 86400000));
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export type Grouping = 'day' | 'week' | 'month';

export interface SeriesPoint { label: string; sub: string; pv: number; uv: number; sess: number }

/** Günlük veriyi gün/hafta (Pazartesi başlangıç)/ay olarak gruplar. */
export function groupSeries(days: DailyStats[], by: Grouping): SeriesPoint[] {
  const buckets = new Map<string, SeriesPoint>();
  for (const d of days) {
    const t = toUTC(d.day);
    const dt = new Date(t);
    let key: string, label: string, sub: string;
    if (by === 'day') {
      key = d.day;
      label = String(dt.getUTCDate());
      sub = MONTHS[dt.getUTCMonth()];
    } else if (by === 'week') {
      const dow = (dt.getUTCDay() + 6) % 7; // Pazartesi = 0
      const start = new Date(t - dow * 86400000);
      key = fromUTC(start.getTime());
      label = String(start.getUTCDate());
      sub = MONTHS[start.getUTCMonth()];
    } else {
      key = d.day.slice(0, 7);
      label = MONTHS[dt.getUTCMonth()];
      sub = String(dt.getUTCFullYear());
    }
    const p = buckets.get(key) ?? { label, sub, pv: 0, uv: 0, sess: 0 };
    p.pv += d.pv; p.uv += d.uv; p.sess += d.sess;
    buckets.set(key, p);
  }
  return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export function topEntries(map: Counts, n = 10): [string, number][] {
  return Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Sayfa başına ortalama ekranda kalma süresi (saniye). */
export const avgSeconds = (s: DailyStats) => (s.durN > 0 ? s.dur / s.durN : 0);
/** Hemen çıkma: yalnızca tek sayfa gezen oturumların oranı (0-1). */
export const bounceRate = (s: DailyStats) => (s.sess > 0 ? Math.max(0, 1 - s.multi / s.sess) : 0);
/** Geri dönen ziyaretçi oranı (0-1). */
export const returningShare = (s: DailyStats) => (s.uv > 0 ? Math.max(0, (s.uv - s.newV) / s.uv) : 0);

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  return `${m} dk ${String(s % 60).padStart(2, '0')} sn`;
}

export const fmtInt = (n: number) => new Intl.NumberFormat('tr-TR').format(Math.round(n));
export const fmtShare = (x: number) => `%${Math.round(x * 100)}`;
