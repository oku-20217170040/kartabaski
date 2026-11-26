import 'server-only';

import {
  BotAction, Card, HELP_TEXT, decodeAction, deliverConfirm, orderCard, orderList, parseCargo, parseCommand,
  pickReminders, reviewCard, sameSecret, setupCode, staleKeys, summaryText,
} from './bot-utils';
import { forgetSent, getBotSettings, getBotState, patchBotState, saveBotSettings } from './bot-store';
import { sendTelegramText, telegramReady } from './notify';
import { botToken, tg } from './telegram-api';
import { claimOrder, findOrderByCode, getOrderRequest, getProduction, listOpenOrderRequests, setOrderAdmin, setShipping } from './siparis';
import { sendToMachine } from './siparis-uretim';
import { listOrders, setOrderStatus } from './orders';
import { ORDER_STATUS_LABELS, isActiveStatus, nextStatus } from './orders-utils';
import { getReview, getReviewStats, setReviewStatus } from './reviews';
import type { Review } from './reviews-utils';
import { machineReportText } from './machine-store';
import { getAllSocialStatus } from './social-run';
import { setSocialSettings } from './social-settings';
import { PLATFORMS } from './social-settings-utils';
import type { SocialPlatform } from './social-types';
import { OrderRequest, Proof, normalizeOrderCode } from './siparis-types';
import { rateLimit } from './rate-limit';
import { SITE_URL } from './site';
import { trDayKey, trHour } from './tr-time';
import type { StepResult } from './cron-utils';

interface User { id: number; first_name?: string; username?: string }
interface Chat { id: number; type?: string; title?: string }
interface Message { message_id: number; chat: Chat; from?: User; text?: string; migrate_to_chat_id?: number }
export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: { id: string; from: User; data?: string; message?: Message };
}

const SUMMARY_HOUR = 9;
const CHECK_EVERY_MS = 55 * 60_000;
const SOCIAL_NAMES: Record<SocialPlatform, string> = {
  instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', telegram: 'Telegram kanalı', pinterest: 'Pinterest', tiktok: 'TikTok',
};

const displayName = (u: User) => (u.first_name || u.username || String(u.id)).slice(0, 40);
const clock = () => new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const send = (chatId: number | string, card: Card) => tg('sendMessage', { chat_id: chatId, disable_web_page_preview: true, ...card });
const say = (chatId: number | string, text: string) => send(chatId, { text });
const edit = (m: Message, card: Card) => tg('editMessageText', { chat_id: m.chat.id, message_id: m.message_id, disable_web_page_preview: true, ...card });

// ── Olay bildirimleri (hata fırlatmaz: müşterinin işlemi etkilenmemeli) ───────

const quietly = async (what: string, fn: () => Promise<unknown>) => {
  try { await fn(); } catch (e) { console.warn(`[bot] ${what}`, e); }
};

async function card(order: OrderRequest, header?: string, footer?: string): Promise<Card> {
  return orderCard(order, await getProduction(order), { site: SITE_URL, header, footer });
}

async function broadcast(c: Card) {
  await sendTelegramText(c.text, c.reply_markup);
}

export const notifyNewOrder = (order: OrderRequest) =>
  quietly('yeni sipariş', async () => broadcast(await card(order, 'Yeni sipariş')));

export const notifyProofReply = (order: OrderRequest, proof: Proof) =>
  quietly('önizleme cevabı', async () => {
    const header = proof.state === 'onaylandi' ? 'Müşteri önizlemeyi onayladı' : 'Müşteri düzeltme istedi';
    await broadcast(await card({ ...order, proof }, header, proof.reply ? `Müşterinin yazdığı: “${proof.reply.slice(0, 600)}”` : undefined));
  });

export const notifyNewReview = (review: Review) =>
  quietly('yorum', async () => broadcast(reviewCard(review, SITE_URL)));

