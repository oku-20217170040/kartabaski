// Blog liste sayfalaması (saf, testli): 1. sayfa /blog, sonrakiler /blog/sayfa/<n>.

export const BLOG_PAGE_SIZE = 24;

export const blogPagePath = (page: number): string => (page <= 1 ? '/blog' : `/blog/sayfa/${page}`);

/** Yazı yoksa da 1. sayfa vardır. */
export const blogPageCount = (total: number): number => Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));

/** Adresteki sayfa numarası; yalnız başında sıfır olmayan pozitif tam sayı kabul edilir, aksi halde null. */
export const parseBlogPage = (raw: string): number | null => (/^[1-9]\d{0,4}$/.test(raw) ? Number(raw) : null);

export function blogPageSlice<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);
}

/** Sayfa gezinmesinde gösterilecek numaralar: ilk, son, bulunulan ve komşuları; null = atlanan aralık. */
export function blogPageNumbers(current: number, total: number): (number | null)[] {
  const shown = Array.from({ length: total }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === total || Math.abs(n - current) <= 1,
  );
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of shown) {
    if (n - prev === 2) out.push(n - 1); // tek sayfalık boşluk yerine numarayı göster
    else if (n - prev > 2) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
