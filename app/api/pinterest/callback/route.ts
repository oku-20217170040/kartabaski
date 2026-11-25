import { NextRequest, NextResponse } from 'next/server';
import { exchangePinterestCode } from '@/lib/pinterest';
import { SITE_URL } from '@/lib/site';

// Pinterest yetkilendirme dönüşü: state çerezle eşleşmezse reddedilir.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = req.cookies.get('pin_state')?.value;
  const back = (q: string) => NextResponse.redirect(`${SITE_URL}/admin/pinterest?${q}`);
  if (url.searchParams.get('error')) return back('hata=reddedildi');
  if (!code || !state || !expected || state !== expected) return back('hata=gecersiz');
  try {
    await exchangePinterestCode(code);
  } catch {
    return back('hata=token');
  }
  const res = back('bagli=1');
  res.cookies.delete('pin_state');
  return res;
}
