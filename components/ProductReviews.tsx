import '@/components/reviews/reviews.css';
import { getApprovedReviewsServer, getReviewAggregate } from '@/lib/reviews';
import ReviewsSection from '@/components/reviews/ReviewsSection';

/**
 * Ürün sayfası yorum bölümü (async server component).
 * productId verilirse yalnızca o ürünün onaylı yorumları; yorum yoksa hiçbir şey render etmez.
 */
export default async function ProductReviews({ productId }: { productId?: string }) {
  const [reviews, agg] = await Promise.all([
    getApprovedReviewsServer(productId, 12),
    getReviewAggregate(productId),
  ]);
  if (!reviews.length) return null;
  return <ReviewsSection reviews={reviews} average={agg.average} count={agg.count} />;
}
