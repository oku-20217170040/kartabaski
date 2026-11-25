import 'server-only';
import { adminDb } from './firebase-admin';

/**
 * Threads API (graph.threads.net): Instagram hesabıyla aynı Meta uygulaması üzerinden.
 * Gerekli env (yalnızca sunucuda): THREADS_ACCESS_TOKEN (60 gün; yenilenip Firestore'a yazılır).
 * THREADS_USER_ID isteğe bağlı: yoksa token ile /me sorgulanıp Firestore'a yazılır.
 * İzinler: threads_basic, threads_content_publish (ayrıntı yanıtları için threads_manage_replies).
 * Token yoksa paylaşım atlanır, panel "bağlı değil" gösterir.
 */
const API = 'https://graph.threads.net/v1.0';
const DAY = 24 * 3600 * 1000;
const REFRESH_WHEN_LEFT_MS = 20 * DAY;

const settingsRef = () => adminDb.collection('threads_settings').doc('main');

export const threadsConfigured = () => !!process.env.THREADS_ACCESS_TOKEN;

async function currentToken(): Promise<string> {
  const d = (await settingsRef().get()).data() ?? {};
  const t = (typeof d.token === 'string' && d.token) || process.env.THREADS_ACCESS_TOKEN;
  if (!t) throw new Error('THREADS_ACCESS_TOKEN tanımlı değil');
  return t;
}

/** Kullanıcı kimliği: env, yoksa önbellek, yoksa token ile /me sorgusu (bir kez; Firestore'a yazılır). */
async function currentUserId(): Promise<string> {
  if (process.env.THREADS_USER_ID) return process.env.THREADS_USER_ID;
  const d = (await settingsRef().get()).data() ?? {};
  if (typeof d.userId === 'string' && d.userId) return d.userId;
  const token = await currentToken();
  const r = await http(`${API}/me?fields=id&access_token=${encodeURIComponent(token)}`);
  const id = String(r.json.id ?? '');
  if (!r.ok || !id) throw new Error(errMessage(r.json, 'Threads kullanıcı kimliği alınamadı'));
  await settingsRef().set({ userId: id }, { merge: true });
  return id;
}

async function http(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function errMessage(json: Record<string, unknown>, fallback: string): string {
  const e = json.error as { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } | undefined;
  if (!e?.message) return fallback;
  const code = e.code ? ` (kod ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : '';
  return `${e.message}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''}${code}`;
}

async function post(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const token = await currentToken();
  const r = await http(`${API}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!r.ok) throw new Error(errMessage(r.json, `Threads isteği başarısız (${r.status})`));
  return r.json;
}

/** Hata mesajına hangi adımda olduğunu ekler. */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new Error(`${label}: ${e instanceof Error ? e.message : 'hata'}`);
  }
}

async function warmImage(url: string): Promise<boolean> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res || !res.ok || !(res.headers.get('content-type') ?? '').includes('image')) return false;
  await res.arrayBuffer();
  return true;
}

async function publishContainer(userId: string, creationId: string): Promise<{ id: string; permalink?: string }> {
  if (!creationId) throw new Error('Threads kapsayıcı kimliği alınamadı');
  // Görsel işlenirken yayın reddedilebilir: kısa aralıklarla birkaç kez dene
  let lastErr = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 3000));
    try {
      const pub = await post(`${userId}/threads_publish`, { creation_id: creationId });
      const id = String(pub.id ?? '');
      if (!id) throw new Error('Threads gönderi kimliği alınamadı');
      let permalink: string | undefined;
      try {
        const token = await currentToken();
        const r = await http(`${API}/${id}?fields=permalink&access_token=${encodeURIComponent(token)}`);
        if (r.ok && typeof r.json.permalink === 'string') permalink = r.json.permalink;
      } catch { /* bağlantı alınamazsa gönderi yine de başarılıdır */ }
      return { id, permalink };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'bilinmeyen hata';
    }
  }
  throw new Error(lastErr);
}

/**
 * Görselli gönderi yayınlar: tek görsel düz gönderi, 2+ görsel karusel (en fazla 20).
 * Gönderinin kimliği ve (varsa) kalıcı bağlantısı döner.
 */
