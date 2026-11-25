import 'server-only';
import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { SITE_URL } from './site';
import { buildPinterestAuthUrl, type PinterestBoard } from './pinterest-utils';

/**
 * Pinterest API v5. Gerekli env (yalnızca sunucuda): PINTEREST_ACCESS_TOKEN.
 * İsteğe bağlı: PINTEREST_REFRESH_TOKEN + PINTEREST_APP_ID + PINTEREST_APP_SECRET (token kendiliğinden yenilenir,
 * yenilenen değerler Firestore'da pinterest_settings/main'de saklanır), PINTEREST_API_BASE
 * (varsayılan https://api.pinterest.com/v5; Trial/sandbox için https://api-sandbox.pinterest.com/v5).
 * Not: Trial erişimde oluşturulan pinler yalnızca hesap sahibine görünür; herkese açık için Standard erişim gerekir.
 */
const settingsRef = () => adminDb.collection('pinterest_settings').doc('main');
const base = () => (process.env.PINTEREST_API_BASE || 'https://api.pinterest.com/v5').replace(/\/+$/, '');
const DAY = 24 * 3600 * 1000;
const REFRESH_WHEN_LEFT_MS = 5 * DAY;

export const PINTEREST_REDIRECT_URI = `${SITE_URL}/api/pinterest/callback`;
const appId = () => (process.env.PINTEREST_APP_ID ?? '').trim();
const appSecret = () => (process.env.PINTEREST_APP_SECRET ?? '').trim();

/** Elle girilen env token'ı ya da "Pinterest'e bağlan" ile Firestore'a kaydedilen token var mı? */
export async function pinterestConfigured(): Promise<boolean> {
  if (process.env.PINTEREST_ACCESS_TOKEN) return true;
  try {
    const d = (await settingsRef().get()).data() ?? {};
    return typeof d.token === 'string' && !!d.token;
  } catch {
    return false;
  }
}

export const pinterestOAuthReady = () => !!(appId() && appSecret());
export const pinterestAuthUrl = (state: string) => buildPinterestAuthUrl({ appId: appId(), redirectUri: PINTEREST_REDIRECT_URI, state });

async function currentToken(): Promise<string> {
  const d = (await settingsRef().get()).data() ?? {};
  const t = (typeof d.token === 'string' && d.token) || process.env.PINTEREST_ACCESS_TOKEN;
  if (!t) throw new Error('PINTEREST_ACCESS_TOKEN tanımlı değil');
  return t;
}

