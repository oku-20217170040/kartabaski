import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { cloudinaryUrl, displayTitle, formatPriceRange, whatsappLink } from './format';
import { getTitle, getSlug, getCategory, getDeliveryDays, getPriceMin, getPriceMax } from './product-utils';
import { SITE_URL } from './site';
import { trDayKey } from './tr-time';
import type { Product } from '@/types';
import type { Post } from './posts-types';
import type { CycleResult, PlatformStatus } from './social-types';
import { getSocialProducts, getSocialPosts, toChannelRow, toBlogRow, getPlatformGate } from './telegram-channel-data';
import {
  buildQueue, pickNewBlog, pickBacklog, pickChannelUpdates, channelCaption, blogCaption, channelGate, manualGate,
  channelTodayCount, blogKey, CHANNEL_PER_RUN, UPDATES_PER_RUN, type ChannelPosted,
} from './telegram-channel-utils';

/**
 * Telegram kanalına otomatik duyuru (yeni kupa modelleri + yeni blog yazıları). Bot kanalda yönetici olmalı
 * (mesaj gönderme ve düzenleme izni). Env (yalnızca sunucuda): TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID (@kanal_adi veya -100…).
 * Token/kanal yoksa tur "bağlı değil" diye atlanır; diğer akışlar etkilenmez.
 * Kota ve saat penceresi panelden ayarlanır (social_settings/telegram; varsayılan kapalı). Önce yeni yazılar ve kurulumdan sonra eklenen modeller,
 * sonra mevcut katalog (en yeni önce). Güncelleme (kotadan bağımsız): pasife alınan ürünün gönderisi "satışta değil" olur;
 * fiyat aralığı değişen gönderi yeni fiyatla düzenlenir.
 * Durum: telegram_channel/state (Admin SDK).
 */

const stateRef = () => adminDb.collection('telegram_channel').doc('state');
const TIMEOUT_MS = 20_000;
const PHOTO_OPTS = 'f_jpg,q_auto,w_1200,c_limit';

export interface TelegramCycleResult extends CycleResult {
  updated: string[];
}

function channelId(): string | null {
  return process.env.TELEGRAM_CHANNEL_ID?.trim() || null;
}

export const channelConfigured = () => !!(channelId() && process.env.TELEGRAM_BOT_TOKEN);
export const channelRef = () => channelId();

export async function tgChannel(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = channelId();
  if (!token || !chat) return { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID tanımlı değil' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, ...body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!res.ok || !json.ok) return { ok: false, error: (json.description ?? `HTTP ${res.status}`).slice(0, 200) };
    return { ok: true, messageId: json.result?.message_id };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : 'ağ hatası').slice(0, 200) };
  }
}

/** Telegram aynı içeriği tekrar düzenlemeyi hata sayar; bu bir başarısızlık değildir. */
const isNotModified = (e?: string) => !!e && e.includes('message is not modified');

const imageSrc = (id: string) => (id.startsWith('http') ? id : cloudinaryUrl(id, PHOTO_OPTS));
const productUrl = (p: Product) => `${SITE_URL}/urun/${getSlug(p) || p.id}`;

function productCaption(p: Product, closed: boolean): string {
  const slug = getSlug(p) || p.id;
  return channelCaption({
    title: displayTitle(getTitle(p)),
    priceText: formatPriceRange(getPriceMin(p), getPriceMax(p)),
    category: getCategory(p),
    deliveryDays: getDeliveryDays(p),
    url: productUrl(p),
    whatsappUrl: whatsappLink(displayTitle(getTitle(p)), slug),
    closed,
  });
}

const blogCaptionFor = (p: Post) =>
  blogCaption({ title: p.title, excerpt: p.excerpt, url: `${SITE_URL}/blog/${p.slug}`, tags: p.tags });

export interface ChannelState {
  startedAt: number;
  day: string;
  todayCount: number;
  lastRunAt: number;
  lastError: string;
  posted: Record<string, ChannelPosted>;
}

export async function loadChannelState(): Promise<ChannelState> {
  const d = (await stateRef().get()).data() ?? {};
  return {
    startedAt: Number(d.startedAt) || 0,
    day: String(d.day ?? ''),
    todayCount: Number(d.todayCount) || 0,
    lastRunAt: Number(d.lastRunAt) || 0,
    lastError: String(d.lastError ?? ''),
    posted: (d.posted ?? {}) as Record<string, ChannelPosted>,
  };
}

/** Hatalı kaydı siler: ürün/yazı sıradaki kota turunda yeniden gönderilir. */
export async function requeueChannelPost(key: string): Promise<void> {
  await stateRef().update({ [`posted.${key}`]: FieldValue.delete() });
}

