// Ürün ↔ yazı eşleştirme (saf, testli). Ürün sayfasındaki "İlgili yazılar" kullanır.
import type { Post } from './posts-types';

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
  scored.sort((a, b) => b.score - a.score || (b.p.publishedAt || b.p.updatedAt) - (a.p.publishedAt || a.p.updatedAt));
  return scored.slice(0, limit).map((x) => x.p);
}
