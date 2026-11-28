import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { cloudinaryUrl, displayTitle, formatPriceRange } from './format';
import { getTitle, getSlug, getCategory, getDescription, getDeliveryDays, getPriceMin, getPriceMax } from './product-utils';
import { SITE_URL } from './site';
import { PHONE_DISPLAY } from './constants';
import { trDayKey } from './tr-time';
import type { CycleResult, PlatformStatus } from './social-types';
import { createPin, createBoard, listBoards, refreshPinterestTokenIfNeeded, pinterestConfigured } from './pinterest';
import {
  pinTitle, pinDescription, blogPinDescription, findBoard, boardNameFor, altBoardName, isBoardNameTaken, BLOG_BOARD,
  PIN_MAX_IMAGES, type PinterestBoard,
} from './pinterest-utils';
import { getSocialProducts, getSocialPosts, toChannelRow, toBlogRow, getPlatformGate } from './telegram-channel-data';
import {
  buildQueue, pickNewBlog, pickBacklog, channelGate, manualGate, channelTodayCount, blogKey,
  CHANNEL_PER_RUN,
} from './telegram-channel-utils';
import { yeniSistemAktif } from './paylasim/depo';

/**
 * Pinterest için otomatik paylaşım (yeni kupa modelleri + yeni blog yazıları): kota ve saat penceresi panelden ayarlanır
 * (social_settings/pinterest; varsayılan kapalı); önce yeni eklenenler, sonra mevcut katalog (en yeni önce). Pin, kategorisine göre panoya konur
 * (pano hesapta yoksa kendiliğinden oluşturulur); blog yazıları "Kupa Rehberi" panosuna gider.
 * Pinterest pin düzenleme/silme yapılmaz: pasife alınan ürünün pini kalır (bağlantı ürün sayfasına gider).
 * Token yoksa tur "bağlı değil" diye atlanır. Durum: pinterest_auto/state (Admin SDK).
 */
const stateRef = () => adminDb.collection('pinterest_auto').doc('state');

export interface PinterestPosted {
  postedAt: number;
  pinId?: string;
  board?: string;
  error?: string;
}

export interface PinterestState {
  startedAt: number;
  day: string;
  todayCount: number;
  lastRunAt: number;
  lastError: string;
  posted: Record<string, PinterestPosted>;
}

export async function loadPinterestState(): Promise<PinterestState> {
  const d = (await stateRef().get()).data() ?? {};
  return {
    startedAt: Number(d.startedAt) || 0,
    day: String(d.day ?? ''),
    todayCount: Number(d.todayCount) || 0,
    lastRunAt: Number(d.lastRunAt) || 0,
    lastError: String(d.lastError ?? ''),
    posted: (d.posted ?? {}) as Record<string, PinterestPosted>,
  };
}

/** Hatalı kaydı siler: öğe sıradaki kota turunda yeniden gönderilir. */
export async function requeuePinterestPost(key: string): Promise<void> {
  await stateRef().update({ [`posted.${key}`]: FieldValue.delete() });
}

async function warmImage(url: string): Promise<boolean> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res || !res.ok || !(res.headers.get('content-type') ?? '').includes('image')) return false;
  await res.arrayBuffer();
  return true;
}

/** Hesapta yoksa panoyu oluşturur (ad çakışırsa yedek adla); panoyu listeye de ekler. */
export async function ensureBoard(boards: PinterestBoard[], name: string): Promise<PinterestBoard> {
  const found = findBoard(boards, name);
  if (found) return found;
  const desc = `KAR-TA BASKI ${name}`;
  let created: PinterestBoard;
  try {
    created = await createBoard(name, desc);
  } catch (e) {
    if (!isBoardNameTaken(e instanceof Error ? e.message : '')) throw e;
    created = await createBoard(altBoardName(name), desc);
  }
  boards.push(created);
  return created;
}

export interface PinterestCycleResult extends CycleResult {}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'hata').slice(0, 200);

