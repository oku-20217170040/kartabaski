import Link from 'next/link';
import Image from 'next/image';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import { cloudinaryUrl, formatPriceRange } from '@/lib/format';

/** Lifestyle shot used as the hero plate. Cloudinary public_id. */
export const HERO_IMAGE_ID = 'karta-baski/urunler/in1toupoovs9oroeeiqq';

export interface HeroProduct {
  title: string;
  slug: string;
  imageId: string;
  priceMin: number;
  priceMax: number;
  colorCount: number;
}

interface Props {
  featured?: HeroProduct | null;
  lowestPrice?: number | null;
}

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

export default function HeroSection({ featured, lowestPrice }: Props) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div>
          <p className="eyebrow">Kişiye özel kupa ve fincan baskısı</p>
          <h1 id="hero-title" className="display">
            Fotoğrafınız, logonuz ya da tek bir cümle — <em>kupanın üstünde.</em>
          </h1>
          <p className="lead">
            Tek adet hediyelik de basıyoruz, şirketiniz için yüzlerce adet de. Tasarımınızı gönderin;
            baskıdan önce önizlemeyi size onaylatırız.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href={WA_HREF} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> WhatsApp&apos;tan sipariş verin
            </a>
            <Link className="btn btn-outline" href="#urunler">Ürünleri inceleyin</Link>
          </div>
          <dl className="facts">
            <div><dt>Baskı öncesi</dt><dd>Ücretsiz önizleme</dd></div>
            <div><dt>Kargoya teslim</dt><dd>3 iş günü</dd></div>
            <div>
              <dt>Fiyatlar</dt>
              <dd>{lowestPrice ? `${lowestPrice.toLocaleString('tr-TR')}₺'den` : 'Tek adetten'}</dd>
            </div>
          </dl>
        </div>

        <figure className="plate">
          <div className="plate-img">
            <Image
              src={cloudinaryUrl(HERO_IMAGE_ID, 'f_auto,q_auto,w_1100,h_1375,c_fill')}
              alt="Ahşap masada, kahve çekirdeklerinin yanında baskılı beyaz kupa"
              fill
              priority
              sizes="(max-width: 960px) 100vw, 50vw"
            />
            {featured && (
              <Link className="plate-tag" href={`/urun/${featured.slug}`}>
                <Image
                  src={cloudinaryUrl(featured.imageId, 'f_auto,q_auto,w_120,h_120,c_fill')}
                  alt=""
                  width={44}
                  height={44}
                />
                <span>
                  <b>{featured.title}</b>
                  <span>
                    {featured.colorCount > 1 ? `${featured.colorCount} renk · ` : ''}
                    {formatPriceRange(featured.priceMin, featured.priceMax)}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </figure>
      </div>
    </section>
  );
}
