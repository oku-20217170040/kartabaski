'use server';

import { requireAdmin } from './require-admin';
import { getSocialRows } from './social-products';
import { getSocialSettings, setSocialSettings } from './social-settings';
import { getConnection, updateConnection, whoAmI, isConnected, refreshTokenIfNeeded } from './instagram';
import {
  listPostsBetween, cancelPost, cancelDay, updateCaption, getPost, publishPost, reschedulePost, scheduleProductPost,
  updatePostItems, getProductAvailableImages, regeneratePostCaption, resetPostToProductPhotos, previewUrl,
} from './instagram-posts';
import { runInstagramCycle } from './instagram-auto';
import { trDayKey, trTime, type IgPost, type PostKind, type IgItem } from './instagram-utils';
import { activeCampaign, isShareable } from './social-content-utils';
import type { SocialSettings } from './social-settings-utils';

export interface IgOverview {
  configured: boolean;
  enabled: boolean;
  account?: string;
  accountError?: string;
  tokenExpiresAt?: number;
  settings: SocialSettings;
  posts: (IgPost & { previews: string[] })[];
  /** Elle kuyruğa eklemek için: aktif ve fotoğraflı modeller */
  candidates: { id: string; title: string; category: string }[];
  /** Kategori paylaşım kutusu için */
  categoryRows: { category: string; active: boolean }[];
  campaign?: { name: string; daysLeft: number };
}

/** Dün 00:00'dan 3 gün sonrasına kadar paylaşımlar + bağlantı durumu. */
export async function getInstagramOverviewAction(checkAccount = false): Promise<IgOverview> {
  await requireAdmin();
  const now = Date.now();
  const from = trTime(trDayKey(now - 24 * 3600 * 1000), 0);
  const [settings, conn, configured, list, rows] = await Promise.all([
    getSocialSettings('instagram', true),
    getConnection(),
    isConnected(),
    listPostsBetween(from, from + 4 * 24 * 3600 * 1000),
    getSocialRows(),
  ]);
  const who = checkAccount && configured ? await whoAmI() : null;
  const ac = activeCampaign(now);
  return {
    configured,
    enabled: settings.enabled,
    tokenExpiresAt: conn.tokenExpiresAt,
    settings,
    posts: list.map((p) => ({ ...p, previews: p.items.map((i) => previewUrl(i, p.kind)) })),
    candidates: rows.filter(isShareable).map((r) => ({ id: r.id, title: r.title, category: r.category })),
    categoryRows: rows.map((r) => ({ category: r.category, active: r.active })),
    account: who?.ok ? who.username : undefined,
    accountError: who && !who.ok ? who.error : undefined,
    campaign: ac ? { name: ac.campaign.name, daysLeft: ac.daysLeft } : undefined,
  };
}

/** Token ve hesap kimliğini kaydeder (Firestore, yalnız sunucu); bağlantıyı doğrular. */
export async function saveInstagramCredentialsAction(data: { token: string; userId?: string }): Promise<{ ok: boolean; username?: string; error?: string }> {
  await requireAdmin();
  const token = data.token.trim();
  if (!token) return { ok: false, error: 'Token boş olamaz.' };
  const now = Date.now();
  await updateConnection({
    token,
    tokenExpiresAt: now + 60 * 24 * 3600 * 1000,
    tokenRefreshedAt: now,
    ...(data.userId?.trim() ? { userId: data.userId.trim() } : {}),
  });
  const who = await whoAmI();
  if (!who.ok) return { ok: false, error: `Bağlantı doğrulanamadı: ${who.error}` };
  return { ok: true, username: who.username };
}

export async function setInstagramEnabledAction(enabled: boolean): Promise<void> {
  await requireAdmin();
  await setSocialSettings('instagram', { enabled });
  if (enabled && (await isConnected())) await refreshTokenIfNeeded();
}

export async function updateInstagramSettingsAction(data: Pick<Partial<SocialSettings>, 'dailyLimit' | 'storyLimit' | 'windowStart' | 'windowEnd'>): Promise<void> {
  await requireAdmin();
  await setSocialSettings('instagram', data);
}

/** Otomasyon turunu (plan + yayın) şimdi çalıştırır. */
export async function runInstagramNowAction(): Promise<{ posted: number; planCreated: number; errors: string[]; skipped?: string }> {
  await requireAdmin();
  const r = await runInstagramCycle();
  return { posted: r.posted.length, planCreated: Number(r.planCreated) || 0, errors: r.errors.slice(0, 5), skipped: r.skipped };
}

export async function rescheduleInstagramPostAction(id: string, newPublishAt: number): Promise<void> {
  await requireAdmin();
  await reschedulePost(id, newPublishAt);
}

export async function queueProductToInstagramAction(
  productId: string,
  kind: Exclude<PostKind, 'blog'> = 'carousel',
  delayMinutes?: number
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  await requireAdmin();
  return scheduleProductPost(productId, kind, delayMinutes);
}

export async function cancelInstagramPostAction(id: string): Promise<boolean> {
  await requireAdmin();
  return cancelPost(id);
}

export async function cancelInstagramDayAction(day: string): Promise<number> {
  await requireAdmin();
  return cancelDay(day);
}

export async function updateInstagramCaptionAction(id: string, caption: string): Promise<void> {
  await requireAdmin();
  await updateCaption(id, caption);
}

/** Taslağı beklemeden hemen yayınlar. */
export async function publishInstagramNowAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const p = await getPost(id);
  if (!p || p.status !== 'taslak') return { ok: false, error: 'Yalnızca taslaklar yayınlanır' };
  if (!(await isConnected())) return { ok: false, error: 'Instagram bağlı değil (token tanımlı değil)' };
  return publishPost(p);
}

/** Taslaktaki slayt sırasını veya silinen slaytları günceller. */
export async function updateInstagramPostItemsAction(id: string, newItems: IgItem[]): Promise<void> {
  await requireAdmin();
  await updatePostItems(id, newItems);
}

/** Ürünün tüm fotoğraflarını getirir (taslağa yeni slayt eklemek için). */
export async function getProductAvailableImagesAction(productId: string): Promise<string[]> {
  await requireAdmin();
  return getProductAvailableImages(productId);
}

/** Taslağın açıklamasını güncel şablonla baştan oluşturur. */
export async function regenerateInstagramCaptionAction(id: string): Promise<string> {
  await requireAdmin();
  return regeneratePostCaption(id);
}

/** Karusel taslağını ürünün mevcut tüm fotoğraflarıyla yeniden eşitler. */
export async function resetPostToProductPhotosAction(id: string): Promise<void> {
  await requireAdmin();
  await resetPostToProductPhotos(id);
}