/** ignoreWindow: yalnızca panelden elle tetiklenir (saat penceresi ve "kapalı" ayarı yok sayılır, günlük kota geçerli kalır). */
export async function runTelegramCycleWith(now = Date.now(), opts: { ignoreWindow?: boolean; max?: number } = {}): Promise<TelegramCycleResult> {
  const result: TelegramCycleResult = { posted: [], updated: [], errors: [] };
  if (!channelConfigured()) return { ...result, skipped: 'Telegram bağlı değil (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID tanımlı değil)' };
  const cfg = await getPlatformGate('telegram');
  if (!opts.ignoreWindow && !cfg.enabled) return { ...result, skipped: 'Telegram otomasyonu panelden kapalı' };

  const st = await loadChannelState();
  const startedAt = st.startedAt || now;
  await stateRef().set({ startedAt, lastRunAt: now }, { merge: true });

  let todayCount = channelTodayCount(st.day, st.todayCount, now);
  const posted = { ...st.posted };
  const lastErrors: string[] = [];

  // 1) Yeni gönderiler: saat penceresi ve günlük kota içinde
  const gate = opts.ignoreWindow ? manualGate(st.day, st.todayCount, now, cfg) : channelGate(st.day, st.todayCount, now, cfg);
  if (!gate.ok) {
    result.skipped = gate.reason;
  } else {
    const [products, posts] = await Promise.all([getSocialProducts(), getSocialPosts()]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const postById = new Map(posts.map((p) => [p.id, p]));
    const limit = Math.min(cfg.dailyLimit - todayCount, opts.max ?? CHANNEL_PER_RUN);

    type Item = { key: string; photo: string; caption: string; priceMin?: number; priceMax?: number };
    const items: Item[] = [];
    for (const b of pickNewBlog(posts.map(toBlogRow), posted, startedAt, limit)) {
      const p = postById.get(b.id);
      if (p?.coverImage) items.push({ key: blogKey(p.id), photo: imageSrc(p.coverImage), caption: blogCaptionFor(p) });
    }
    const room = limit - items.length;
    if (room > 0) {
      for (const r of buildQueue(products.map(toChannelRow), posted, startedAt, room)) {
        const p = byId.get(r.id);
        const img = p?.images?.[0];
        if (p && img) items.push({ key: p.id, photo: imageSrc(img), caption: productCaption(p, false), priceMin: getPriceMin(p), priceMax: getPriceMax(p) });
      }
    }

    for (const it of items) {
      const out = await tgChannel('sendPhoto', { photo: it.photo, caption: it.caption, parse_mode: 'HTML' });
      if (out.ok) {
        todayCount += 1;
        const rec: ChannelPosted = { postedAt: now, messageId: out.messageId, priceMin: it.priceMin, priceMax: it.priceMax };
        if (it.priceMin === undefined) { delete rec.priceMin; delete rec.priceMax; }
        posted[it.key] = rec;
        await stateRef().set({ day: trDayKey(now), todayCount, posted: { [it.key]: rec } }, { merge: true });
        result.posted.push(it.key);
      } else {
        // Hatalı kayıt tekrar denenmez (kanal spam'i olmasın); panelden "Kuyruğa al" ile yeniden denenir
        const rec: ChannelPosted = { postedAt: now, error: out.error ?? 'hata' };
        posted[it.key] = rec;
        await stateRef().set({ posted: { [it.key]: rec } }, { merge: true });
        const msg = `${it.key}: ${out.error ?? 'hata'}`;
        result.errors.push(msg);
        lastErrors.push(msg);
      }
    }
  }

  // 2) Güncellemeler: pasife alındı veya fiyat değişti (kota dışı)
  if (Object.keys(posted).length > 0) {
    const products = await getSocialProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const u of pickChannelUpdates(products.map(toChannelRow), posted, UPDATES_PER_RUN)) {
      const p = byId.get(u.id);
      const prev = posted[u.id];
      if (!p || !prev?.messageId) continue;
      const closed = u.reason === 'closed';
      const out = await tgChannel('editMessageCaption', { message_id: prev.messageId, caption: productCaption(p, closed), parse_mode: 'HTML' });
      if (out.ok || isNotModified(out.error)) {
        const rec: ChannelPosted = { ...prev, priceMin: getPriceMin(p), priceMax: getPriceMax(p), ...(closed ? { closed: true } : {}) };
        posted[u.id] = rec;
        await stateRef().set({ posted: { [u.id]: rec } }, { merge: true });
        result.updated.push(u.id);
      } else {
        const msg = `${u.id} ${u.reason}: ${out.error ?? 'hata'}`;
        result.errors.push(msg);
        lastErrors.push(msg);
      }
    }
  }

  if (lastErrors.length) await stateRef().set({ lastError: lastErrors[0].slice(0, 200) }, { merge: true });
  else if (st.lastError && result.posted.length) await stateRef().set({ lastError: FieldValue.delete() }, { merge: true });
  return result;
}

/** Merkez/cron sözleşmesi: sıfır argümanlı tur. */
export async function runTelegramChannelCycle(): Promise<CycleResult> {
  return runTelegramCycleWith();
}

export async function getTelegramStatus(): Promise<PlatformStatus> {
  const configured = channelConfigured();
  try {
    const [st, cfg] = await Promise.all([loadChannelState(), getPlatformGate('telegram')]);
    const enabled = cfg.enabled;
    let queued: number | undefined;
    if (configured) {
      const rows = (await getSocialProducts()).map(toChannelRow);
      queued = pickBacklog(rows, st.posted, Number.MAX_SAFE_INTEGER).length;
    }
    const lastPostAt = Object.values(st.posted).reduce((m, v) => (v.messageId && v.postedAt > m ? v.postedAt : m), 0);
    const detail = !configured
      ? 'Bağlı değil: TELEGRAM_BOT_TOKEN ve TELEGRAM_CHANNEL_ID tanımlayın'
      : st.lastError || `Bugün ${channelTodayCount(st.day, st.todayCount, Date.now())}/${cfg.dailyLimit} gönderi`;
    return { platform: 'telegram', configured, enabled, lastRunAt: st.lastRunAt || undefined, lastPostAt: lastPostAt || undefined, queued, detail };
  } catch (e) {
    return { platform: 'telegram', configured, enabled: false, detail: (e instanceof Error ? e.message : 'durum okunamadı').slice(0, 200) };
  }
}
