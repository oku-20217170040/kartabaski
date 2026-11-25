import { createSign } from 'crypto';
import type { GscRow } from './search-console-format';

// Biçimleme tarayıcıda da kullanılır: crypto içermeyen ayrı dosyada; burada geriye uyum için yeniden dışa aktarılır.
export { fmtCtr, fmtPos, pctChange, type GscRow } from './search-console-format';

// Google Search Console için saf yardımcılar (testli). Ağ erişimi lib/search-console.ts'te.

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Search Console verisi 2-3 gün gecikmeli oturur; bitiş tarihi bu kadar gün geriden alınır. */
export const GSC_LAG_DAYS = 2;

const b64url = (v: Buffer | string) =>
  Buffer.from(v).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Hizmet hesabı için OAuth JWT assertion üretir (RS256). `nowSec`: saniye cinsinden şimdiki zaman. */
export function buildJwtAssertion(opts: { email: string; privateKey: string; scope: string; nowSec: number }): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: opts.email,
    scope: opts.scope,
    aud: GOOGLE_TOKEN_URL,
    iat: opts.nowSec,
    exp: opts.nowSec + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(opts.privateKey))}`;
}

const toUTC = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

/** `days` günlük aralık: bitiş = bugün − gecikme, başlangıç = bitiş − (days − 1). `today` YYYY-MM-DD. */
export function gscDateRange(days: number, today: string, lag = GSC_LAG_DAYS): { startDate: string; endDate: string } {
  const n = Math.min(Math.max(Math.floor(days) || 1, 1), 480);
  const end = toUTC(today) - lag * 86400000;
  return { startDate: fromUTC(end - (n - 1) * 86400000), endDate: fromUTC(end) };
}

/** Aynı uzunluktaki bir önceki dönem (karşılaştırma için): başlangıçtan hemen önce biter. */
export function gscPrevRange(range: { startDate: string; endDate: string }): { startDate: string; endDate: string } {
  const start = toUTC(range.startDate);
  const n = Math.round((toUTC(range.endDate) - start) / 86400000) + 1;
  return { startDate: fromUTC(start - n * 86400000), endDate: fromUTC(start - 86400000) };
}


export interface GscSite { siteUrl: string; permissionLevel: string }

/** Hizmet hesabının erişebildiği mülkler arasından siteye uygun olanı seçer (alan adı mülkü önce). */
export function pickSite(sites: GscSite[], host = 'kartabaski.com'): string | null {
  const ok = sites.filter((s) => s.permissionLevel !== 'siteUnverifiedUser');
  const order = [`sc-domain:${host}`, `https://www.${host}/`, `https://${host}/`, `http://www.${host}/`, `http://${host}/`];
  for (const o of order) {
    const hit = ok.find((s) => s.siteUrl === o);
    if (hit) return hit.siteUrl;
  }
  return ok.find((s) => s.siteUrl.includes(host))?.siteUrl ?? null;
}


const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** API satırlarını sadeleştirir (ctr 0-1 → yüzde değil oran olarak kalır; gösterimde biçimlenir). */
export function mapRows(rows: unknown): GscRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: { keys?: unknown; clicks?: unknown; impressions?: unknown; ctr?: unknown; position?: unknown }) => ({
    key: Array.isArray(r.keys) ? String(r.keys[0] ?? '') : '',
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    ctr: num(r.ctr),
    position: num(r.position),
  }));
}


/** Google hata gövdesinden anlaşılır Türkçe ipucu üretir. */
export function explainGscError(status: number, message: string, email: string): string {
  const m = message.toLowerCase();
  if (m.includes('has not been used') || m.includes('service_disabled') || m.includes('accessnotconfigured')) {
    return 'Google Cloud\'da "Google Search Console API" etkin değil. Etkinleştirin (console.cloud.google.com → API\'ler → Search Console API → Etkinleştir).';
  }
  if (status === 403 || m.includes('does not have sufficient permission') || m.includes('not have access')) {
    return `Search Console erişimi yok: ${email} adresini Search Console'da kullanıcı olarak ekleyin (Ayarlar → Kullanıcılar ve izinler).`;
  }
  return message ? message.slice(0, 200) : `Search Console isteği başarısız (${status})`;
}
