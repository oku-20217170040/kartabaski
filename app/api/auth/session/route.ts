import { NextRequest, NextResponse } from 'next/server';

// Login: ID token'ı HttpOnly cookie olarak kaydet
export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'Token gerekli.' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 gün
    path: '/',
  });
  return res;
}

// Logout: cookie'yi sil
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
