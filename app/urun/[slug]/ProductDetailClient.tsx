'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProductGallery from '@/components/ProductGallery';
import type { Product } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { CartIcon } from '@/components/cart/CartLink';
import { CheckIcon, LinkIcon, ShareIcon, TruckIcon, WhatsAppIcon } from '@/components/icons';
import { cloudinaryUrl, displayTitle, formatPriceRange, whatsappLink, colorSwatch } from '@/lib/format';
import { SITE_URL } from '@/lib/site';
import {
  getTitle, getPriceMin, getPriceMax, getCategory, getSlug, getDescription, getShortDesc,
} from '@/lib/product-utils';

interface Props {
  slug: string;
  product: Product | null;
  similar: Product[];
}

const THUMB_TRANSFORM = 'f_auto,q_auto,w_160,h_160,c_fill';

const toSrc = (id: string, opts: string) => (id.startsWith('http') ? id : cloudinaryUrl(id, opts));

// ── Açıklama metni → temiz içerik ────────────────────────────────────────────

const BULLET = /^\s*[✓✔•*–-]\s*/;
const LEADING_NOISE = /^[^A-Za-z0-9ÇĞİÖŞÜçğıöşü"'(]+/;

type Block = { type: 'h3' | 'p'; text: string } | { type: 'ul'; items: string[] };

function parseDescription(raw: string): Block[] {
  const blocks: Block[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isBullet = BULLET.test(trimmed);
    const text = trimmed.replace(BULLET, '').replace(LEADING_NOISE, '').trim();
    if (!text) continue;
    if (isBullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(text);
      else blocks.push({ type: 'ul', items: [text] });
    } else if (text.endsWith(':')) {
      blocks.push({ type: 'h3', text: text.slice(0, -1) });
    } else {
      blocks.push({ type: 'p', text });
    }
  }
  return blocks;
}

// ── Bileşen ──────────────────────────────────────────────────────────────────

export default function ProductDetailClient({ slug, product, similar }: Props) {
  const colors = useMemo(() => product?.colors ?? [], [product]);
  const [colorIdx, setColorIdx] = useState<number | null>(colors.length > 0 ? 0 : null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const imageIds: string[] = useMemo(() => {
    if (!product) return [];
    const own = colorIdx !== null ? colors[colorIdx]?.images : undefined;
    return own && own.length ? own : product.images ?? [];
  }, [product, colors, colorIdx]);

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    document.body.classList.add('has-sticky-buy');
    return () => document.body.classList.remove('has-sticky-buy');
  }, []);

  if (!product) return null;

  const rawTitle = getTitle(product);
  const title = displayTitle(rawTitle);
  const category = getCategory(product);
  const priceMin = getPriceMin(product);
  const priceMax = getPriceMax(product);
  const ranged = priceMax > priceMin && priceMin > 0;
  const shortDesc = getShortDesc(product);
  const blocks = parseDescription(getDescription(product));
  const deliveryDays = product.deliveryDays ?? 3;
  const productSlug = getSlug(product) || slug;
  const colorName = colorIdx !== null ? colors[colorIdx]?.name : undefined;
  const waHref = whatsappLink(rawTitle, productSlug, colorName);
  const designHref = `/tasarla/${productSlug}${colorName ? `?renk=${encodeURIComponent(colorName)}` : ''}`;
  const categoryHref = `/?kategori=${encodeURIComponent(category)}#urunler`;
  const productUrl = `${SITE_URL}/urun/${productSlug}`;

  const priceNode = (
    <>
      {formatPriceRange(priceMin, ranged ? 0 : priceMax)}
      {ranged && <small>&apos;den başlayan</small>}
    </>
  );

  const selectColor = (i: number) => setColorIdx(i);

  const share = async () => {
    try {
      await navigator.share({ title, url: productUrl });
    } catch {
      /* kullanıcı vazgeçti */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi yok */
    }
  };

  return (
    <>
      <Navbar />
      <main id="icerik" className="pdp">
        <div className="wrap">
          <nav aria-label="Konum">
            <ol className="breadcrumb">
              <li><Link href="/">Ana sayfa</Link></li>
              {category && <li><Link href={categoryHref}>{category}</Link></li>}
              <li aria-current="page">{title}</li>
            </ol>
          </nav>

          <div className="pdp-grid">
            {/* Renk değişince galeri başa döner. */}
            <ProductGallery key={colorIdx ?? 'tek'} ids={imageIds} title={title} />

            <div className="pdp-info">
              {category && <p className="eyebrow">{category}</p>}
              <h1 className="pdp-title">{title}</h1>
              <p className="pdp-price">{priceNode}</p>
              {shortDesc && <p className="pdp-short">{shortDesc}</p>}

              {colors.length > 0 && (
                <div className="pdp-block">
                  <p className="pdp-label">
                    Renk: <b>{colorName}</b>
                  </p>
                  <div className="color-options">
                    {colors.map((c, i) => {
                      const first = c.images?.[0];
                      const swatch = colorSwatch(c.name);
                      return (
                        <button
                          key={`${c.name}-${i}`}
                          type="button"
                          className="color-option"
                          aria-pressed={colorIdx === i}
                          aria-label={c.name}
                          title={c.name}
                          onClick={() => selectColor(i)}
                        >
                          {first ? (
                            <Image src={toSrc(first, THUMB_TRANSFORM)} alt="" width={96} height={96} />
                          ) : swatch ? (
                            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 4, background: swatch }} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pdp-actions">
                <Link href={designHref} className="btn btn-primary btn-block">
                  <CartIcon size={18} /> Tasarla ve sepete ekle
                </Link>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="pdp-ask">
                  <WhatsAppIcon size={18} /> Sorunuz mu var? WhatsApp’tan yazın
                </a>
              </div>

              <div className="pdp-meta">
                <div>
                  <TruckIcon />
                  <span>Tasarım onayından sonra <b>{deliveryDays} iş günü</b> içinde kargoda</span>
                </div>
                <div>
                  <CheckIcon />
                  <span>Baskıdan önce <b>ücretsiz dijital önizleme</b></span>
                </div>
                <div>
                  <CheckIcon />
                  <span>Tasarımınız yoksa <b>ücretsiz hazırlıyoruz</b></span>
                </div>
              </div>

              <div className="pdp-share">
                {canShare && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={share}>
                    <ShareIcon size={16} /> Paylaş
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={copyLink}>
                  <LinkIcon size={16} /> Bağlantıyı kopyala
                </button>
                <span className="muted" role="status" aria-live="polite" style={{ alignSelf: 'center', fontSize: 14 }}>
                  {copied ? 'Kopyalandı' : ''}
                </span>
              </div>
            </div>
          </div>

          {blocks.length > 0 && (
            <section className="pdp-desc" aria-labelledby="urun-detay">
              <h2 id="urun-detay" className="h3">Ürün detayları</h2>
              <div className="prose">
                {blocks.map((b, i) =>
                  b.type === 'ul' ? (
                    <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
                  ) : b.type === 'h3' ? (
                    <h3 key={i}>{b.text}</h3>
                  ) : (
                    <p key={i}>{b.text}</p>
                  ),
                )}
              </div>
            </section>
          )}
        </div>

        {similar.length > 0 && (
          <section className="section" aria-labelledby="benzer-baslik">
            <div className="wrap">
              <div className="section-head">
                <h2 id="benzer-baslik" className="h2">Benzer ürünler</h2>
                {category && <Link href={categoryHref} className="text-link">Tümünü görün</Link>}
              </div>
              <div className="product-grid">
                {similar.slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="sticky-buy">
        <span className="price">{priceNode}</span>
        <Link href={designHref} className="btn btn-primary">
          <CartIcon size={18} /> Tasarla ve sepete ekle
        </Link>
      </div>

      <Footer />
    </>
  );
}
