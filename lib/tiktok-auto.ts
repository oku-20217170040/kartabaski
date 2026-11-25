import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { displayTitle, formatPriceRange } from './format';
import { getTitle, getSlug, getCategory, getDescription, getDeliveryDays, getPriceMin, getPriceMax } from './product-utils';
import { SITE_URL } from './site';
import { PHONE_DISPLAY } from './constants';
import { trDayKey } from './tr-time';
import type { CycleResult, PlatformStatus } from './social-types';
import { sendPhotoDraft, tiktokConfigured, getTikTokState } from './tiktok';
import { tiktokTitle, tiktokDescription, tiktokPhotoUrls, pickRandomBacklog, pendingRoom, pendingInWindow, TIKTOK_PENDING_CAP } from './tiktok-utils';
import { getSocialProducts, toChannelRow, getPlatformGate } from './telegram-channel-data';
import { pickNewPosts, channelGate, manualGate, channelTodayCount, CHANNEL_PER_RUN, type ChannelRow } from './telegram-channel-utils';

/**
 * TikTok için günlük ürün fotoğraf TASLAKLARI (kota ve saat penceresi panelden ayarlanır: social_settings/tiktok, varsayılan kapalı;
 * tur başına 3; TikTok'un 24 saatte 5 bekleyen taslak sınırı da gözetilir). Her model, fotoğraf karuseli taslağı olarak TikTok gelen
 * kutusuna gönderilir; yayınlama TikTok uygulamasında elle yapılır. Token yoksa tur "bağlı değil" diye atlanır.
 * Durum: tiktok_auto/state (Admin SDK).
 */
const stateRef = () => adminDb.collection('tiktok_auto').doc('state');

export interface TikTokPosted { postedAt: number; publishId?: string; error?: string }
export interface TikTokAutoState {
  startedAt: number;
  day: string;
  todayCount: number;
  lastRunAt: number;
  lastError: string;
  posted: Record<string, TikTokPosted>;
}

export async function loadTikTokAutoState(): Promise<TikTokAutoState> {
  const d = (await stateRef().get()).data() ?? {};
  return {
    startedAt: Number(d.startedAt) || 0,
    day: String(d.day ?? ''),
    todayCount: Number(d.todayCount) || 0,
    lastRunAt: Number(d.lastRunAt) || 0,
    lastError: String(d.lastError ?? ''),
    posted: (d.posted ?? {}) as Record<string, TikTokPosted>,
  };
}

export async function requeueTikTokPost(productId: string): Promise<void> {
  await stateRef().update({ [`posted.${productId}`]: FieldValue.delete() });
}

export interface TikTokCycleResult extends CycleResult {}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'hata').slice(0, 200);

