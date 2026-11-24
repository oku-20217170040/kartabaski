import Link from 'next/link';
import Image from 'next/image';
import { cloudinaryUrl, formatPriceRange } from '@/lib/format';

export interface MarqueeItem {
  slug: string;
  title: string;
  imageId: string;
  priceMin: number;
  priceMax: number;
}

/** Endless, slowly drifting strip of real product photos. Pure CSS animation; pauses on hover. */
export default function ProductMarquee({ items }: { items: MarqueeItem[] }) {
  if (items.length < 3) return null;
  const loop = [...items, ...items];

  return (
    <section className="marquee" aria-label="Öne çıkan ürünler">
      <div className="marquee-track" style={{ ['--marquee-duration' as string]: `${items.length * 6}s` }}>
        {loop.map((p, i) => (
          <Link
            key={`${p.slug}-${i}`}
            href={`/urun/${p.slug}`}
            className="marquee-card"
            aria-hidden={i >= items.length ? true : undefined}
            tabIndex={i >= items.length ? -1 : undefined}
          >
            <span className="marquee-media">
              <Image
                src={cloudinaryUrl(p.imageId, 'f_auto,q_auto,w_480,h_600,c_fill')}
                alt={i >= items.length ? '' : p.title}
                fill
                sizes="240px"
              />
            </span>
            <span className="marquee-meta">
              <span>{p.title}</span>
              <span>{formatPriceRange(p.priceMin, p.priceMax)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
