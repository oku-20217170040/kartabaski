import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { isBot, buildPatch, istanbulParts } from '@/lib/analytics-utils';
import { writePatch } from '@/lib/analytics-server';

// Herkese açık, anonim ziyaret sayacı. Ham IP/kişisel veri saklanmaz: konum yalnızca Vercel'in IP'den
// türettiği (veya Cloudflare cf-ip* başlığından) ülke/şehirden alınır; başlık yoksa "bilinmiyor". Günlük toplam sayaçlara +1 yazılır.
export const runtime = 'nodejs';

const MAX_BODY = 2000;

const Body = z.object({
  t: z.enum(['pv', 'leave', 'ev']),
  vid: z.string().min(8).max(64),
  path: z.string().max(200).optional(),
  n: z.number().int().min(1).max(500).optional(),
  nv: z.boolean().optional(),
  nd: z.boolean().optional(),
  ref: z.string().max(300).optional(),
  utm: z.object({ s: z.string().max(60).optional(), m: z.string().max(60).optional(), c: z.string().max(60).optional() }).optional(),
  dur: z.number().min(0).max(7200).optional(),
  fl: z.boolean().optional(),
  pu: z.boolean().optional(),
  ev: z.string().max(20).optional(),
  slug: z.string().max(100).optional(),
  src: z.string().max(30).optional(),
  q: z.string().max(80).optional(),
  zero: z.boolean().optional(),
});

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent');
  if (isBot(ua)) return noContent();

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`track:${ip}`, 120, 60 * 1000)) return noContent();

  const raw = await req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY) return noContent();

  let json: unknown;
  try { json = JSON.parse(raw); } catch { return noContent(); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return noContent();

  let city = req.headers.get('x-vercel-ip-city') ?? req.headers.get('cf-ipcity') ?? undefined;
  if (city) { try { city = decodeURIComponent(city); } catch { /* ham değer */ } }

  const { day, hour } = istanbulParts();
  const patch = buildPatch(parsed.data, {
    ua: ua ?? '',
    ownHost: req.headers.get('host') ?? '',
    country: req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? undefined,
    city,
    hour,
  });

  try {
    await writePatch(day, patch);
  } catch (e) {
    console.error('[analytics] yazma hatası:', e); // analitik hatası ziyaretçiyi etkilemesin
  }
  return noContent();
}
