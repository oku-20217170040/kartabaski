import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { isAdminUid, SESSION_COOKIE } from '@/lib/require-admin';

export const runtime = 'nodejs';

const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000; // 5 gün
const MAX_AUTH_AGE_S = 5 * 60; // yakın zamanda giriş yapılmış olmalı

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Login: ID token'ı doğrula, admin rolünü kontrol et, session cookie oluştur
export async function POST(req: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'Token gerekli.' }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);

    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_S) {
      return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yapın.' }, { status: 401 });
    }

    if (!(await isAdminUid(decoded.uid))) {
      return NextResponse.json({ error: 'Bu hesabın yönetici yetkisi yok.' }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, { ...cookieBase, maxAge: EXPIRES_IN_MS / 1000 });
    return res;
  } catch (err) {
    console.error('Session oluşturulamadı:', err);
    return NextResponse.json({ error: 'Kimlik doğrulanamadı.' }, { status: 401 });
  }
}

// Logout: cookie'yi sil, refresh token'ları iptal et
export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // geçersiz cookie: yine de temizle
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 });
  return res;
}