/** Zamanlanmış işte hata varsa gruba yazar; aynı adım için günde bir kez. */
export const notifyCronFailures = (steps: StepResult[]) =>
  quietly('otomasyon uyarısı', async () => {
    const failed = steps.filter((s) => !s.ok);
    if (!failed.length || !(await telegramReady())) return;
    const day = trDayKey(Date.now());
    const sent = (await getBotState()).sent ?? {};
    const fresh = failed.filter((s) => !sent[`hata_${s.name}_${day}`]);
    if (!fresh.length) return;
    const ok = await sendTelegramText(`Otomasyonda hata\n\n${fresh.map((s) => `${s.name}: ${s.error}`).join('\n')}`);
    if (ok) await patchBotState({ sent: Object.fromEntries(fresh.map((s) => [`hata_${s.name}_${day}`, Date.now()])) });
  });

// ── Zamanlanmış tur ──────────────────────────────────────────────────────────

async function summary(now: number): Promise<string> {
  const [orders, jobs, reviews] = await Promise.all([listOpenOrderRequests(), listOrders(), getReviewStats()]);
  return summaryText({ orders, jobs: jobs.filter((j) => isActiveStatus(j.status)), pendingReviews: reviews.pending, now });
}

/** Sabah özeti (09:00 sonrası günde bir) ve saatlik hatırlatma taraması. */
export async function runBotStep(now = Date.now()): Promise<{ summary: boolean; reminders: number; skipped?: string }> {
  if (!(await telegramReady())) return { summary: false, reminders: 0, skipped: 'Telegram bağlı değil' };
  const state = await getBotState();
  const day = trDayKey(now);
  const hour = trHour(now);
  let summarized = false;
  if (hour >= SUMMARY_HOUR && hour < 22 && state.summaryDay !== day) {
    summarized = await sendTelegramText(await summary(now));
    if (summarized) await patchBotState({ summaryDay: day });
  }

  let reminders = 0;
  if (now - (state.checkedAt ?? 0) >= CHECK_EVERY_MS) {
    const sent = state.sent ?? {};
    const due = pickReminders(await listOpenOrderRequests(), sent, now).slice(0, 5);
    const done: Record<string, number> = {};
    for (const r of due) {
      const order = await getOrderRequest(r.token);
      if (!order) continue;
      const c = await card(order, r.header);
      if (await sendTelegramText(c.text, c.reply_markup)) { done[r.key] = now; reminders += 1; }
    }
    await patchBotState({ checkedAt: now, ...(reminders ? { sent: done } : {}) });
    await forgetSent(staleKeys(sent, now));
  }
  return { summary: summarized, reminders };
}

// ── Gelen mesajlar ───────────────────────────────────────────────────────────

async function bindGroup(message: Message, user: User, code: string) {
  const chat = message.chat;
  if (!rateLimit(`bot-kur:${chat.id}`, 5, 10 * 60_000)) return;
  if (!sameSecret(code, setupCode(botToken()))) return void (await say(chat.id, 'Kurulum kodu yanlış.'));
  if (chat.type !== 'group' && chat.type !== 'supergroup') return void (await say(chat.id, 'Bu komutu yönetim grubunda yazın.'));
  const current = await getBotSettings(true);
  // Bağlı bir grup varken yalnız mevcut yönetici başka gruba taşıyabilir.
  if (current.chatId && current.chatId !== String(chat.id) && !current.admins[user.id]) {
    return void (await say(chat.id, 'Bot başka bir gruba bağlı. Taşımayı mevcut bir yönetici yapabilir.'));
  }
  await saveBotSettings({ chatId: String(chat.id), title: chat.title, admins: { ...current.admins, [user.id]: displayName(user) } });
  await say(chat.id, `Grup bağlandı. ${displayName(user)} yönetici olarak eklendi.\nDiğer yöneticiler /katil yazsın; onaylamak yeterli.\nKomutlar için /yardim`);
}

