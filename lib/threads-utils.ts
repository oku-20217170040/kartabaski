// Threads metinleri ve kota kuralları için saf yardımcılar (testli). Bir Threads gönderisi/yanıtı en fazla 500 karakterdir.
import { trDayKey } from './tr-time';
import { inWindow, windowLabel, type SocialSettings } from './social-settings-utils';

export const THREADS_TEXT_MAX = 500;
export const DETAIL_CHUNK_MAX = 480; // güvenli pay
export const DETAIL_CHUNKS_LIMIT = 3; // bir ürün için en fazla yanıt sayısı
export const THREADS_MIN_GAP_MS = 30 * 60 * 1000;

/** Metni 500 karakterin altında tutar (sonda "…"). */
export function fitThreads(text: string): string {
  return text.length > THREADS_TEXT_MAX ? `${text.slice(0, THREADS_TEXT_MAX - 1).trimEnd()}…` : text;
}

function clean(s: unknown): string {
  return String(s ?? '').replace(/\r/g, '').trim();
}

/** Satır sınırlarında bölerek her parçayı max karakterin altında tutar; çok uzun tek satır kesilir. */
function splitLines(lines: string[], max: number): string[] {
  const chunks: string[] = [];
  let cur = '';
  for (const raw of lines) {
    const line = raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > max) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Ürün açıklaması + ek satırlar (teslimat, kişiselleştirme notu…), 480 karakteri aşmayan parçalar halinde
 * (gönderinin altına zincirleme yanıtlar). Çok uzunsa son parça "…" ile biter; en fazla DETAIL_CHUNKS_LIMIT parça döner.
 */
export function threadsDetailChunks(description: string, extras: string[] = []): string[] {
  const lines: string[] = [];
  const desc = clean(description);
  if (desc) lines.push(...desc.split('\n').map((l) => l.trim()).filter(Boolean));
  const more = extras.map(clean).filter(Boolean);
  if (more.length) {
    if (lines.length) lines.push('');
    lines.push(...more);
  }
  const chunks = splitLines(lines, DETAIL_CHUNK_MAX).map((c) => c.trim()).filter(Boolean);
  if (chunks.length <= DETAIL_CHUNKS_LIMIT) return chunks;
  const kept = chunks.slice(0, DETAIL_CHUNKS_LIMIT);
  const last = kept[DETAIL_CHUNKS_LIMIT - 1];
  kept[DETAIL_CHUNKS_LIMIT - 1] = `${last.slice(0, Math.max(0, DETAIL_CHUNK_MAX - 1))}…`;
  return kept;
}

/** Bugünkü Threads gönderi sayısı; gün değiştiyse 0. */
export function threadsTodayCount(day: string, todayCount: number, now: number): number {
  return day === trDayKey(now) ? todayCount : 0;
}

/** Saat penceresi ve günlük kota uygun mu? (panel ayarlarına göre) */
export function threadsGate(
  st: { day: string; todayCount: number; lastPostAt?: number },
  s: Pick<SocialSettings, 'dailyLimit' | 'windowStart' | 'windowEnd'>,
  now: number
): { ok: boolean; reason?: string } {
  if (!inWindow(s, now)) return { ok: false, reason: `paylaşım saatleri dışında (${windowLabel(s)})` };
  if (threadsTodayCount(st.day, st.todayCount, now) >= s.dailyLimit) return { ok: false, reason: 'günlük kota doldu' };
  if (st.lastPostAt && now - st.lastPostAt < THREADS_MIN_GAP_MS) return { ok: false, reason: 'paylaşımlar arasında bekleniyor' };
  return { ok: true };
}
