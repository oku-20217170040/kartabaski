import 'server-only';

import { buildJwtAssertion, explainGscError, gscDateRange, gscPrevRange, GSC_SCOPE, GOOGLE_TOKEN_URL, mapRows, pickSite, type GscRow, type GscSite } from './search-console-utils';
import { istanbulParts } from './analytics-utils';
import { SITE_URL } from './site';

/**
 * Google Search Console (Search Analytics API, salt okunur). Kimlik: sitenin Firebase Admin hizmet hesabı
 * (FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY). O e-postanın Search Console'da kullanıcı olarak
 * eklenmesi ve Google Cloud'da "Search Console API"nin etkin olması gerekir. Firestore okuması yapmaz.
 */
const API = 'https://www.googleapis.com/webmasters/v3';
/** Hizmet hesabı env'leri tanımlı mı? (değilse Search Console 'bağlı değil' gösterilir) */
export const searchConsoleConfigured = () => Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY);
const email = () => process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '';
const privateKey = () => (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

let cached: { token: string; expMs: number } | null = null;

async function accessToken(now = Date.now()): Promise<string> {
  if (cached && cached.expMs - now > 60_000) return cached.token;
  if (!email() || !privateKey()) throw new Error('Hizmet hesabı bilgileri tanımlı değil');
  const assertion = buildJwtAssertion({ email: email(), privateKey: privateKey(), scope: GSC_SCOPE, nowSec: Math.floor(now / 1000) });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google yetkilendirme hatası: ${(json.error_description ?? res.status).toString().slice(0, 160)}`);
  cached = { token: json.access_token, expMs: now + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function call(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25_000),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(explainGscError(res.status, json.error?.message ?? '', email()));
  return json;
}

export interface GscTotals { clicks: number; impressions: number; ctr: number; position: number }

export interface SearchPerformance {
  site: string;
  startDate: string;
  endDate: string;
  totals: GscTotals;
  prevTotals: GscTotals; // aynı uzunlukta bir önceki dönem
  daily: GscRow[];       // key = YYYY-MM-DD
  queries: GscRow[];
  pages: GscRow[];
  devices: GscRow[];     // key = MOBILE / DESKTOP / TABLET
  countries: GscRow[];   // key = ISO-3166 alpha-3 (ör. tur)
}

const EMPTY_TOTALS: GscTotals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
const toTotals = (rows: unknown): GscTotals => {
  const t = mapRows(rows)[0];
  return t ? { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position } : EMPTY_TOTALS;
};

async function query(site: string, body: Record<string, unknown>): Promise<unknown> {
  const json = await call(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', body: JSON.stringify(body) });
  return json.rows;
}

/** Son `days` günün (2 gün gecikmeli) arama performansı: toplam, en çok aranan sorgular ve en çok görünen sayfalar. */
export async function getSearchPerformance(days = 28): Promise<SearchPerformance> {
  const sites = ((await call('/sites')).siteEntry as GscSite[] | undefined) ?? [];
  const site = pickSite(sites, new URL(SITE_URL).hostname.replace(/^www\./, ''));
  if (!site) throw new Error(`Search Console'da erişilebilir bir kartabaski.com mülkü yok: ${email()} adresini kullanıcı olarak ekleyin (Ayarlar → Kullanıcılar ve izinler).`);
  // dataState 'all': henüz kesinleşmemiş taze veriyi de getirir; dünün değeri gün içinde biraz eksik olabilir
  const range = gscDateRange(days, istanbulParts().day, 1);
  const { startDate, endDate } = range;
  const base = { startDate, endDate, dataState: 'all' };
  const [totalRows, prevRows, dailyRows, queryRows, pageRows, deviceRows, countryRows] = await Promise.all([
    query(site, base),
    query(site, { ...gscPrevRange(range), dataState: 'all' }),
    query(site, { ...base, dimensions: ['date'], rowLimit: 500 }),
    query(site, { ...base, dimensions: ['query'], rowLimit: 30 }),
    query(site, { ...base, dimensions: ['page'], rowLimit: 15 }),
    query(site, { ...base, dimensions: ['device'], rowLimit: 5 }),
    query(site, { ...base, dimensions: ['country'], rowLimit: 8 }),
  ]);
  return {
    site,
    startDate,
    endDate,
    totals: toTotals(totalRows),
    prevTotals: toTotals(prevRows),
    daily: mapRows(dailyRows).sort((a, b) => a.key.localeCompare(b.key)),
    queries: mapRows(queryRows),
    pages: mapRows(pageRows),
    devices: mapRows(deviceRows),
    countries: mapRows(countryRows),
  };
}
