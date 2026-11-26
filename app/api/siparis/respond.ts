import { NextRequest, NextResponse } from 'next/server';
import { OrderError } from '@/lib/siparis';
import { rateLimit } from '@/lib/rate-limit';

export function tooMany(req: NextRequest, key: string, max: number, windowMs: number): NextResponse | null {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (rateLimit(`${key}:${ip}`, max, windowMs)) return null;
  return NextResponse.json({ error: 'Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.' }, { status: 429 });
}

/** Gövde okunmadan önce boyutu denetler. */
export function tooLarge(req: NextRequest, maxBytes: number): NextResponse | null {
  const length = Number(req.headers.get('content-length') || 0);
  if (length && length <= maxBytes) return null;
  return NextResponse.json({ error: 'Gönderdiğiniz dosya çok büyük.' }, { status: 413 });
}

export function failure(error: unknown): NextResponse {
  if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[api/siparis]', error);
  return NextResponse.json({ error: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' }, { status: 500 });
}