async function askToJoin(chatId: number, user: User) {
  const settings = await getBotSettings(true);
  if (settings.admins[user.id]) return void (await say(chatId, 'Zaten yöneticisiniz.'));
  await patchBotState({ pending: { [user.id]: displayName(user) } });
  await send(chatId, {
    text: `${displayName(user)} yönetici olmak istiyor. Mevcut bir yönetici onaylasın.`,
    reply_markup: { inline_keyboard: [[{ text: 'Onayla', callback_data: `j:${user.id}` }]] },
  });
}

async function automationCard(): Promise<Card> {
  const statuses = await getAllSocialStatus();
  return {
    text: ['Sosyal medya otomasyonları', '', ...statuses.map((s) => `${SOCIAL_NAMES[s.platform]}: ${s.enabled ? 'açık' : 'kapalı'}${s.configured ? '' : ' (hesap bağlı değil)'}`)].join('\n'),
    reply_markup: {
      inline_keyboard: statuses.filter((s) => s.configured || s.enabled).map((s) => [{
        text: `${SOCIAL_NAMES[s.platform]}: ${s.enabled ? 'kapat' : 'aç'}`,
        callback_data: `o:${s.platform}:${s.enabled ? 0 : 1}`,
      }]),
    },
  };
}

async function findByInput(chatId: number, input: string): Promise<OrderRequest | null> {
  const code = normalizeOrderCode(input);
  const order = code ? await findOrderByCode(code) : null;
  if (!order) await say(chatId, code ? 'Bu kodla sipariş bulunamadı.' : 'Sipariş kodunu şöyle yazın: /siparis KBXXXXXXXXXXX');
  return order;
}

async function onMessage(message: Message) {
  const chatId = message.chat.id;
  if (message.migrate_to_chat_id) {
    // Telegram grubu "süper grup"a yükseltince kimlik değişir.
    const s = await getBotSettings(true);
    if (s.chatId === String(chatId)) await saveBotSettings({ ...s, chatId: String(message.migrate_to_chat_id) });
    return;
  }
  const user = message.from;
  const command = message.text ? parseCommand(message.text) : null;
  if (!user || !command) return;
  if (command.cmd === 'kur') return bindGroup(message, user, command.args);

  // Bağlı grup dışındaki her şey sessizce yok sayılır.
  const settings = await getBotSettings();
  if (settings.chatId !== String(chatId)) return;
  if (command.cmd === 'katil') return askToJoin(chatId, user);
  if (!(await getBotSettings(true)).admins[user.id]) return void (await say(chatId, 'Bu komut için yönetici olmalısınız. /katil yazın.'));

  const now = Date.now();
  switch (command.cmd) {
    case 'start':
    case 'yardim':
      return void (await say(chatId, HELP_TEXT));
    case 'siparisler':
      return void (await send(chatId, orderList(await listOpenOrderRequests())));
    case 'siparis': {
      const order = await findByInput(chatId, command.args);
      if (order) await send(chatId, await card(order));
      return;
    }
    case 'bugun':
      return void (await say(chatId, await summary(now)));
    case 'rapor':
      return void (await say(chatId, await machineReportText(now, 7)));
    case 'kargo': {
      const parsed = parseCargo(command.args);
      if (typeof parsed === 'string') return void (await say(chatId, parsed));
      const order = await findByInput(chatId, parsed.code);
      if (!order) return;
      await setShipping(order.token, parsed.shipping);
      await send(chatId, await card({ ...order, shipping: parsed.shipping }, 'Kargo bilgisi kaydedildi', `${displayName(user)} girdi · ${clock()}`));
      return;
    }
    case 'otomasyon':
      return void (await send(chatId, await automationCard()));
    case 'yoneticiler':
      return void (await say(chatId, `Yöneticiler:\n${Object.values((await getBotSettings()).admins).join('\n')}`));
    default:
      return void (await say(chatId, 'Bu komutu bilmiyorum. /yardim'));
  }
}

// ── Düğmeler ─────────────────────────────────────────────────────────────────

