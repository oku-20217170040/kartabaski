import { NextRequest, NextResponse } from 'next/server';
import { handleUpdate } from '@/lib/bot';
import { sameSecret, webhookSecret } from '@/lib/bot-utils';
import { botToken } from '@/lib/telegram-api';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 64 * 1024;

/** Telegram'ın gruptaki komut ve düğmeleri ilettiği adres. Yalnız gizli başlığı doğru gelen istek işlenir. */
export async function POST(req: NextRequest) {
  const token = botToken();
  if (!token || !sameSecret(req.headers.get('x-telegram-bot-api-secret-token') ?? '', webhookSecret(token))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ ok: true });
  try {
    await handleUpdate(JSON.parse(raw));
  } catch (error) {
    console.error('[telegram webhook]', error);
  }
  // Hata olsa da 200: Telegram aynı güncellemeyi sonsuza dek yeniden göndermesin.
  return NextResponse.json({ ok: true });
}
