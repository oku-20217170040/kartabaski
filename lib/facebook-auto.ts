import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { CycleResult, PlatformStatus } from './social-types';
import { trDayKey } from './tr-time';
import { getSocialSettings, ensureSocialMeta, patchSocialMeta } from './social-settings';
import { getSocialRows } from './social-products';
import {
  isShareable, imageUrls, buildProductCaption, blogCaption, blogUrl, campaignCaption, campaignDue, activeCampaign,
  pickBlogToShare, pickCampaignProducts, pickQueue, newArrivals, retryableFailures, withPassiveNote, REPOST_AFTER_DAYS, DAY_MS,
  type SocialProductRow,
} from './social-content-utils';
import { inWindow } from './social-settings-utils';
import {
  canPostNow, emptyState, statusChanges, todayCountFor, type FbPosted, type FbState,
} from './facebook-auto-utils';
import {
  getFacebookConfig, publishToFacebookPage, publishLinkToFacebookPage, updateFacebookPostMessage,
} from './facebook-page';
import { listPublishedPosts } from '@/lib/posts';

/**
 * Facebook sayfası için otomatik paylaşım. Durum tek belgede: `facebook_auto/main`
 * ({ startedAt, day, todayCount, lastPostAt, posted: { [ürün]: FbPosted } }) → tur başına tek okuma.
 * Ayarlar `social_settings/facebook` (açık/kapalı, günlük kota, saat aralığı).
 * Sıra: yeni ürünler (kota dışı) → hatalı kayıtların yeniden denemesi → yeni blog yazısı → özel gün kampanyası
 * → kota kuyruğu → pasife alınan ürünlerin gönderi notu.
 */

const NEW_PER_RUN = 2;
const STATUS_SYNC_PER_RUN = 10;
const stateRef = () => adminDb.collection('facebook_auto').doc('main');
const msg = (e: unknown, n = 200) => (e instanceof Error ? e.message : 'bilinmeyen hata').slice(0, n);

function parseState(d: FirebaseFirestore.DocumentData | undefined): FbState {
  const base = emptyState();
  if (!d) return base;
  return {
    startedAt: Number(d.startedAt) || 0,
    day: typeof d.day === 'string' ? d.day : '',
    todayCount: Number(d.todayCount) || 0,
    lastPostAt: Number(d.lastPostAt) || 0,
    posted: (d.posted ?? {}) as Record<string, FbPosted>,
  };
}

export async function loadState(): Promise<FbState> {
  return parseState((await stateRef().get()).data());
}

/**
 * Bir ürünü paylaşmak için yer ayırır (transaction): aynı anda iki çalıştırma aynı ürünü iki kez paylaşmasın.
 * quota=true ise günlük kota/saat/bekleme kuralları da denetlenir ve kota düşülür. Süresi dolmuş (yeniden paylaşılabilir)
 * kayıtların üzerine yazılabilir.
 */
async function reserve(productId: string, now: number, quota: { dailyLimit: number; windowStart: number; windowEnd: number } | null): Promise<{ ok: boolean; reason?: string }> {
  return adminDb.runTransaction(async (tx) => {
    const ref = stateRef();
    const st = parseState((await tx.get(ref)).data());
    const prev = st.posted[productId];
    const stale = !!prev?.postId && now - prev.postedAt >= REPOST_AFTER_DAYS * DAY_MS;
    if (prev && !stale) return { ok: false, reason: 'zaten paylaşılmış' };
    if (quota) {
      const gate = canPostNow(st, quota, now);
      if (!gate.ok) return gate;
      st.todayCount = todayCountFor(st, now) + 1;
      st.day = trDayKey(now);
      st.lastPostAt = now;
    }
    st.posted[productId] = { postedAt: now, active: true, caption: '' };
    tx.set(ref, st, { merge: true });
    return { ok: true };
  });
}

/** Hatalı kaydı yeniden denemek için ayırır (kota dışı; ilk denemede kota zaten düşüldü). */
async function reserveRetry(productId: string, now: number): Promise<{ ok: boolean; reason?: string }> {
  return adminDb.runTransaction(async (tx) => {
    const ref = stateRef();
    const st = parseState((await tx.get(ref)).data());
    const v = st.posted[productId];
    if (!v || v.postId || !v.error) return { ok: false, reason: 'yeniden denenecek hatalı kayıt yok' };
    st.posted[productId] = { postedAt: now, active: true, caption: '' };
    tx.set(ref, st, { merge: true });
    return { ok: true };
  });
}