/** Aynı siparişte iki kişi aynı anda basarsa işlemler sıraya girer (tek sunucu). */
const queue = new Map<string, Promise<unknown>>();
async function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (queue.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
  queue.set(key, run);
  try { return await run; } finally { if (queue.get(key) === run) queue.delete(key); }
}

/** Düğmenin işini yapar; kullanıcıya açılacak kısa uyarıyı döner. */
async function act(action: BotAction, user: User, message: Message): Promise<string> {
  const who = displayName(user);
  const footer = (what: string) => `${who} ${what} · ${clock()}`;

  if (action.kind === 'review') {
    const current = await getReview(action.id);
    if (!current) return 'Yorum bulunamadı.';
    if (current.status !== 'bekliyor') {
      await edit(message, reviewCard(current, SITE_URL));
      return 'Bu yorum zaten değerlendirilmiş.';
    }
    const updated = await setReviewStatus(action.id, action.status);
    if (updated) await edit(message, reviewCard(updated, SITE_URL, footer(action.status === 'onayli' ? 'yayınladı' : 'gizledi')));
    return action.status === 'onayli' ? 'Yorum yayında.' : 'Yorum gizlendi.';
  }
  if (action.kind === 'join') {
    const name = (await getBotState()).pending?.[action.userId];
    const settings = await getBotSettings(true);
    if (settings.admins[action.userId]) return 'Zaten yönetici.';
    if (!name) return 'İstek bulunamadı. Tekrar /katil yazılsın.';
    await saveBotSettings({ ...settings, admins: { ...settings.admins, [action.userId]: name } });
    await edit(message, { text: `${name} yönetici oldu. Onaylayan: ${who}` });
    return 'Onaylandı.';
  }
  if (action.kind === 'social') {
    if (!(PLATFORMS as string[]).includes(action.platform)) return 'Bilinmeyen platform.';
    await setSocialSettings(action.platform as SocialPlatform, { enabled: action.on });
    await edit(message, await automationCard());
    return `${SOCIAL_NAMES[action.platform as SocialPlatform]} ${action.on ? 'açıldı' : 'kapatıldı'}.`;
  }

  return serial(action.token, async () => {
    let order = await getOrderRequest(action.token);
    if (!order) return 'Sipariş bulunamadı (silinmiş olabilir).';
    const refresh = async (header?: string, note?: string) => {
      order = (await getOrderRequest(action.token)) ?? order!;
      await edit(message, await card(order, header, note));
    };

    switch (action.kind) {
      case 'show':
        await send(message.chat.id, await card(order));
        return '';
      case 'refresh':
        await refresh();
        return 'Güncellendi.';
      case 'cargo':
        await say(message.chat.id, `Kargo firmasını ve takip numarasını şöyle yazın:\n/kargo ${order.code} Yurtiçi Kargo 1234567890`);
        return '';
      case 'claim': {
        const owner = await claimOrder(action.token, who);
        await refresh();
        return owner === who ? 'Sipariş sizde.' : `${owner} zaten ilgileniyor.`;
      }
      default:
        break;
    }

    if (order.status === 'iptal' || order.status === 'tamamlandi') {
      await refresh();
      return 'Bu sipariş kapanmış.';
    }
    if (action.kind === 'machine') {
      if (order.orderId) {
        await refresh();
        return 'Zaten üretimde.';
      }
      await sendToMachine(action.token);
      await claimOrder(action.token, who);
      await refresh('Üretime alındı', footer('üretime aldı'));
      return 'Üretime aktarıldı.';
    }
    if (action.kind !== 'advance' && action.kind !== 'deliver') return '';

    const production = await getProduction(order);
    // Eski bir mesajdaki düğme aşamayı iki kez ilerletmemeli.
    if (!order.orderId || production?.status !== action.from) {
      await refresh();
      return 'Aşama değişmiş; kart güncellendi.';
    }
    const next = nextStatus(action.from);
    if (!next) return 'Sonraki aşama yok.';
    if (next === 'teslim' && action.kind === 'advance') {
      await tg('editMessageReplyMarkup', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: deliverConfirm(action.token, action.from) } });
      return 'Teslim muhasebeye yazılır. Onaylayın.';
    }
    await setOrderStatus(order.orderId, next);
    if (next === 'teslim') await setOrderAdmin(action.token, { status: 'tamamlandi' });
    await refresh(`Aşama: ${ORDER_STATUS_LABELS[next]}`, footer(`aşamayı “${ORDER_STATUS_LABELS[next]}” yaptı`));
    return `Aşama: ${ORDER_STATUS_LABELS[next]}`;
  });
}

