// Blog yazılarının arama başlığı/açıklaması için koddan geçersiz kılma (Firestore'a yazmadan).
// Search Console'da gösterimi yüksek ama tıklaması düşük yazıların başlığını, aranan soruyla birebir eşler.
// answer: yazının en üstünde gösterilen kısa tanım (öne çıkan snippet için 40–60 kelimelik net cevap).

export interface PostSeo {
  /** <title> (marka eki dahil, şablon eklenmez) ve H1 */
  title?: string;
  description?: string;
  answer?: string;
}

/** slug → geçersiz kılma. Search Console verisi geldikçe doldurulur. */
export const POST_SEO: Record<string, PostSeo> = {};

export const postSeo = (slug: string): PostSeo => POST_SEO[slug] ?? {};

/** Meta açıklaması: geçersiz kılma > özet > içerikten ilk ~155 karakter. */
export function postDescription(post: { slug: string; excerpt: string; content: string }): string {
  const seo = postSeo(post.slug);
  if (seo.description) return seo.description;
  if (post.excerpt.trim()) return post.excerpt.trim().slice(0, 200);
  return post.content.replace(/[#*>[\]()`!_-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 155);
}
