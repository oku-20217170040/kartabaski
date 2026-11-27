// IndexNow'a hangi adreslerin bildirileceği (saf, testli).
interface Entry { url: string; lastModified?: string | Date }

/** Sürümü izlenen sayfalar: ürünler ve blog yazıları. Liste sayfalarının tarihi her istekte değişir, izlenmez. */
const isContent = (url: string, site: string) =>
  url.startsWith(`${site}/urun/`) || (url.startsWith(`${site}/blog/`) && !url.startsWith(`${site}/blog/sayfa/`));

const stamp = (e: Entry) => `${e.url}|${e.lastModified ? new Date(e.lastModified).getTime() : 0}`;

/**
 * Daha önce bildirilmemiş ya da o günden beri değişmiş sayfalar. Zamana değil bildirilen sürüme bakılır:
 * önbellek yüzünden site haritasına geç düşen yazı da kaçmaz. Değişiklik varsa liste sayfaları da eklenir;
 * ilk bildirimde (kayıt boşken) sitedeki bütün adresler gider. `sent`: başarılı olursa saklanacak yeni kayıt.
 */
export function pendingUrls(entries: Entry[], previous: string[], site: string): { urls: string[]; sent: string[] } {
  const content = entries.filter((e) => isContent(e.url, site));
  const sent = content.map(stamp);
  if (!previous.length) return { urls: entries.map((e) => e.url).slice(0, 10_000), sent };
  const known = new Set(previous);
  const changed = content.filter((e) => !known.has(stamp(e))).map((e) => e.url);
  if (!changed.length) return { urls: [], sent };
  const lists = [site, `${site}/blog`, `${site}/kategoriler`].filter((u) => entries.some((e) => e.url === u));
  return { urls: [...lists, ...changed].slice(0, 10_000), sent };
}
