import { NextRequest, NextResponse } from 'next/server';
import { installBot } from '@/lib/bot';
import { getBotSettings } from '@/lib/bot-store';
import { webhookSecret } from '@/lib/bot-utils';
import { isCronAuthorized } from '@/lib/cron-utils';
import { SITE_URL } from '@/lib/site';
import { botToken } from '@/lib/telegram-api';

// Sunucu betikleri için (tools/sunucu). CRON_SECRET zorunlu.
export const dynamic = 'force-dynamic';

const allowed = (req: NextRequest) => isCronAuthorized(process.env.CRON_SECRET, req.headers.get('authorization'));
const plain = (text: string, status = 200) => new NextResponse(`${text}\n`, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

/** Nöbet betiği: bağlı grubun kimliği (site kapalıyken uyarı gönderebilmek için saklar). */
export async function GET(req: NextRequest) {
  if (!allowed(req)) return plain('', 401);
  return plain((await getBotSettings()).chatId ?? '');
}

/** Kurulum betiği: webhook ve komut listesini Telegram'a bildirir. */
export async function POST(req: NextRequest) {
  if (!allowed(req)) return plain('', 401);
  if (!botToken()) return plain('TELEGRAM_BOT_TOKEN tanımlı değil.', 503);
  const result = await installBot(`${SITE_URL}/api/telegram`, webhookSecret(botToken()));
  return plain(result.text, result.ok ? 200 : 502);
}
