// Facebook otomasyonu için saf yardımcılar (testli). Firestore/API erişimi lib/facebook-auto.ts'te.
//
// Kurallar:
// - Aktif kupa modelleri günlük kota ve saat penceresi (panelden ayarlanır) içinde paylaşılır; yeni eklenen ürün hemen gider.
// - Liste bitince 30 gündür paylaşılmayan modeller yeniden sıraya girer (küçük katalogda akış kesilmesin).
// - Model pasife alınırsa gönderi açıklamasının başına "şu an sipariş almıyor" notu yazılır, yeniden aktif olunca kalkar.
import { trDayKey } from './tr-time';
import { inWindow, windowLabel, type SocialSettings } from './social-settings-utils';
import type { SocialProductRow } from './social-content-utils';

export const FB_MIN_GAP_MS = 45 * 60 * 1000;

export interface FbPosted {
  postId?: string; // yayınlandıysa Facebook gönderi kimliği
  postedAt: number;
  active: boolean; // paylaşıldığı andaki durum (pasife alınma senkronu için)
  caption: string; // pasif notu dahil son açıklama (güncellemede yeniden kullanılır)
  error?: string; // yayınlanamadıysa son hata
}

export interface FbState {
  startedAt: number;
  day: string; // bugünkü kotanın TSİ günü
  todayCount: number;
  lastPostAt: number;
  posted: Record<string, FbPosted>;
}

export function emptyState(): FbState {
  return { startedAt: 0, day: '', todayCount: 0, lastPostAt: 0, posted: {} };
}

/** Bugünkü gönderi sayısı; gün değiştiyse 0. */
export function todayCountFor(st: Pick<FbState, 'day' | 'todayCount'>, now: number): number {
  return st.day === trDayKey(now) ? st.todayCount : 0;
}

/** Kota, saat penceresi ve gönderiler arası bekleme kurallarına göre şu an kotadan bir gönderi yapılabilir mi? */
export function canPostNow(
  st: FbState,
  s: Pick<SocialSettings, 'dailyLimit' | 'windowStart' | 'windowEnd'>,
  now: number
): { ok: boolean; reason?: string } {
  if (!inWindow(s, now)) return { ok: false, reason: `paylaşım saatleri dışında (${windowLabel(s)})` };
  if (todayCountFor(st, now) >= s.dailyLimit) return { ok: false, reason: 'günlük kota doldu' };
  if (st.lastPostAt && now - st.lastPostAt < FB_MIN_GAP_MS) return { ok: false, reason: 'paylaşımlar arasında bekleniyor' };
  return { ok: true };
}

/** Durum senkronu gereken paylaşılmış ürünler: aktiflik durumu değişenler (silinmiş/okunamayan ürüne dokunulmaz). */
export function statusChanges(posted: Record<string, FbPosted>, rows: Map<string, Pick<SocialProductRow, 'active'>>): string[] {
  return Object.entries(posted)
    .filter(([, v]) => !!v.postId)
    .filter(([id, v]) => {
      const cur = rows.get(id);
      return !!cur && cur.active !== v.active;
    })
    .map(([id]) => id);
}
