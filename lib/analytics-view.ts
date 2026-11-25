import type { Counts, DailyStats } from './analytics-types';
import { sumDays, topEntries, avgSeconds, bounceRate } from './analytics-stats';
import { AI_SOURCES, sourceGroup, sourceLabel, type SourceGroup } from './analytics-utils';

// İstatistik sayfası için saf hesaplamalar (testli). Veri: günlük toplam sayaçlar (kişi bazında kayıt yok).

/** Aynı anahtar adına düşen sayaçları birleştirir (ör. eski "chatgpt.com" + yeni "ChatGPT"). */
export function mergeByLabel(map: Counts, label: (k: string) => string): Counts {
  const out: Counts = {};
  for (const [k, v] of Object.entries(map)) {
    const l = label(k);
    out[l] = (out[l] || 0) + v;
  }
  return out;
}

/** Son `n` gün ve ondan önceki `n` gün (yeterli veri yoksa prev null). `days` eskiden yeniye. */
export function splitPeriods(days: DailyStats[], n: number): { cur: DailyStats[]; prev: DailyStats[] | null } {
  const cur = days.slice(-n);
  const prev = days.length >= n * 2 ? days.slice(-n * 2, -n) : null;
  return { cur, prev };
}

/** Yüzde değişim; önceki 0 ise null. */
export const delta = (cur: number, prev: number): number | null => (prev ? (cur - prev) / prev : null);

export const SOURCE_GROUPS: SourceGroup[] = ['Arama motoru', 'Sosyal medya', 'Yapay zeka', 'Doğrudan', 'Diğer siteler'];

/** Trafik kaynaklarını gruplar (oturum sayısı). Boş gruplar da 0 olarak döner. */
export function groupSources(ref: Counts): { group: SourceGroup; value: number }[] {
  const totals = new Map<SourceGroup, number>(SOURCE_GROUPS.map((g) => [g, 0]));
  for (const [k, v] of Object.entries(ref)) {
    const g = sourceGroup(sourceLabel(k));
    totals.set(g, (totals.get(g) || 0) + v);
  }
  return SOURCE_GROUPS.map((group) => ({ group, value: totals.get(group) || 0 }));
}

/**
 * Yapay zeka asistanlarından gelen oturumlar (hepsi listelenir, gelmeyenler 0).
 * Kaynak sayacı ile utm sayacı aynı oturumu iki kez sayabileceği için toplanmaz, büyüğü alınır.
 */
export function aiBreakdown(ref: Counts, utm: Counts): { name: string; value: number }[] {
  const r = mergeByLabel(ref, sourceLabel);
  const u = mergeByLabel(utm, sourceLabel);
  return AI_SOURCES.map((name) => ({ name, value: Math.max(r[name] || 0, u[name] || 0) }))
    .sort((a, b) => b.value - a.value || AI_SOURCES.indexOf(a.name) - AI_SOURCES.indexOf(b.name));
}

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Haftanın günlerine göre ortalama ziyaretçi (gün sayısına bölünür; az veri olan gün yanıltmasın). */
export function weekdayAverages(days: DailyStats[]): { label: string; value: number }[] {
  const sum = new Array(7).fill(0);
  const cnt = new Array(7).fill(0);
  for (const d of days) {
    const [y, m, dd] = d.day.split('-').map(Number);
    const i = (new Date(Date.UTC(y, (m || 1) - 1, dd || 1)).getUTCDay() + 6) % 7;
    sum[i] += d.uv;
    cnt[i] += 1;
  }
  return WEEKDAYS.map((label, i) => ({ label, value: cnt[i] ? sum[i] / cnt[i] : 0 }));
}

export interface DayRow {
  day: string;
  weekday: string;
  uv: number; newV: number; pv: number; sess: number;
  avgSec: number; bounce: number;
  wa: number; cart: number;
  topSource: string | null;
}

/** Gün gün özet satırları (yeniden eskiye). */
export function dayRows(days: DailyStats[]): DayRow[] {
  return [...days].reverse().map((d) => {
    const [y, m, dd] = d.day.split('-').map(Number);
    const wd = (new Date(Date.UTC(y, (m || 1) - 1, dd || 1)).getUTCDay() + 6) % 7;
    const src = topEntries(mergeByLabel(d.ref, sourceLabel), 1)[0];
    return {
      day: d.day,
      weekday: WEEKDAYS[wd],
      uv: d.uv, newV: d.newV, pv: d.pv, sess: d.sess,
      avgSec: avgSeconds(d), bounce: bounceRate(d),
      wa: d.ev.whatsapp || 0, cart: d.ev.cart_add || 0,
      topSource: src ? src[0] : null,
    };
  });
}

export interface ProductRow { slug: string; views: number; unique: number; avgSec: number; wa: number; cart: number; rate: number }

/** Ürün tablosu: görüntüleme, tekil görüntüleme, süre, WhatsApp, sepet ve ilgi oranı ((WA+sepet)/görüntüleme). */
export function productRows(s: DailyStats, n = 15): ProductRow[] {
  return topEntries(s.prod, n).map(([slug, views]) => {
    const dn = s.prodDurN[slug] || 0;
    const wa = s.pwa[slug] || 0;
    const cart = s.pcart[slug] || 0;
    return { slug, views, unique: s.prodU?.[slug] || 0, avgSec: dn ? (s.prodDur[slug] || 0) / dn : 0, wa, cart, rate: views ? (wa + cart) / views : 0 };
  });
}

export { sumDays };

export interface BlogRow { slug: string; views: number }

/** En çok okunan blog yazıları (sayfa açılışı). */
export function blogRows(s: DailyStats, n = 10): BlogRow[] {
  return topEntries(s.blog, n).map(([slug, views]) => ({ slug, views }));
}

/** Etkileşim hunisi sayıları: sayfa → ürün → WhatsApp/sepet → sepet gönderimi. */
export function funnel(s: DailyStats): { label: string; value: number }[] {
  const prodViews = Object.values(s.prod).reduce((a, b) => a + b, 0);
  return [
    { label: 'Sayfa görüntüleme', value: s.pv },
    { label: 'Ürün görüntüleme', value: prodViews },
    { label: 'Sepete ekleme', value: s.ev.cart_add || 0 },
    { label: 'Sepet gönderildi', value: s.ev.cart_send || 0 },
    { label: 'WhatsApp tıklaması', value: s.ev.whatsapp || 0 },
  ];
}
