'use server';

import { revalidateTag } from 'next/cache';
import { requireAdmin } from './require-admin';
import { getSeoSettings, saveSeoSettings } from './seo-store';
import { normalizeSeoSettings, type SeoSettings } from './seo-settings';

export async function getSeoSettingsAction(): Promise<SeoSettings> {
  await requireAdmin();
  return getSeoSettings();
}

/** Girdi sunucuda normalleştirilir (kırpma, tekilleştirme, doğrulama kodu ayıklama); kaydedilen son hâl döner. */
export async function saveSeoSettingsAction(data: SeoSettings): Promise<SeoSettings> {
  await requireAdmin();
  const clean = normalizeSeoSettings(data);
  await saveSeoSettings(clean);
  revalidateTag('seo-settings');
  return clean;
}
