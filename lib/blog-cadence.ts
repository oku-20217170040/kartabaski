// Blog yayın sıklığı kuralı (saf, testli). Cron her 30 dakikada döner; bir tur en fazla bir yazı yayınlar.
// Okuma tasarrufu: planlı yazı listesi (tüm `posts` koleksiyonu) yalnızca bu kural "evet" dediğinde okunur.
import { trDayKey, trHour, trTime, DAY_MS } from './tr-time';

export const BLOG_DAILY_MAX = 2; // TSİ gününde en fazla yayınlanacak yazı
export const BLOG_MIN_GAP_MS = 4 * 3600 * 1000; // iki yayın arası en az
export const BLOG_GRACE_MS = 5 * 60 * 1000; // planlı saatten en çok bu kadar önce yayınlanabilir (zamanlayıcı sapması payı)
export const BLOG_START_HOUR = 7; // TSİ 07:00'den önce yayın/üretim yok
export const BLOG_PUBLISH_HOUR = 10; // otomatik planlanan yazıların TSİ yayın saati
export const BLOG_SPACING_DAYS = 2; // otomatik planlanan iki yazı arası gün
export const BLOG_QUEUE_MIN = 3; // kuyrukta bu kadardan az planlı yazı varsa yeni taslak üretilir

export interface BlogStepState {
  blogDay?: string; // son denemenin TSİ günü
  blogCount?: number; // o gün yayınlanan yazı sayısı
  blogLastAt?: number; // son yayın anı (ms)
  blogNextAt?: number; // son denemede sıradaki planlı yazının tarihi; 0 = sıra boştu
}

/** Bu cron turunda planlı yazı listesi okunup bir yazı yayınlanmayı denemeli mi? */
export function blogSlotDue(now: number, s: BlogStepState): boolean {
  if (trHour(now) < BLOG_START_HOUR) return false;
  if (s.blogLastAt && now - s.blogLastAt < BLOG_MIN_GAP_MS) return false; // gün değişse de geçerli
  if (s.blogDay !== trDayKey(now)) return true; // yeni gün: bir kez bak
  if ((s.blogCount ?? 0) >= BLOG_DAILY_MAX) return false;
  const next = s.blogNextAt;
  if (next === undefined) return true; // eski durum belgesi: bilinmiyor, bak
  if (next === 0) return false; // bugün sıra boştu; yeni planlananlar yarın değerlendirilir
  return next - BLOG_GRACE_MS <= now;
}

/** Deneme sonrası yazılacak durum. `published` = bu turda yayınlandı mı; `nextAt` = kalan sıranın ilk tarihi (yoksa 0). */
export function nextBlogState(now: number, s: BlogStepState, published: boolean, nextAt: number): Required<BlogStepState> {
  const today = trDayKey(now);
  const count = s.blogDay === today ? s.blogCount ?? 0 : 0;
  return {
    blogDay: today,
    blogCount: published ? count + 1 : count,
    blogLastAt: published ? now : s.blogLastAt ?? 0,
    blogNextAt: nextAt > 0 ? nextAt : 0,
  };
}

/** Cron'un kendiliğinden taslak üretmesi yalnız `BLOG_AUTO_GENERATE=1` ile açılır (varsayılan kapalı). */
export function blogAutoGenerateEnabled(value: string | undefined = process.env.BLOG_AUTO_GENERATE): boolean {
  return value === '1';
}

/** Bugün yeni taslak üretimine bakılmalı mı? (günde bir kez, 07:00 TSİ'den sonra) */
export function blogGenDue(now: number, genDay: string | undefined): boolean {
  return trHour(now) >= BLOG_START_HOUR && genDay !== trDayKey(now);
}

/**
 * Yeni otomatik taslağın yayın zamanı. `lastScheduledAt`: kuyruktaki en geç planlı yazı (yoksa 0).
 * `urgent` (özel gün yaklaşıyor): hemen sıraya girer, kuyruğun önüne geçer. Aksi halde son yazıdan
 * BLOG_SPACING_DAYS sonra, TSİ 10:00'a oturtulur.
 */
export function nextAutoSlot(now: number, lastScheduledAt: number, urgent: boolean): number {
  if (urgent) return now;
  const base = lastScheduledAt > 0 ? lastScheduledAt + BLOG_SPACING_DAYS * DAY_MS : now + DAY_MS;
  let t = trTime(trDayKey(Math.max(base, now + 6 * 3600 * 1000)), BLOG_PUBLISH_HOUR);
  if (t < now + 3600 * 1000) t += DAY_MS;
  return t;
}