/** Tek ürünü Facebook'ta yayınlar ve durumu kaydeder. Hata fırlatmaz. */
async function shareProduct(row: SocialProductRow, now: number): Promise<{ ok: boolean; error?: string }> {
  const urls = imageUrls(row);
  if (urls.length === 0) return { ok: false, error: 'görsel yok' };
  const caption = buildProductCaption(row, 'facebook');
  try {
    const postId = await publishToFacebookPage(urls, caption);
    await stateRef().set({ posted: { [row.id]: { postId, postedAt: now, active: true, caption, error: FieldValue.delete() } } }, { merge: true });
    return { ok: true };
  } catch (e) {
    const error = msg(e, 300);
    await stateRef().set({ posted: { [row.id]: { postedAt: now, active: true, caption: '', error } } }, { merge: true });
    return { ok: false, error };
  }
}

/** Zamanlanmış çalışma (cron ile). Hata fırlatmaz; sonucu döndürür. */
export async function runFacebookCycle(now = Date.now()): Promise<CycleResult> {
  const result: CycleResult = { posted: [], errors: [], newPosted: [] as string[], backlogPosted: [] as string[], statusUpdated: 0, blogPosted: 0, campaignPosted: 0 };
  const cfg = getFacebookConfig();
  if (!cfg) return { ...result, skipped: 'Facebook bağlı değil (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil)' };
  const s = await getSocialSettings('facebook');
  if (!s.enabled) return { ...result, skipped: 'otomasyon kapalı' };

  const st0 = await loadState();
  if (!st0.startedAt) {
    await stateRef().set({ startedAt: now }, { merge: true });
    st0.startedAt = now;
  }
  const meta = await ensureSocialMeta('facebook', now);
  const rows = await getSocialRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const open = inWindow(s, now);
  const done = (kind: 'newPosted' | 'backlogPosted', id: string) => {
    (result[kind] as string[]).push(id);
    result.posted.push(id);
  };

  // 1) Yeni eklenen ürünler: hemen (kota dışı, yalnız paylaşım saatlerinde)
  if (open) {
    for (const r of newArrivals(rows, st0.posted, st0.startedAt).slice(0, NEW_PER_RUN)) {
      if (!(await reserve(r.id, now, null)).ok) continue;
      const out = await shareProduct(r, now);
      if (out.ok) done('newPosted', r.id); else result.errors.push(`${r.title.slice(0, 30)}: ${out.error}`);
    }
  }

  // 1b) Hatalı paylaşımlar: ürün sonradan düzenlendiyse (ör. fotoğraf eklendi) yeniden dene
  for (const r of retryableFailures(rows, st0.posted).slice(0, NEW_PER_RUN)) {
    if (!(await reserveRetry(r.id, now)).ok) continue;
    const out = await shareProduct(r, now);
    if (out.ok) done('newPosted', r.id); else result.errors.push(`${r.title.slice(0, 30)}: ${out.error}`);
  }

  // 2) Yeni blog yazısı (otomasyon başladıktan sonra yayınlananlar; tur başına en fazla 1)
  if (open) {
    try {
      const post = pickBlogToShare(await listPublishedPosts(10), meta.blogShared, meta.startedAt);
      if (post) {
        await publishLinkToFacebookPage(blogCaption(post, 'facebook'), blogUrl(post.slug));
        await patchSocialMeta('facebook', { blogShared: { ...meta.blogShared, [post.id]: now } });
        result.blogPosted = 1;
        result.posted.push(`blog:${post.id}`);
      }
    } catch (e) {
      result.errors.push(`blog: ${msg(e, 160)}`);
    }
  }

  // 3) Özel gün kampanyası (kampanya başına en fazla 3 günde bir, kota dışı)
  const ac = activeCampaign(now);
  if (open && ac && campaignDue(meta.campaigns[ac.key], now)) {
    const picks = pickCampaignProducts(rows, ac.campaign, 5);
    if (picks.length >= 2) {
      try {
        await publishToFacebookPage(picks.map((p) => imageUrls(p, 1)[0]), campaignCaption(ac, picks, 'facebook'));
        await patchSocialMeta('facebook', { campaigns: { ...meta.campaigns, [ac.key]: now } });
        result.campaignPosted = 1;
        result.posted.push(`campaign:${ac.key}`);
      } catch (e) {
        result.errors.push(`kampanya: ${msg(e, 160)}`);
      }
    }
  }

  // 4) Kota kuyruğu: günlük kota, saat penceresi ve gönderi arası bekleme içinde
  const gate = canPostNow(await loadState(), s, now);
  if (gate.ok) {
    const next = pickQueue(rows, (await loadState()).posted, now)[0];
    if (next && (await reserve(next.id, now, s)).ok) {
      const out = await shareProduct(next, now);
      if (out.ok) done('backlogPosted', next.id); else result.errors.push(`${next.title.slice(0, 30)}: ${out.error}`);
    }
  } else if (!result.posted.length) {
    result.skipped = gate.reason;
  }

  // 5) Pasife alınan (ya da yeniden aktif olan) ürünlerde gönderi notunu güncelle
  const stAfter = await loadState();
  for (const id of statusChanges(stAfter.posted, byId).slice(0, STATUS_SYNC_PER_RUN)) {
    const v = stAfter.posted[id];
    const active = !!byId.get(id)?.active;
    try {
      const caption = withPassiveNote(v.caption, active);
      await updateFacebookPostMessage(v.postId!, caption);
      await stateRef().set({ posted: { [id]: { ...v, active, caption } } }, { merge: true });
      result.statusUpdated = Number(result.statusUpdated) + 1;
    } catch (e) {
      result.errors.push(`${id.slice(0, 8)} durum: ${msg(e, 160)}`);
    }
  }
  return result;
}

