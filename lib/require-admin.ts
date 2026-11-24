import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from './firebase-admin';

export const SESSION_COOKIE = '__session';

export interface AdminSession {
  uid: string;
  email: string | null;
}

/** Admin kullanıcı rolünü Firestore users/{uid}.role üzerinden doğrular. */
export async function isAdminUid(uid: string): Promise<boolean> {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists && snap.data()?.role === 'admin';
}

/**
 * __session çerezini (Firebase session cookie) doğrular ve admin rolünü kontrol eder.
 * Geçersiz / iptal edilmiş / admin olmayan oturumlarda null döner.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookie = cookies().get(SESSION_COOKIE)?.value;
    if (!cookie) return null;
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    if (!(await isAdminUid(decoded.uid))) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error('Yetkisiz');
  return session;
}