/** ignoreWindow: yalnızca panelden elle tetiklenir (saat penceresi ve "kapalı" ayarı yok sayılır, günlük kota geçerli kalır). */
export async function runTikTokCycleWith(now = Date.now(), opts: { ignoreWindow?: boolean; max?: number; overrideCap?: boolean } = {}): Promise<TikTokCycleResult> {
  const result: TikTokCycleResult = { posted: [], errors: [] };
  if (!tiktokConfigured()) return { ...result, skipped: 'TikTok bağlı değil (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET tanımlı değil)' };
  const conn = await getTikTokState();
  if (!conn.accessToken) return { ...result, skipped: 'TikTok bağlı değil (/admin/tiktok → TikTok\'a bağlan)' };
  const cfg = await getPlatformGate('tiktok');
  if (!opts.ignoreWindow && !cfg.enabled) return { ...result, skipped: 'TikTok otomasyonu panelden kapalı' };

  const st = await loadTikTokAutoState();
  const startedAt = st.startedAt || now;
  await stateRef().set({ startedAt, lastRunAt: now }, { merge: true });

  const gate = opts.ignoreWindow ? manualGate(st.day, st.todayCount, now, cfg) : channelGate(st.day, st.todayCount, now, cfg);
  if (!gate.ok) return { ...result, skipped: gate.reason };

  // TikTok: 24 saatte en fazla 5 bekleyen taslak; sınır doluyken gönderilen taslak bildirim düşürmeyebilir.
  const room = opts.overrideCap ? Number.MAX_SAFE_INTEGER : pendingRoom(st.posted, now);
  if (room <= 0) return { ...result, skipped: `TikTok 24 saatte en fazla ${TIKTOK_PENDING_CAP} bekleyen taslağa izin verir (dolu): TikTok'ta taslakları yayınla/sil` };

  let todayCount = channelTodayCount(st.day, st.todayCount, now);
  const limit = Math.min(cfg.dailyLimit - todayCount, opts.max ?? CHANNEL_PER_RUN, room);
  const products = await getSocialProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = products.map(toChannelRow);

  // Önce otomasyondan sonra eklenen yeni modeller, sonra kalan katalog rastgele havuzdan (günlük tohumla karıştırılır)
  const queue: ChannelRow[] = [];
  const seen = new Set<string>();
  for (const r of [...pickNewPosts(rows, st.posted, startedAt, limit), ...pickRandomBacklog(rows, st.posted, limit, trDayKey(now))]) {
    if (seen.has(r.id) || queue.length >= limit) continue;
    seen.add(r.id);
    queue.push(r);
  }

  for (const r of queue) {
    const p = byId.get(r.id);
    if (!p) continue;
    // Yalnızca Cloudinary kimlikli (karta-baski/urunler/...) fotoğraflar doğrulanmış alan adı önekinden sunulabilir.
    const photoUrls = tiktokPhotoUrls(SITE_URL, p.images ?? []);
    if (photoUrls.length === 0) {
      await stateRef().set({ posted: { [r.id]: { postedAt: now, error: 'uygun fotoğraf yok' } } }, { merge: true });
      result.errors.push(`${r.id}: uygun fotoğraf yok`);
      continue;
    }
    try {
      const priceText = formatPriceRange(getPriceMin(p), getPriceMax(p));
      const publishId = await sendPhotoDraft({
        title: tiktokTitle(displayTitle(getTitle(p)), priceText),
        description: tiktokDescription({
          priceText,
          category: getCategory(p),
          description: getDescription(p),
          deliveryDays: getDeliveryDays(p),
          url: `${SITE_URL}/urun/${getSlug(p) || p.id}`,
          phoneDisplay: PHONE_DISPLAY,
        }),
        photoUrls,
      });
      todayCount += 1;
      await stateRef().set({ day: trDayKey(now), todayCount, posted: { [r.id]: { postedAt: now, publishId } } }, { merge: true });
      result.posted.push(r.id);
    } catch (e) {
      const error = errText(e);
      await stateRef().set({ posted: { [r.id]: { postedAt: now, error } } }, { merge: true });
      result.errors.push(`${r.id}: ${error}`);
    }
  }
  if (result.errors.length) await stateRef().set({ lastError: result.errors[0].slice(0, 200) }, { merge: true });
  else if (st.lastError && result.posted.length) await stateRef().set({ lastError: FieldValue.delete() }, { merge: true });
  return result;
}

/** Merkez/cron sözleşmesi: sıfır argümanlı tur. */
export async function runTikTokCycle(): Promise<CycleResult> {
  return runTikTokCycleWith();
}

export async function getTikTokStatus(): Promise<PlatformStatus> {
  try {
    const [conn, cfg, st] = await Promise.all([getTikTokState(), getPlatformGate('tiktok'), loadTikTokAutoState()]);
    const enabled = cfg.enabled;
    const configured = tiktokConfigured() && !!conn.accessToken;
    const lastPostAt = Object.values(st.posted).reduce((m, v) => (v.publishId && v.postedAt > m ? v.postedAt : m), 0);
    const detail = !configured
      ? (tiktokConfigured() ? "Bağlı değil: /admin/tiktok → TikTok'a bağlan" : 'Bağlı değil: TIKTOK_CLIENT_KEY ve TIKTOK_CLIENT_SECRET tanımlayın')
      : st.lastError || `Son 24 saatte ${pendingInWindow(st.posted, Date.now())}/${TIKTOK_PENDING_CAP} bekleyen taslak`;
    return { platform: 'tiktok', configured, enabled, lastRunAt: st.lastRunAt || undefined, lastPostAt: lastPostAt || undefined, detail };
  } catch (e) {
    return { platform: 'tiktok', configured: false, enabled: false, detail: errText(e) };
  }
}
