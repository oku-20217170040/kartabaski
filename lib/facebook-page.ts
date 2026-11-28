/**
 * Facebook Sayfası gönderisi (Graph API). Ürün fotoğraflarını, yeni blog yazılarını ve özel gün
 * kampanyalarını KAR-TA BASKI sayfasına yazar.
 *
 * Gerekli env (yalnızca sunucuda, asla commit edilmez):
 *   FACEBOOK_PAGE_ID            Sayfa kimliği
 *   FACEBOOK_PAGE_ACCESS_TOKEN  Sayfa belirteci ya da sayfaya atanmış sistem kullanıcısı belirteci
 *                               (pages_show_list, pages_read_engagement, pages_manage_posts)
 * İkisi de yoksa gönderim atlanır; diğer platformlar etkilenmez.
 */

const GRAPH = 'https://graph.facebook.com/v26.0';
const TIMEOUT_MS = 25_000;

export interface FacebookConfig {
  pageId: string;
  token: string;
}

export function getFacebookConfig(env: Record<string, string | undefined> = process.env): FacebookConfig | null {
  const pageId = env.FACEBOOK_PAGE_ID?.trim();
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  return pageId && token ? { pageId, token } : null;
}

/** Tek görselli gönderi için Graph API parametreleri (/{page}/photos). */
export function buildPhotoParams(imageUrl: string, caption: string, token: string, published: boolean): URLSearchParams {
  const p = new URLSearchParams({ url: imageUrl, published: String(published), access_token: token });
  if (caption) p.set('caption', caption);
  return p;
}

/** Çoklu görselli gönderi için: fotoğraf id'leri ile sayfa akışına (/{page}/feed) yazılan parametreler. */
export function buildFeedParams(mediaFbids: string[], message: string, token: string): URLSearchParams {
  const p = new URLSearchParams({ access_token: token });
  if (message) p.set('message', message);
  mediaFbids.forEach((id, i) => p.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  return p;
}

/** Bağlantı (blog yazısı) gönderisi için parametreler (/{page}/feed). */
export function buildLinkParams(message: string, link: string, token: string): URLSearchParams {
  return new URLSearchParams({ message, link, access_token: token });
}

async function graph(path: string, init: RequestInit & { query?: URLSearchParams } = {}): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const { query, ...rest } = init;
    const res = await fetch(`${GRAPH}/${path}${query ? `?${query.toString()}` : ''}`, { ...rest, signal: ctrl.signal, cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const e = json.error as { message?: string; code?: number } | undefined;
      throw new Error(e?.message ? `${e.message}${e.code ? ` (kod ${e.code})` : ''}` : `Facebook isteği başarısız (${res.status})`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

const graphPost = (path: string, params: URLSearchParams) => graph(path, { method: 'POST', body: params });

/**
 * Sayfaya yazma çağrıları sayfa belirteci ister; sistem kullanıcısı belirteciyle yapılırsa Graph
 * "(#200) publish_actions" hatası verir. Env'deki belirteçle sayfanın kendi belirteci alınır
 * (env'de zaten sayfa belirteci varsa aynı değer ya da hiç alan dönmez, o zaman env değeri kullanılır).
 */
async function withPageToken(cfg: FacebookConfig): Promise<FacebookConfig> {
  const r = await graph(cfg.pageId, { query: new URLSearchParams({ fields: 'access_token', access_token: cfg.token }) });
  return typeof r.access_token === 'string' && r.access_token ? { ...cfg, token: r.access_token } : cfg;
}

/** Bağlantı testi: sayfa adı. Hata fırlatmaz. */
export async function facebookWhoAmI(cfg: FacebookConfig | null = getFacebookConfig()): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!cfg) return { ok: false, error: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil' };
  try {
    const r = await graph(cfg.pageId, { query: new URLSearchParams({ fields: 'name', access_token: cfg.token }) });
    return { ok: true, name: String(r.name ?? '') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'bağlanılamadı' };
  }
}

/**
 * Yayınlanmış bir sayfa gönderisinin açıklamasını (message) günceller. Uygulamanın kendi oluşturduğu
 * gönderiler için pages_manage_posts yeterli. Dönen: Graph'ın başarı değeri.
 */
export async function updateFacebookPostMessage(
  postId: string,
  message: string,
  cfg: FacebookConfig | null = getFacebookConfig()
): Promise<boolean> {
  if (!cfg) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil');
  if (!postId) throw new Error('Gönderi kimliği yok');
  const page = await withPageToken(cfg);
  const r = await graphPost(postId, new URLSearchParams({ message, access_token: page.token }));
  return r.success === true;
}

/**
 * Feed gönderisini Facebook sayfasına yazar. Dönen: oluşan gönderi kimliği.
 * Tek görsel: doğrudan fotoğraf gönderisi. Çoklu görsel: önce yayınlanmamış fotoğraflar, sonra tek gönderi.
 */
export async function publishToFacebookPage(
  imageUrls: string[],
  caption: string,
  cfg: FacebookConfig | null = getFacebookConfig()
): Promise<string> {
  if (!cfg) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil');
  if (imageUrls.length === 0) throw new Error('Yayınlanacak görsel yok');
  const { pageId, token } = await withPageToken(cfg);

  if (imageUrls.length === 1) {
    const r = await graphPost(`${pageId}/photos`, buildPhotoParams(imageUrls[0], caption, token, true));
    return String(r.post_id ?? r.id ?? '');
  }

  const mediaIds: string[] = [];
  for (const url of imageUrls) {
    const r = await graphPost(`${pageId}/photos`, buildPhotoParams(url, '', token, false));
    mediaIds.push(String(r.id));
  }
  const r = await graphPost(`${pageId}/feed`, buildFeedParams(mediaIds, caption, token));
  return String(r.id ?? '');
}

/** Bağlantılı metin gönderisi (blog yazısı paylaşımı). Dönen: gönderi kimliği. */
export async function publishLinkToFacebookPage(
  message: string,
  link: string,
  cfg: FacebookConfig | null = getFacebookConfig()
): Promise<string> {
  if (!cfg) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil');
  const page = await withPageToken(cfg);
  const r = await graphPost(`${page.pageId}/feed`, buildLinkParams(message, link, page.token));
  return String(r.id ?? '');
}

/** Sayfa hikâyesi: görsel yayınlanmadan yüklenir, sonra hikâye olarak paylaşılır. */
export async function publishFacebookStory(imageUrl: string, cfg: FacebookConfig | null = getFacebookConfig()): Promise<string> {
  if (!cfg) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil');
  const { pageId, token } = await withPageToken(cfg);
  const photo = await graphPost(`${pageId}/photos`, buildPhotoParams(imageUrl, '', token, false));
  const r = await graphPost(`${pageId}/photo_stories`, new URLSearchParams({ photo_id: String(photo.id), access_token: token }));
  return String(r.post_id ?? photo.id);
}
