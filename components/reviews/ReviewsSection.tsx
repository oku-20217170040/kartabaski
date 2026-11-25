import Link from 'next/link';
import { displayName, stars, type Review } from '@/lib/reviews-utils';
import ReviewPhotos from './ReviewPhotos';

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Onaylı müşteri yorumları (sunucuda render edilir; yalnızca fotoğraf galerisi etkileşimlidir). */
export default function ReviewsSection({
  reviews,
  average,
  count,
  title = 'Müşteri yorumları',
  showProduct = false,
}: {
  reviews: Review[];
  average: number;
  count: number;
  title?: string;
  showProduct?: boolean;
}) {
  if (!reviews.length) return null;
  return (
    <section className="rv-section" aria-label={title}>
      <div className="rv-head">
        <h2 className="rv-title">{title}</h2>
        <p className="rv-summary">
          <span className="rv-stars" aria-hidden="true">{stars(Math.round(average))}</span>
          <span>{average.toLocaleString('tr-TR')} / 5 · {count} yorum</span>
          <span className="rv-summary-note">Yalnızca satın alan müşterilerimizin yorumları, onaydan sonra yayınlanır.</span>
        </p>
      </div>
      <div className="rv-grid">
        {reviews.map((r) => {
          const by = displayName(r.name);
          const product = r.productTitle || 'Genel yorum';
          return (
            <article key={r.id} className="rv-card">
              <div className="rv-stars" aria-label={`${r.rating} yıldız`}>{stars(r.rating)}</div>
              <p className="rv-card-text">{r.text}</p>
              {r.images.length > 0 && (
                <ReviewPhotos
                  images={r.images}
                  alt={`${product} müşteri fotoğrafı`}
                  caption={{ rating: r.rating, text: r.text, by, product: r.productTitle || undefined }}
                />
              )}
              {r.adminReply && (
                <p className="rv-reply"><strong>KAR-TA BASKI yanıtı:</strong> {r.adminReply}</p>
              )}
              <div className="rv-card-foot">
                <strong>{by}</strong> · {fmtDate(r.createdAt)}
                {showProduct && r.productTitle && r.productSlug ? (
                  <Link className="rv-card-product" href={`/urun/${r.productSlug}`}>{r.productTitle}</Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