/** Panelden "Şimdi paylaş": kuyruğu/kotayı beklemeden seçilen ürünü paylaşır (kota sayacına işlenir). */
export async function shareFacebookProductNow(productId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!getFacebookConfig()) return { ok: false, reason: 'Facebook bağlı değil (ortam değişkenleri tanımlı değil)' };
    const row = (await getSocialRows(true)).find((x) => x.id === productId);
    if (!row || !isShareable(row)) return { ok: false, reason: 'Ürün bulunamadı, pasif ya da fotoğrafı yok.' };
    const now = Date.now();
    const res = await reserve(productId, now, null);
    if (!res.ok) return res;
    const out = await shareProduct(row, now);
    if (!out.ok) return { ok: false, reason: out.error };
    await stateRef().set({ day: trDayKey(now), todayCount: todayCountFor(await loadState(), now) + 1, lastPostAt: now }, { merge: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

/** Admin "Tekrar dene": hatalı paylaşımı hemen yeniden dener (kota dışı). Hata fırlatmaz. */
export async function retryFacebookPostNow(productId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!getFacebookConfig()) return { ok: false, reason: 'Facebook bağlı değil (ortam değişkenleri tanımlı değil)' };
    const row = (await getSocialRows(true)).find((x) => x.id === productId);
    if (!row || !isShareable(row)) return { ok: false, reason: 'ürün pasif ya da fotoğrafı yok' };
    const now = Date.now();
    const res = await reserveRetry(productId, now);
    if (!res.ok) return res;
    const out = await shareProduct(row, now);
    return out.ok ? { ok: true } : { ok: false, reason: out.error };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

/** Yeni ürün kaydından hemen sonra çağrılabilir (kota dışı; orkestratör isterse bağlar). Hata fırlatmaz. */
export async function publishFacebookNewProductNow(productId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!getFacebookConfig()) return { ok: false, reason: 'Facebook bağlı değil' };
    if (!(await getSocialSettings('facebook')).enabled) return { ok: false, reason: 'otomasyon kapalı' };
    if (!(await loadState()).startedAt) return { ok: false, reason: 'otomasyon henüz başlamadı' };
    return await shareFacebookProductNow(productId);
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

export async function getFacebookStatus(): Promise<PlatformStatus> {
  const [s, st, rows] = await Promise.all([getSocialSettings('facebook'), loadState(), getSocialRows().catch(() => [] as SocialProductRow[])]);
  const configured = !!getFacebookConfig();
  const queued = pickQueue(rows, st.posted, Date.now()).length;
  const lastPostAt = Object.values(st.posted).reduce((m, v) => (v.postId && v.postedAt > m ? v.postedAt : m), 0) || undefined;
  const lastErr = Object.values(st.posted).find((v) => v.error)?.error;
  return {
    platform: 'facebook',
    configured,
    enabled: s.enabled,
    lastRunAt: s.lastRunAt,
    lastPostAt,
    queued,
    detail: !configured ? 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil' : lastErr ? `Son hata: ${lastErr}` : s.lastRunNote,
  };
}
