import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminSession } from '@/lib/require-admin';
import { tiktokAuthUrl, tiktokConfigured } from '@/lib/tiktok';

// Yönetici: TikTok yetkilendirmesini başlatır (state çerezle korunur).
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  if (!tiktokConfigured()) return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET tanımlı değil' }, { status: 500 });
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(tiktokAuthUrl(state));
  res.cookies.set('tt_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
