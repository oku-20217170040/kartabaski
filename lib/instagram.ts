import 'server-only';
import { adminDb } from './firebase-admin';

/**
 * Instagram API with Instagram Login (graph.instagram.com): Facebook Sayfası gerekmez.
 * Gerekli: Business/Creator hesap (@kartabaskii) + Meta uygulaması + panelden "Generate token" (60 gün geçerli).
 * Token ilk kurulumda env'den (INSTAGRAM_ACCESS_TOKEN) ya da panelden okunur, sonra yenilenip Firestore'da
 * (instagram_settings/main, yalnız Admin SDK) saklanır; env'e geri yazılmaz.
 * Açık/kapalı ve kota ayarları `social_settings/instagram` belgesindedir (lib/social-settings.ts).
 */
// Sistem kullanıcısı belirteci (Business portföyü + Unified login) graph.facebook.com ile çalışır;
// graph.instagram.com bu belirteci "Cannot parse access token" (kod 190) ile reddeder.
const API = 'https://graph.facebook.com/v26.0';

export interface IgConnection {
  token?: string;
  userId?: string; // Instagram Business Kullanıcı Kimliği
  tokenExpiresAt?: number;
  tokenRefreshedAt?: number;
}

const connRef = () => adminDb.collection('instagram_settings').doc('main');

export async function getConnection(): Promise<IgConnection> {
  const d = (await connRef().get()).data() ?? {};
  return {
    token: typeof d.token === 'string' ? d.token : undefined,
    userId: typeof d.userId === 'string' ? d.userId : undefined,
    tokenExpiresAt: Number(d.tokenExpiresAt) || undefined,
    tokenRefreshedAt: Number(d.tokenRefreshedAt) || undefined,
  };
}

export async function updateConnection(partial: Partial<IgConnection>): Promise<void> {
  await connRef().set(partial, { merge: true });
}

export const envConfigured = () => !!process.env.INSTAGRAM_ACCESS_TOKEN;

/** Instagram'a bağlanılabilir mi? (env ya da panelden kaydedilmiş token). */
export async function isConnected(): Promise<boolean> {
  if (envConfigured()) return true;
  return !!(await getConnection().catch((): IgConnection => ({}))).token;
}

async function currentToken(): Promise<string> {
  const s = await getConnection();
  const t = s.token || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!t) throw new Error('INSTAGRAM_ACCESS_TOKEN tanımlı değil');
  return t;
}

async function http(url: string, init?: RequestInit, timeoutMs = 25_000): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function errMessage(json: Record<string, unknown>, fallback: string): string {
  const e = json.error as { message?: string; code?: number } | undefined;
  return e?.message ? `${e.message}${e.code ? ` (kod ${e.code})` : ''}` : fallback;
}

async function call(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const token = await currentToken();
  const r = await http(`${API}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(errMessage(r.json, `Instagram isteği başarısız (${r.status})`));
  return r.json;
}

/**
 * Sistem kullanıcısı belirteci yenilenmez (süresi dolmaz; Meta'nın ig_refresh_token akışı yalnız
 * Instagram Login belirteçleri içindir). Bu yüzden yenileme atlanır ve durum "yenileme gerekmiyor" döner.
 */
export async function refreshTokenIfNeeded(): Promise<{ refreshed: boolean; expiresAt?: number; error?: string }> {
  const s = await getConnection().catch((): IgConnection => ({}));
  return { refreshed: false, expiresAt: s.tokenExpiresAt };
}

/** Bağlantı testi: panelde girilen (ya da INSTAGRAM_USER_ID) Instagram hesap kimliğiyle hesabı okur. */
export async function whoAmI(): Promise<{ ok: boolean; username?: string; userId?: string; error?: string }> {
  try {
    const token = await currentToken();
    const s = await getConnection();
    const uid = s.userId || process.env.INSTAGRAM_USER_ID;
    if (!uid) return { ok: false, error: 'Hesap kimliği gerekli (panelde "Hesap kimliği" alanına girin)' };
    const r = await http(`${API}/${encodeURIComponent(uid)}?fields=id,username&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return { ok: false, error: errMessage(r.json, `hata ${r.status}`) };
    const userId = String(r.json.id ?? uid);
    const username = String(r.json.username ?? '');
    await connRef().set({ userId }, { merge: true });
    return { ok: true, username, userId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'bağlanılamadı' };
  }
}

/** Cloudinary dönüşümünü önceden üretir/doğrular: Meta görseli kendisi çekeceği için hazır ve JPEG olmalı. */
async function warmImage(url: string): Promise<void> {
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  const type = res?.headers.get('content-type') ?? '';
  if (!res || !res.ok || !type.includes('jpeg')) {
    throw new Error(`Görsel üretilemedi (${res?.status ?? 'ağ'}${res?.headers.get('x-cld-error') ? `: ${res.headers.get('x-cld-error')}` : ''})`);
  }
  await res.arrayBuffer();
}

async function waitFinished(containerId: string): Promise<void> {
  const token = await currentToken();
  for (let i = 0; i < 12; i++) {
    const r = await http(`${API}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const code = String(r.json.status_code ?? '');
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Instagram görseli işleyemedi (${code})`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Instagram görseli zamanında işlenemedi');
}

async function getResolvedUserId(): Promise<string> {
  const s = await getConnection();
  const id = s.userId || process.env.INSTAGRAM_USER_ID;
  if (id) return id;
  const who = await whoAmI().catch(() => null);
  if (who?.ok && who.userId) return who.userId;
  throw new Error('INSTAGRAM_USER_ID tanımlı değil. Lütfen panelden hesap kimliğini girin.');
}

async function publishContainer(containerId: string): Promise<string> {
  await waitFinished(containerId);
  const uid = await getResolvedUserId();
  const r = await call(`${uid}/media_publish`, { creation_id: containerId });
  return String(r.id);
}

/** 2-10 görselli gönderi (karusel). Dönen: yayınlanan medya kimliği. */
export async function publishCarousel(imageUrls: string[], caption: string): Promise<string> {
  if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error('Karusel 2-10 görsel ister');
  const uid = await getResolvedUserId();
  // Görseller paralel hazırlanır (sıra korunur)
  const children = await Promise.all(
    imageUrls.map(async (url) => {
      await warmImage(url);
      const r = await call(`${uid}/media`, { image_url: url, is_carousel_item: 'true' });
      return String(r.id);
    })
  );
  await Promise.all(children.map((id) => waitFinished(id)));
  const c = await call(`${uid}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
  return publishContainer(String(c.id));
}

/** Tek görselli hikâye. */
export async function publishStory(imageUrl: string): Promise<string> {
  await warmImage(imageUrl);
  const uid = await getResolvedUserId();
  const r = await call(`${uid}/media`, { image_url: imageUrl, media_type: 'STORIES' });
  return publishContainer(String(r.id));
}

/** Tek görselli akış gönderisi. */
export async function publishSinglePost(imageUrl: string, caption: string): Promise<string> {
  await warmImage(imageUrl);
  const uid = await getResolvedUserId();
  const r = await call(`${uid}/media`, { image_url: imageUrl, caption });
  return publishContainer(String(r.id));
}
