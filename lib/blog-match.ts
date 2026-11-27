// Ürün ↔ yazı ve yazı ↔ yazı eşleştirme (saf, testli). Ürün sayfasındaki "İlgili yazılar" ve yazı
// sayfasındaki "Diğer yazılar" kullanır.
import type { Post } from './posts-types';

const dateOf = (p: Post) => p.publishedAt || p.updatedAt;

/**
 * Ürünün geçtiği yazılar (puan 2) ve ürünün kategorisiyle eşleşenler (puan 1); yalnızca yayındakiler.
 * Puan, sonra yayın tarihi (yeni önce) sıralar.
 */
export function matchPostsForProduct(posts: Post[], productId: string, category?: string, limit = 3): Post[] {
  const scored = posts
    .filter((p) => p.published)
    .map((p) => {
      let score = 0;
      if (p.productIds?.includes(productId)) score = 2;
      else if (category && p.categories?.includes(category)) score = 1;
      return { p, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || dateOf(b.p) - dateOf(a.p));
  return scored.slice(0, limit).map((x) => x.p);
}

const normalize = (v: string) => v.trim().toLocaleLowerCase('tr-TR');

/** İki listedeki ortak (tekrarsız) öğe sayısı. */
function sharedCount(a: string[] = [], b: string[] = []): number {
  const other = new Set(b.map(normalize));
  return Array.from(new Set(a.map(normalize))).filter((x) => other.has(x)).length;
}

/**
 * Bir yazıya en yakın yayındaki yazılar: ortak ürün 3, ortak kategori 2, ortak etiket 1 puan.
 * Eşitlikte yeni olan önce; puanı olan yetmezse liste en yeni yazılarla tamamlanır.
 */
export function relatedPosts(posts: Post[], current: Post, limit = 3): Post[] {
  return posts
    .filter((p) => p.published && p.id !== current.id)
    .map((p) => ({
      p,
      score:
        3 * sharedCount(p.productIds, current.productIds) +
        2 * sharedCount(p.categories, current.categories) +
        sharedCount(p.tags, current.tags),
    }))
    .sort((a, b) => b.score - a.score || dateOf(b.p) - dateOf(a.p))
    .slice(0, limit)
    .map((x) => x.p);
}
