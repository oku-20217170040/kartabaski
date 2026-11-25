import 'server-only';

import type { Metadata } from 'next';
import { composeRootMetadata } from './seo-meta';
import { DEFAULT_SEO } from './seo-settings';

/**
 * app/layout.tsx için: `export async function generateMetadata() { return buildRootMetadata(); }`.
 * Ayarlar `settings/seo` belgesinden (önbellekli, etiket: 'seo-settings'); okunamazsa varsayılanlara düşer.
 */
export async function buildRootMetadata(): Promise<Metadata> {
  try {
    const { getCachedSeoSettings } = await import('./seo-store');
    return composeRootMetadata(await getCachedSeoSettings());
  } catch (err) {
    console.warn('[seo-meta] ayarlar okunamadı, varsayılan kullanıldı:', err);
    return composeRootMetadata(DEFAULT_SEO);
  }
}

