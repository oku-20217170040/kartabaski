import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminSession } from '@/lib/require-admin';
import { pinterestAuthUrl, pinterestOAuthReady } from '@/lib/pinterest';

// Yönetici: Pinterest yetkilendirmesini başlatır (state çerezle korunur).
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  if (!pinterestOAuthReady()) return NextResponse.json({ error: 'PINTEREST_APP_ID / PINTEREST_APP_SECRET tanımlı değil' }, { status: 500 });
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(pinterestAuthUrl(state));
  res.cookies.set('pin_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
