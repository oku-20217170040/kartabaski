import 'server-only';

// Telegram Bot API'ye tek kapı. Hata fırlatmaz; anahtar hiçbir kayda yazılmaz.

export interface TgResult<T = unknown> { ok: boolean; result?: T; description?: string }

const TIMEOUT_MS = 15_000;
const MAX_WAIT_S = 10;

export const botToken = (): string => process.env.TELEGRAM_BOT_TOKEN ?? '';

export async function tg<T = unknown>(method: string, body: Record<string, unknown>, retries = 2): Promise<TgResult<T>> {
  const token = botToken();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN tanımlı değil' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResult<T> & { parameters?: { retry_after?: number } };
    // Hız sınırı: Telegram'ın söylediği süre kadar bekleyip yeniden dener.
    const wait = data.parameters?.retry_after;
    if (res.status === 429 && retries > 0 && wait && wait <= MAX_WAIT_S) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      return tg<T>(method, body, retries - 1);
    }
    // Aynı içerikle düzenleme isteği hata sayılmaz.
    if (!data.ok && !/message is not modified/i.test(data.description ?? '')) {
      console.warn('[telegram]', method, res.status, String(data.description ?? '').slice(0, 200));
    }
    return data;
  } catch (e) {
    console.warn('[telegram]', method, 'ulaşılamadı', e instanceof Error ? e.name : e);
    return { ok: false, description: 'Telegram’a ulaşılamadı' };
  }
}
