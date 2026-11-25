import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/tiktok';
import { SITE_URL } from '@/lib/site';

// TikTok yetkilendirme dönüşü: state çerezle eşleşmezse reddedilir.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = req.cookies.get('tt_state')?.value;
  const back = (q: string) => NextResponse.redirect(`${SITE_URL}/admin/tiktok?${q}`);
  if (url.searchParams.get('error')) return back('hata=reddedildi');
  if (!code || !state || !expected || state !== expected) return back('hata=gecersiz');
  try {
    await exchangeCode(code);
  } catch {
    return back('hata=token');
  }
  const res = back('bagli=1');
  res.cookies.delete('tt_state');
  return res;
}
