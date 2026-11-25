import 'server-only';

// Yönetici bildirimleri (Telegram bot). TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID tanımlı değilse sessizce atlanır.
// Tüm modüller (sepet talebi, yorum, makine raporu, otomasyon hataları) bu tek kapıyı kullanır.

export const chatIds = (): string[] =>
  (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export const telegramConfigured = (): boolean => !!(process.env.TELEGRAM_BOT_TOKEN && chatIds().length > 0);

/** Telegram'a düz/Markdown olmayan metin gönderir. En az bir sohbete ulaştıysa true. */
export async function sendTelegramText(text: string, reply_markup?: unknown): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ids = chatIds();
  if (!token || ids.length === 0) return false;
  let ok = false;
  for (const chat_id of ids) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: text.slice(0, 4000), disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) }),
        cache: 'no-store',
      });
      if (res.ok) ok = true;
      else console.warn('[notify] telegram', res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.warn('[notify] telegram hata', e);
    }
  }
  return ok;
}

/** Kısa yönetici bildirimi: başlık + gövde. Hata fırlatmaz. */
export async function notifyAdmin(title: string, body: string): Promise<boolean> {
  return sendTelegramText(`${title}\n\n${body}`).catch(() => false);
}