export async function publishThreadsMedia(imageUrls: string[], text: string): Promise<{ id: string; permalink?: string }> {
  const candidates = imageUrls.slice(0, 20);
  if (candidates.length === 0) throw new Error('Threads için görsel yok');
  // Meta görseli kendisi çeker: Cloudinary dönüşümü ilk istekte üretildiği için önce biz isteyip hazır olduğunu doğrularız
  const urls = (await Promise.all(candidates.map(async (u) => ((await warmImage(u)) ? u : null)))).filter((u): u is string => !!u);
  if (urls.length === 0) throw new Error('Görseller hazırlanamadı (adres açılmıyor ya da resim değil)');

  const userId = await currentUserId();
  let container: Record<string, unknown>;
  if (urls.length === 1) {
    container = await step('tek görsel', () => post(`${userId}/threads`, { media_type: 'IMAGE', image_url: urls[0], text: text.slice(0, 500) }));
  } else {
    const children: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const item = await step(`karusel öğesi ${i + 1}/${urls.length}`, () =>
        post(`${userId}/threads`, { media_type: 'IMAGE', image_url: urls[i], is_carousel_item: 'true' }));
      const id = String(item.id ?? '');
      if (!id) throw new Error(`Threads karusel öğesi ${i + 1} oluşturulamadı`);
      children.push(id);
    }
    // Öğelerin işlenmesi için kısa bekleme: hazır olmayan çocuklarla karusel kurulamaz
    await new Promise((r) => setTimeout(r, 2000));
    container = await step('karusel', () => post(`${userId}/threads`, { media_type: 'CAROUSEL', children: children.join(','), text: text.slice(0, 500) }));
  }
  return publishContainer(userId, String(container.id ?? ''));
}

/** Bağlantılı metin gönderisi (blog yazısı, kampanya). */
export async function publishThreadsText(text: string, link?: string): Promise<{ id: string; permalink?: string }> {
  const userId = await currentUserId();
  const params: Record<string, string> = { media_type: 'TEXT', text: text.slice(0, 500) };
  if (link) params.link_attachment = link;
  const container = await step('metin', () => post(`${userId}/threads`, params));
  return publishContainer(userId, String(container.id ?? ''));
}

/** Token 60 günlük; süresi 20 günün altına inince yeniler. Hata fırlatmaz. */
export async function refreshThreadsTokenIfNeeded(now = Date.now()): Promise<{ refreshed: boolean; expiresAt?: number; error?: string }> {
  try {
    const d = (await settingsRef().get()).data() ?? {};
    const expiresAt = Number(d.tokenExpiresAt) || 0;
    if (expiresAt && expiresAt - now > REFRESH_WHEN_LEFT_MS) return { refreshed: false, expiresAt };
    const token = (typeof d.token === 'string' && d.token) || process.env.THREADS_ACCESS_TOKEN;
    if (!token) return { refreshed: false, error: 'token yok' };
    const r = await http(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`);
    const next = r.json.access_token;
    const expiresIn = Number(r.json.expires_in);
    if (!r.ok || typeof next !== 'string' || !expiresIn) return { refreshed: false, expiresAt: expiresAt || undefined, error: errMessage(r.json, 'token yenilenemedi') };
    const newExpiry = now + expiresIn * 1000;
    await settingsRef().set({ token: next, tokenExpiresAt: newExpiry, tokenRefreshedAt: now }, { merge: true });
    return { refreshed: true, expiresAt: newExpiry };
  } catch (e) {
    return { refreshed: false, error: e instanceof Error ? e.message : 'token yenilenemedi' };
  }
}

/** Panel için token durumu: kayıtlı bitiş zamanı ve (isteğe bağlı) hesap adı. Hata fırlatmaz. */
export async function threadsTokenInfo(check = false): Promise<{ expiresAt?: number; username?: string; error?: string }> {
  try {
    const d = (await settingsRef().get()).data() ?? {};
    const out: { expiresAt?: number; username?: string; error?: string } = { expiresAt: Number(d.tokenExpiresAt) || undefined };
    if (check && threadsConfigured()) {
      const token = await currentToken();
      const r = await http(`${API}/me?fields=username&access_token=${encodeURIComponent(token)}`);
      if (r.ok) out.username = String(r.json.username ?? '');
      else out.error = errMessage(r.json, `hata ${r.status}`);
    }
    return out;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'okunamadı' };
  }
}

/** Kendi gönderimize yanıt yazar (threads_manage_replies izni gerekir): ürün ayrıntılarını zincirleme ekler. */
export async function replyToThreadsPost(postId: string, text: string): Promise<string> {
  const userId = await currentUserId();
  const container = await post(`${userId}/threads`, { media_type: 'TEXT', text: text.slice(0, 500), reply_to_id: postId });
  const creationId = String(container.id ?? '');
  if (!creationId) throw new Error('Threads yanıt kimliği alınamadı');
  // Yeni oluşturulan kapsayıcı hemen görünmeyebilir ("media ... cannot be found"): bekleyip yeniden dene
  await new Promise((r) => setTimeout(r, 2000));
  let lastErr = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 3000));
    try {
      const pub = await post(`${userId}/threads_publish`, { creation_id: creationId });
      return String(pub.id ?? '');
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'bilinmeyen hata';
    }
  }
  throw new Error(lastErr);
}