async function onCallback(query: NonNullable<Update['callback_query']>) {
  const answer = (text: string) => tg('answerCallbackQuery', { callback_query_id: query.id, ...(text ? { text: text.slice(0, 190) } : {}) });
  const message = query.message;
  const settings = await getBotSettings(true);
  if (!message || settings.chatId !== String(message.chat.id)) return void (await answer('Bu grup bota bağlı değil. Önce /kur kodunu yazın.'));
  if (!settings.admins[query.from.id]) return void (await answer('Bu düğme için yönetici olmalısınız. Gruba /katil yazın.'));
  const action = decodeAction(query.data ?? '');
  if (!action) return void (await answer('Geçersiz düğme.'));
  try {
    await answer(await act(action, query.from, message));
  } catch (e) {
    console.error('[bot] düğme', e);
    await answer('İşlem yapılamadı. Panelden deneyin.');
  }
}

/** Telegram aynı güncellemeyi yeniden gönderebilir. */
const seen: number[] = [];

export async function handleUpdate(update: Update): Promise<void> {
  if (typeof update?.update_id !== 'number' || seen.includes(update.update_id)) return;
  seen.push(update.update_id);
  if (seen.length > 500) seen.shift();
  if (update.callback_query) return onCallback(update.callback_query);
  if (!update.message) return;
  try {
    await onMessage(update.message);
  } catch (e) {
    console.error('[bot] komut', e);
    await say(update.message.chat.id, 'İşlem yapılamadı. Biraz sonra tekrar deneyin.');
  }
}

// ── Kurulum ──────────────────────────────────────────────────────────────────

/** Telegram'a adresi ve komut listesini bildirir; kurulum betiğine yazılacak metni döner. */
export async function installBot(url: string, secret: string): Promise<{ ok: boolean; text: string }> {
  const me = await tg<{ username?: string }>('getMe', {});
  if (!me.ok) return { ok: false, text: `Bot anahtarı kabul edilmedi: ${me.description}` };
  const hook = await tg('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  if (!hook.ok) return { ok: false, text: `Telegram adresi kabul etmedi: ${hook.description}` };
  await tg('setMyCommands', {
    commands: [
      ['siparisler', 'Açık siparişler'], ['siparis', 'Kodla sipariş kartı'], ['bugun', 'Günün özeti'], ['rapor', 'Son 7 gün'],
      ['kargo', 'Kargo bilgisi gir'], ['otomasyon', 'Otomasyonlar'], ['yoneticiler', 'Yöneticiler'], ['katil', 'Yönetici olmak iste'], ['yardim', 'Komut listesi'],
    ].map(([command, description]) => ({ command, description })),
  });
  const settings = await getBotSettings(true);
  const bound = settings.chatId ? `Bot şu gruba bağlı: ${settings.title || settings.chatId}` : [
    'Şimdi Telegram’da:',
    `1) Yönetim grubunu kurun, İhsan’ı, Fahrettin’i ve @${me.result?.username} botunu ekleyin.`,
    `2) Gruba şunu yazın:  /kur ${setupCode(botToken())}`,
    '3) Diğer yöneticiler /katil yazsın, siz “Onayla” deyin.',
  ].join('\n');
  return { ok: true, text: `Bot hazır: @${me.result?.username}\n${bound}` };
}
