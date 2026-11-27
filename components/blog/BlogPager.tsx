import Link from 'next/link';
import { blogPageNumbers, blogPagePath } from '@/lib/blog-pages';
import { cn } from '@/lib/utils';

/** Blog listesi sayfa gezinmesi; tek sayfa varsa hiçbir şey çizmez. */
export default function BlogPager({ page, total }: { page: number; total: number }) {
  if (total <= 1) return null;

  return (
    <nav aria-label="Blog sayfaları">
      <ul className="blog-pager">
        {page > 1 && (
          <li><Link href={blogPagePath(page - 1)} rel="prev" className="btn btn-outline btn-sm">Önceki</Link></li>
        )}
        {blogPageNumbers(page, total).map((n, i) =>
          n === null ? (
            <li key={`bosluk-${i}`} className="blog-pager-gap" aria-hidden="true">…</li>
          ) : (
            <li key={n}>
              <Link
                href={blogPagePath(n)}
                className={cn('btn', 'btn-sm', n === page ? 'btn-primary' : 'btn-outline')}
                aria-label={`Sayfa ${n}`}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        {page < total && (
          <li><Link href={blogPagePath(page + 1)} rel="next" className="btn btn-outline btn-sm">Sonraki</Link></li>
        )}
      </ul>
    </nav>
  );
}
