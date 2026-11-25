import 'server-only';
import { getProductsServer } from './products-server';
import { toSocialRow, type SocialProductRow } from './social-content-utils';

// Sosyal medya modülleri ortak ürün okuyucusu. Firestore Spark kotası için sonuç sunucu belleğinde
// 5 dakika önbelleğe alınır (cron turları ve panel yenilemeleri her seferinde tüm ürünleri okumaz).
const TTL_MS = 5 * 60_000;
let cache: { at: number; rows: SocialProductRow[] } | null = null;

export async function getSocialRows(fresh = false): Promise<SocialProductRow[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = (await getProductsServer()).map(toSocialRow);
  // Okuma hatasında getProductsServer boş döner: önceki dolu önbelleği boşla ezme
  if (rows.length === 0 && cache) return cache.rows;
  cache = { at: Date.now(), rows };
  return rows;
}

export function invalidateSocialRows(): void {
  cache = null;
}
