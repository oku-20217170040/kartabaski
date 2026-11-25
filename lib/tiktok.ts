import 'server-only';
import { adminDb } from './firebase-admin';
import { SITE_URL } from './site';
import { buildAuthUrl, buildPhotoDraftBody } from './tiktok-utils';

/**
 * TikTok Content Posting API (v2). Env (yalnızca sunucuda): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
 * Akış: yönetici /admin/tiktok'tan bağlanır, callback token'ı Firestore'a yazar (tiktok_settings/main),
 * günlük döngü ürünleri fotoğraf TASLAĞI (inbox, MEDIA_UPLOAD) olarak gönderir; yayınlama TikTok uygulamasında elle yapılır.
 * Fotoğraflar doğrulanmış alan adımızdan (/tiktok-media/...) çekilir.
 */
const API = 'https://open.tiktokapis.com/v2';
const settingsRef = () => adminDb.collection('tiktok_settings').doc('main');
export const REDIRECT_URI = `${SITE_URL}/api/tiktok/callback`;

export const tiktokConfigured = () => !!((process.env.TIKTOK_CLIENT_KEY ?? '').trim() && (process.env.TIKTOK_CLIENT_SECRET ?? '').trim());
export const tiktokAuthUrl = (state: string) =>
  buildAuthUrl({ clientKey: (process.env.TIKTOK_CLIENT_KEY ?? '').trim(), redirectUri: REDIRECT_URI, state });

export interface TikTokState {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
  openId?: string;
  connectedAt?: number;
  displayName?: string;
}

async function http(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function errOf(json: Record<string, unknown>, status: number): string {
  const e = json.error as { code?: string; message?: string } | string | undefined;
  const d = typeof json.error_description === 'string' ? json.error_description : '';
  if (e && typeof e === 'object' && e.code && e.code !== 'ok') return `${e.code}: ${e.message ?? ''}`.slice(0, 200);
  if (typeof e === 'string') return `${e}: ${d}`.slice(0, 200);
  return d || `TikTok isteği başarısız (${status})`;
}

async function saveTokens(json: Record<string, unknown>, now: number): Promise<void> {
  const access = json.access_token;
  const refresh = json.refresh_token;
  if (typeof access !== 'string' || typeof refresh !== 'string') throw new Error('TikTok token alınamadı');
  await settingsRef().set({
    accessToken: access,
    refreshToken: refresh,
    expiresAt: now + Number(json.expires_in ?? 0) * 1000,
    refreshExpiresAt: now + Number(json.refresh_expires_in ?? 0) * 1000,
    openId: String(json.open_id ?? ''),
    connectedAt: now,
  }, { merge: true });
}

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const r = await http(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: (process.env.TIKTOK_CLIENT_KEY ?? '').trim(),
      client_secret: (process.env.TIKTOK_CLIENT_SECRET ?? '').trim(),
      ...params,
    }).toString(),
  });
  if (!r.ok || r.json.error) throw new Error(errOf(r.json, r.status));
  return r.json;
}

/** Callback: yetkilendirme kodunu token'a çevirir ve saklar. */
export async function exchangeCode(code: string, now = Date.now()): Promise<void> {
  await saveTokens(await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI }), now);
}

export async function getTikTokState(): Promise<TikTokState> {
  return ((await settingsRef().get()).data() ?? {}) as TikTokState;
}

export async function disconnectTikTok(): Promise<void> {
  await settingsRef().delete();
}

/** Geçerli erişim anahtarı; süresi 10 dakikanın altındaysa yeniler. */
async function validAccessToken(now = Date.now()): Promise<string> {
  const s = await getTikTokState();
  if (!s.accessToken || !s.refreshToken) throw new Error('TikTok bağlı değil (/admin/tiktok)');
  if ((s.expiresAt ?? 0) - now > 10 * 60 * 1000) return s.accessToken;
  const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
  await saveTokens(json, now);
  return String(json.access_token);
}

/** Bağlantı testi: bağlı hesabın görünen adı (user.info.basic). */
export async function fetchDisplayName(): Promise<string> {
  const token = await validAccessToken();
  const r = await http(`${API}/user/info/?fields=open_id,display_name`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  const user = (r.json.data as { user?: { display_name?: string } } | undefined)?.user;
  if (!r.ok || !user) throw new Error(errOf(r.json, r.status));
  const name = user.display_name ?? '';
  if (name) await settingsRef().set({ displayName: name }, { merge: true });
  return name;
}

/** Fotoğraf taslağı (inbox) gönderir; publish_id döner. Yayınlama TikTok uygulamasında elle yapılır. */
export async function sendPhotoDraft(input: { title: string; description: string; photoUrls: string[] }): Promise<string> {
  const token = await validAccessToken();
  const r = await http(`${API}/post/publish/content/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(buildPhotoDraftBody(input)),
  });
  const id = (r.json.data as { publish_id?: string } | undefined)?.publish_id;
  const err = r.json.error as { code?: string } | undefined;
  if (!r.ok || (err?.code && err.code !== 'ok') || !id) throw new Error(errOf(r.json, r.status));
  return id;
}

export interface PublishStatus { status: string; failReason?: string }

/** Gönderilen içeriğin gerçek durumu: PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX, PUBLISH_COMPLETE, FAILED… */
export async function fetchPublishStatus(publishId: string): Promise<PublishStatus> {
  const token = await validAccessToken();
  const r = await http(`${API}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const d = r.json.data as { status?: string; fail_reason?: string } | undefined;
  const err = r.json.error as { code?: string } | undefined;
  if (!r.ok || (err?.code && err.code !== 'ok') || !d?.status) throw new Error(errOf(r.json, r.status));
  return { status: d.status, failReason: d.fail_reason };
}
