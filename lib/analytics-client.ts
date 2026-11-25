'use client';

import type { EventName, TrackPayload } from './analytics-types';

// İstemci tarafı ortak yardımcılar. Tüm depolama erişimleri try/catch'li: gizli mod/kapalı depolama siteyi bozmaz.
export const VID_KEY = 'karta-vid';      // cihazdaki rastgele ziyaretçi kimliği (kişisel veri değil)
export const DAY_KEY = 'karta-vday';     // en son görüldüğü gün
export const SID_KEY = 'karta-sid';      // oturum (sekme) kimliği
export const SN_KEY = 'karta-sn';        // oturumdaki sayfa sırası
export const NOTRACK_KEY = 'karta-notrack';
const PU_KEY = 'karta-pu';               // bugün bu cihazda açılmış ürünler (tekil görüntüleme için)

export const ls = {
  get: (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* yok say */ } },
};
export const ss = {
  get: (k: string) => { try { return window.sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { window.sessionStorage.setItem(k, v); } catch { /* yok say */ } },
};

/** Bu cihaz sayılmasın mı? (admin cihazları, "İzleme yapma" tarayıcı ayarı) */
export function trackingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (ls.get(NOTRACK_KEY) === '1') return false;
  if (navigator.doNotTrack === '1') return false;
  return true;
}

/** Bu cihazı istatistiklerden hariç tut / geri al. Admin girişinde `setNoTrack(true)` çağrılabilir. */
export function setNoTrack(on: boolean): void {
  try { if (on) ls.set(NOTRACK_KEY, '1'); else window.localStorage.removeItem(NOTRACK_KEY); } catch { /* yok say */ }
}
export const isNoTrack = () => ls.get(NOTRACK_KEY) === '1';

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Ziyaretçi kimliğini döner; yoksa oluşturur (yeni ziyaretçi bilgisi ile). */
export function getVisitor(): { vid: string; isNew: boolean } {
  const existing = ls.get(VID_KEY);
  if (existing && existing.length >= 8) return { vid: existing, isNew: false };
  const vid = uuid();
  ls.set(VID_KEY, vid);
  return { vid, isNew: true };
}

export const todayIstanbul = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

export function sendTrack(body: TrackPayload): void {
  try {
    const json = JSON.stringify(body);
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([json], { type: 'application/json' }))) return;
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
  } catch { /* analitik hatası akışı bozmasın */ }
}

/** Bu ürün bu cihazda bugün ilk kez mi açılıyor? İlk kezse kaydeder (en fazla 300 ürün). */
export function firstProductViewToday(slug: string, today: string): boolean {
  let data: { d: string; s: string[] } = { d: today, s: [] };
  try {
    const raw = ls.get(PU_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.d === today && Array.isArray(parsed.s)) data = parsed;
  } catch { /* bozuk kayıt: sıfırdan başla */ }
  if (data.s.includes(slug)) return false;
  data.s = [...data.s, slug].slice(-300);
  ls.set(PU_KEY, JSON.stringify(data));
  return true;
}

// Eski/kısa adlar → standart olay adı
const ALIASES: Record<string, EventName> = {
  wa: 'whatsapp', whatsapp_click: 'whatsapp', add_to_cart: 'cart_add',
  cart_request: 'cart_send', blog: 'blog_read', filter_change: 'filter',
};

/**
 * Anonim bir olay gönderir (hata fırlatmaz, izleme kapalıysa sessizce çıkar).
 * type: 'whatsapp' | 'cart_add' | 'cart_send' | 'blog_read' | 'search' | 'filter'
 * props: slug (ürün id/slug ya da blog slug), src (WhatsApp düğmesi: hero/float/urun/sepet),
 *        q (arama/filtre metni), zero (1 = sonuç yok).
 * Sayfa ve ürün görüntüleme SiteTracker tarafından otomatik gönderilir; ayrıca çağırmaya gerek yok.
 */
export function trackEvent(type: string, props: Record<string, string | number> = {}): void {
  try {
    if (!trackingEnabled()) return;
    const ev = ALIASES[type] ?? type;
    const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
    sendTrack({
      t: 'ev',
      vid: getVisitor().vid,
      ev,
      slug: str(props.slug),
      src: str(props.src),
      q: str(props.q),
      ...(props.zero ? { zero: true } : {}),
    });
  } catch { /* analitik hatası kullanıcı akışını bozmasın */ }
}
