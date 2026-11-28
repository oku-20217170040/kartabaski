import { DAY_MS, trDayKey, trTime } from '../tr-time';

export function slotTimes(times: string[], now: number, days: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < days; d++) {
    const day = trDayKey(now + d * DAY_MS);
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const at = trTime(day, h, m);
      if (at > now) out.push(at);
    }
  }
  return out.sort((a, b) => a - b);
}

export const isDue = (at: number, now: number) => at <= now && trDayKey(at) === trDayKey(now);
export const isMissed = (at: number, now: number) => at <= now && trDayKey(at) !== trDayKey(now);
