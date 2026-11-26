import 'server-only';

import { getBotSettings } from './bot-store';
import { botToken, tg } from './telegram-api';

// Yönetici bildirimleri (Telegram bot). Hedef: botun bağlandığı grup (/kur); bağlanmadıysa TELEGRAM_CHAT_ID.
// Anahtar ya da hedef yoksa sessizce atlanır. Tüm modüller (sipariş, yorum, makine raporu, otomasyon) bu tek kapıyı kullanır.

export async function chatIds(): Promise<string[]> {
  if (!botToken()) return [];
  const bound = await getBotSettings().then((s) => s.chatId).catch(() => undefined);
  if (bound) return [bound];
  return (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

export const telegramReady = async (): Promise<boolean> => (await chatIds()).length > 0;

/** Telegram'a düz/Markdown olmayan metin gönderir. En az bir sohbete ulaştıysa true. */
export async function sendTelegramText(text: string, reply_markup?: unknown): Promise<boolean> {
  let ok = false;
  for (const chat_id of await chatIds()) {
    const res = await tg('sendMessage', { chat_id, text: text.slice(0, 4000), disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
    if (res.ok) ok = true;
  }
  return ok;
}

/** Kısa yönetici bildirimi: başlık + gövde. Hata fırlatmaz. */
export async function notifyAdmin(title: string, body: string): Promise<boolean> {
  return sendTelegramText(`${title}\n\n${body}`).catch(() => false);
}
