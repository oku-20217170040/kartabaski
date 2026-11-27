// IndexNow'a hangi adreslerin bildirileceği (saf, testli).
interface Entry { url: string; lastModified?: string | Date }

/**
 * Ürün ve blog yazısı sayfalarından `since` sonrasında değişenler. Değişiklik varsa liste sayfaları da eklenir.
 * İlk bildirimde (since = 0) sitedeki bütün adresler gider.
 */
export function changedUrls(entries: Entry[], since: number, site: string): string[] {
  if (!since) return entries.map((e) => e.url).slice(0, 10_000);
  const changed = entries
    .filter((e) => e.url.startsWith(`${site}/urun/`) || e.url.startsWith(`${site}/blog/`))
    .filter((e) => e.lastModified !== undefined && new Date(e.lastModified).getTime() > since)
    .map((e) => e.url);
  if (!changed.length) return [];
  const lists = [site, `${site}/blog`, `${site}/kategoriler`].filter((u) => entries.some((e) => e.url === u));
  return [...lists, ...changed].slice(0, 10_000);
}
