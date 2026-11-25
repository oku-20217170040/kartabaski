import 'server-only';

import { unstable_cache } from 'next/cache';
import { adminDb } from './firebase-admin';
import { DEFAULT_SEO, normalizeSeoSettings, type SeoSettings } from './seo-settings';

const doc = () => adminDb.collection('settings').doc('seo');

/** Önbelleksiz okuma (admin sayfası). Belge yoksa varsayılanlar. */
export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const snap = await doc().get();
    return snap.exists ? normalizeSeoSettings(snap.data()) : DEFAULT_SEO;
  } catch (err) {
    console.warn('[seo-store] okunamadı:', err);
    return DEFAULT_SEO;
  }
}

// Spark kotası: kök metadata her istekte Firestore'a gitmesin; kayıtta revalidateTag('seo-settings') temizler.
export const getCachedSeoSettings = unstable_cache(() => getSeoSettings(), ['seo-settings'], {
  tags: ['seo-settings'],
  revalidate: 3600,
});

export async function saveSeoSettings(s: SeoSettings): Promise<void> {
  await doc().set(s);
}
