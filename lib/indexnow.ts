import 'server-only';

import { adminDb } from './firebase-admin';
import { SITE_URL } from './site';
import { changedUrls } from './indexnow-utils';
import sitemap from '@/app/sitemap';

// IndexNow: yeni ya da değişen sayfalar Bing ve ortaklarına hemen bildirilir.
// Anahtar gizli değildir; protokol gereği sitede `public/<anahtar>.txt` olarak yayınlanır.
export const INDEXNOW_KEY = '498bd2b8904a664c407897e2799e1bea';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const stateRef = () => adminDb.collection('seo_state').doc('indexnow');

/** Zamanlanmış tur: son bildirimden beri değişen ürün ve yazı sayfalarını gönderir. */
export async function runIndexNowStep(now = Date.now()): Promise<{ sent: number; skipped?: string }> {
  const host = new URL(SITE_URL).host;
  if (host.startsWith('localhost')) return { sent: 0, skipped: 'yerel ortam' };
  const since = Number((await stateRef().get()).data()?.lastRun ?? 0);
  const urls = changedUrls(await sitemap(), since, SITE_URL);
  if (!urls.length) return { sent: 0 };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  // Başarısızsa zaman ilerletilmez: bir sonraki turda yeniden denenir.
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow ${res.status}`);
  await stateRef().set({ lastRun: now, lastCount: urls.length }, { merge: true });
  return { sent: urls.length };
}
