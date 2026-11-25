// Türkiye saati (sabit UTC+3) yardımcıları — saf, testli. Cron/otomasyon modülleri ortak kullanır.
export const TR_OFFSET_MS = 3 * 3600 * 1000;
export const DAY_MS = 86400000;

/** TSİ gün anahtarı: "YYYY-MM-DD" */
export function trDayKey(ts: number): string {
  return new Date(ts + TR_OFFSET_MS).toISOString().slice(0, 10);
}

/** TSİ saat (0-23) */
export function trHour(ts: number): number {
  return new Date(ts + TR_OFFSET_MS).getUTCHours();
}

/** TSİ haftanın günü (0 = pazar, 1 = pazartesi …) */
export function trWeekday(ts: number): number {
  return new Date(ts + TR_OFFSET_MS).getUTCDay();
}

/** "YYYY-MM-DD" + TSİ saat/dakika → epoch ms */
export function trTime(day: string, hour: number, minute = 0): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d, hour, minute) - TR_OFFSET_MS;
}

/** TSİ ay anahtarı: "YYYY-MM" */
export function trMonthKey(ts: number): string {
  return trDayKey(ts).slice(0, 7);
}
