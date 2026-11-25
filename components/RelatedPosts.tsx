import { getPostsForProduct } from '@/lib/posts';
import PostCard from '@/components/blog/PostCard';
import '@/app/blog/blog.css';

/**
 * Ürün sayfasında "İlgili yazılar": ürünün geçtiği ya da kategorisiyle eşleşen yayındaki blog yazıları.
 * Eşleşme yoksa (ya da okunamazsa) hiçbir şey çizmez.
 */
export default async function RelatedPosts({ productId, category }: { productId: string; category?: string }) {
  const posts = await getPostsForProduct(productId, category, 3).catch(() => []);
  if (posts.length === 0) return null;

  return (
    <section className="blog-related" aria-labelledby="ilgili-yazilar">
      <div className="wrap">
        <h2 id="ilgili-yazilar" className="h2">İlgili yazılar</h2>
        <div className="blog-grid">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} headingLevel={3} />
          ))}
        </div>
      </div>
    </section>
  );
}