async function http(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function errMessage(json: Record<string, unknown>, status: number): string {
  const msg = typeof json.message === 'string' ? json.message : '';
  const code = typeof json.code === 'number' ? ` (kod ${json.code})` : '';
  return msg ? `${msg}${code}` : `Pinterest isteği başarısız (${status})`;
}

async function api(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, unknown>> {
  const token = await currentToken();
  const r = await http(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(errMessage(r.json, r.status));
  return r.json;
}

/** Hesabın panoları (en fazla 3 sayfa). */
export async function listBoards(): Promise<PinterestBoard[]> {
  const out: PinterestBoard[] = [];
  let bookmark = '';
  for (let i = 0; i < 3; i++) {
    const json = await api('GET', `/boards?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ''}`);
    for (const it of (json.items as Array<{ id?: string; name?: string }> | undefined) ?? []) {
      if (it.id && it.name) out.push({ id: String(it.id), name: String(it.name) });
    }
    bookmark = typeof json.bookmark === 'string' ? json.bookmark : '';
    if (!bookmark) break;
  }
  return out;
}

/** Pano oluşturur (herkese açık). Pano kimliği döner. */
export async function createBoard(name: string, description = ''): Promise<PinterestBoard> {
  const json = await api('POST', '/boards', { name, description, privacy: 'PUBLIC' });
  const id = String(json.id ?? '');
  if (!id) throw new Error('Pinterest pano kimliği alınamadı');
  return { id, name: String(json.name ?? name) };
}

/** Pin oluşturur: tek görsel düz pin, 2–5 görsel çok görselli (karusel) pin. Pin kimliği döner. */
export async function createPin(input: {
  boardId: string;
  title: string;
  description: string;
  link: string;
  imageUrls: string[];
}): Promise<string> {
  const urls = input.imageUrls.slice(0, 5);
  if (urls.length === 0) throw new Error('Pinterest için görsel yok');
  const media_source = urls.length === 1
    ? { source_type: 'image_url', url: urls[0] }
    : { source_type: 'multiple_image_urls', items: urls.map((url) => ({ url })) };
  const json = await api('POST', '/pins', {
    board_id: input.boardId,
    title: input.title,
    description: input.description,
    link: input.link,
    media_source,
  });
  const id = String(json.id ?? '');
  if (!id) throw new Error('Pinterest pin kimliği alınamadı');
  return id;
}

/**
 * Erişim anahtarı süresi azalınca yeniler (PINTEREST_REFRESH_TOKEN, PINTEREST_APP_ID ve PINTEREST_APP_SECRET varsa).
 * Hata fırlatmaz.
 */
export async function refreshPinterestTokenIfNeeded(now = Date.now()): Promise<{ refreshed: boolean; error?: string }> {
  try {
    const appIdV = appId();
    const secret = appSecret();
    const d = (await settingsRef().get()).data() ?? {};
    const refreshToken = (typeof d.refreshToken === 'string' && d.refreshToken) || process.env.PINTEREST_REFRESH_TOKEN;
    if (!appIdV || !secret || !refreshToken) return { refreshed: false };
    const expiresAt = Number(d.tokenExpiresAt) || 0;
    if (expiresAt && expiresAt - now > REFRESH_WHEN_LEFT_MS) return { refreshed: false };

    const r = await http(`${base()}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${appIdV}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    });
    const next = r.json.access_token;
    const expiresIn = Number(r.json.expires_in);
    if (!r.ok || typeof next !== 'string' || !expiresIn) return { refreshed: false, error: errMessage(r.json, r.status) };
    await settingsRef().set({
      token: next,
      tokenExpiresAt: now + expiresIn * 1000,
      tokenRefreshedAt: now,
      ...(typeof r.json.refresh_token === 'string' ? { refreshToken: r.json.refresh_token } : {}),
    }, { merge: true });
    return { refreshed: true };
  } catch (e) {
    return { refreshed: false, error: e instanceof Error ? e.message : 'token yenilenemedi' };
  }
}

/** Callback: yetkilendirme kodunu token'a çevirir ve saklar (admin "Pinterest'e bağlan" akışı). */
export async function exchangePinterestCode(code: string, now = Date.now()): Promise<void> {
  if (!pinterestOAuthReady()) throw new Error('PINTEREST_APP_ID / PINTEREST_APP_SECRET tanımlı değil');
  const r = await http(`${base()}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId()}:${appSecret()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: PINTEREST_REDIRECT_URI }).toString(),
  });
  const token = r.json.access_token;
  const expiresIn = Number(r.json.expires_in);
  if (!r.ok || typeof token !== 'string' || !expiresIn) throw new Error(errMessage(r.json, r.status));
  await settingsRef().set({
    token,
    tokenExpiresAt: now + expiresIn * 1000,
    connectedAt: now,
    ...(typeof r.json.refresh_token === 'string' ? { refreshToken: r.json.refresh_token } : {}),
    ...(Number(r.json.refresh_token_expires_in) ? { refreshTokenExpiresAt: now + Number(r.json.refresh_token_expires_in) * 1000 } : {}),
  }, { merge: true });
}

export interface PinterestConnection { connected: boolean; viaOAuth: boolean; connectedAt?: number; tokenExpiresAt?: number }

export async function getPinterestConnection(): Promise<PinterestConnection> {
  const d = (await settingsRef().get()).data() ?? {};
  const viaOAuth = typeof d.token === 'string' && !!d.token && !!d.connectedAt;
  return {
    connected: viaOAuth || !!process.env.PINTEREST_ACCESS_TOKEN,
    viaOAuth,
    connectedAt: Number(d.connectedAt) || undefined,
    tokenExpiresAt: Number(d.tokenExpiresAt) || undefined,
  };
}

/** Bağlantıyı kaldırır: Firestore'daki token'lar silinir (env token'ı varsa o kalır). */
export async function disconnectPinterest(): Promise<void> {
  await settingsRef().set({
    token: FieldValue.delete(),
    refreshToken: FieldValue.delete(),
    tokenExpiresAt: FieldValue.delete(),
    refreshTokenExpiresAt: FieldValue.delete(),
    connectedAt: FieldValue.delete(),
  }, { merge: true });
}