/** ignoreWindow: yalnızca panelden elle tetiklenir (saat penceresi ve "kapalı" ayarı yok sayılır, günlük kota geçerli kalır). */
export async function runPinterestCycleWith(now = Date.now(), opts: { ignoreWindow?: boolean; max?: number } = {}): Promise<PinterestCycleResult> {
  const result: PinterestCycleResult = { posted: [], errors: [] };
  if (!(await pinterestConfigured())) return { ...result, skipped: "Pinterest bağlı değil (/admin/pinterest → Pinterest'e bağlan)" };
  const cfg = await getPlatformGate('pinterest');
  if (!opts.ignoreWindow && !cfg.enabled) return { ...result, skipped: 'Pinterest otomasyonu panelden kapalı' };

  const st = await loadPinterestState();
  const startedAt = st.startedAt || now;
  await stateRef().set({ startedAt, lastRunAt: now }, { merge: true });

  const gate = opts.ignoreWindow ? manualGate(st.day, st.todayCount, now, cfg) : channelGate(st.day, st.todayCount, now, cfg);
  if (!gate.ok) return { ...result, skipped: gate.reason };

  await refreshPinterestTokenIfNeeded(now);

  const [products, posts] = await Promise.all([getSocialProducts(), getSocialPosts()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const postById = new Map(posts.map((p) => [p.id, p]));
  let todayCount = channelTodayCount(st.day, st.todayCount, now);
  const limit = Math.min(cfg.dailyLimit - todayCount, opts.max ?? CHANNEL_PER_RUN);

  type Item = { key: string; board: string; title: string; description: string; link: string; images: string[] };
  const items: Item[] = [];
  for (const b of pickNewBlog(posts.map(toBlogRow), st.posted, startedAt, limit)) {
    const p = postById.get(b.id);
    if (!p?.coverImage) continue;
    items.push({
      key: blogKey(p.id),
      board: BLOG_BOARD,
      title: pinTitle(p.title),
      description: blogPinDescription({ excerpt: p.excerpt, tags: p.tags }),
      link: `${SITE_URL}/blog/${p.slug}`,
      images: [p.coverImage.startsWith('http') ? p.coverImage : cloudinaryUrl(p.coverImage, 'f_jpg,q_auto,w_1000,c_limit')],
    });
  }
  const room = limit - items.length;
  const devir = !opts.ignoreWindow && (await yeniSistemAktif());
  if (room > 0 && !devir) {
    for (const r of buildQueue(products.map(toChannelRow), st.posted, startedAt, room)) {
      const p = byId.get(r.id);
      if (!p) continue;
      // Çok görselli pinde Pinterest tüm görsellerin en/boy oranını aynı ister: Cloudinary ile beyaz dolgulu kareye getiririz
      // (kırpmadan). Cloudinary dışı adres varsa oran garantisi yok, yalnızca ilk görsel gider.
      const raw = (p.images ?? []).filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, PIN_MAX_IMAGES);
      const images = raw.length > 1 && raw.every((x) => !x.startsWith('http'))
        ? raw.map((x) => cloudinaryUrl(x, 'f_jpg,q_auto,w_1000,h_1000,c_pad,b_white'))
        : raw.slice(0, 1).map((x) => (x.startsWith('http') ? x : cloudinaryUrl(x, 'f_jpg,q_auto,w_1000,c_limit')));
      const category = getCategory(p);
      items.push({
        key: p.id,
        board: boardNameFor(category),
        title: pinTitle(displayTitle(getTitle(p))),
        description: pinDescription({
          priceText: formatPriceRange(getPriceMin(p), getPriceMax(p)),
          category,
          description: getDescription(p),
          deliveryDays: getDeliveryDays(p),
          phoneDisplay: PHONE_DISPLAY,
        }),
        link: `${SITE_URL}/urun/${getSlug(p) || p.id}`,
        images,
      });
    }
  }
  if (items.length === 0) return result;

  let boards: PinterestBoard[];
  try {
    boards = await listBoards();
  } catch (e) {
    const msg = `panolar alınamadı: ${errText(e)}`;
    await stateRef().set({ lastError: msg }, { merge: true });
    return { ...result, errors: [msg] };
  }

  for (const it of items) {
    // Pinterest görseli kendisi çeker: Cloudinary dönüşümü hazır olsun diye önce biz isteriz
    const images = (await Promise.all(it.images.map(async (u) => ((await warmImage(u)) ? u : null)))).filter((u): u is string => !!u);
    if (images.length === 0) {
      await stateRef().set({ posted: { [it.key]: { postedAt: now, error: 'görsel hazırlanamadı' } } }, { merge: true });
      result.errors.push(`${it.key}: görsel hazırlanamadı`);
      continue;
    }
    try {
      const board = await ensureBoard(boards, it.board);
      const pinId = await createPin({ boardId: board.id, title: it.title, description: it.description, link: it.link, imageUrls: images });
      todayCount += 1;
      await stateRef().set({ day: trDayKey(now), todayCount, posted: { [it.key]: { postedAt: now, pinId, board: board.name } } }, { merge: true });
      result.posted.push(it.key);
    } catch (e) {
      const error = errText(e);
      await stateRef().set({ posted: { [it.key]: { postedAt: now, error } } }, { merge: true });
      result.errors.push(`${it.key}: ${error}`);
    }
  }
  if (result.errors.length) await stateRef().set({ lastError: result.errors[0].slice(0, 200) }, { merge: true });
  else if (st.lastError && result.posted.length) await stateRef().set({ lastError: FieldValue.delete() }, { merge: true });
  return result;
}

/** Merkez/cron sözleşmesi: sıfır argümanlı tur. */
export async function runPinterestCycle(): Promise<CycleResult> {
  return runPinterestCycleWith();
}

export async function getPinterestStatus(): Promise<PlatformStatus> {
  try {
    const [configured, cfg, st] = await Promise.all([pinterestConfigured(), getPlatformGate('pinterest'), loadPinterestState()]);
    const enabled = cfg.enabled;
    let queued: number | undefined;
    if (configured) queued = pickBacklog((await getSocialProducts()).map(toChannelRow), st.posted, Number.MAX_SAFE_INTEGER).length;
    const lastPostAt = Object.values(st.posted).reduce((m, v) => (v.pinId && v.postedAt > m ? v.postedAt : m), 0);
    const detail = !configured
      ? "Bağlı değil: /admin/pinterest → Pinterest'e bağlan (ya da PINTEREST_ACCESS_TOKEN)"
      : st.lastError || `Bugün ${channelTodayCount(st.day, st.todayCount, Date.now())}/${cfg.dailyLimit} pin`;
    return { platform: 'pinterest', configured, enabled, lastRunAt: st.lastRunAt || undefined, lastPostAt: lastPostAt || undefined, queued, detail };
  } catch (e) {
    return { platform: 'pinterest', configured: false, enabled: false, detail: errText(e) };
  }
}
