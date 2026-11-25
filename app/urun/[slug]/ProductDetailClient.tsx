'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import AddToCart from '@/components/cart/AddToCart';
import {
  ChevronLeftIcon, ChevronRightIcon, CheckIcon, CloseIcon, LinkIcon,
  ShareIcon, TruckIcon, WhatsAppIcon, ZoomIcon,
} from '@/components/icons';
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

const MAIN_TRANSFORM = 'f_auto,q_auto,w_1200,c_limit';
const THUMB_TRANSFORM = 'f_auto,q_auto,w_160,h_160,c_fill';
const SWIPE_MIN = 40;

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
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const imageIds: string[] = useMemo(() => {
    if (!product) return [];
    const own = colorIdx !== null ? colors[colorIdx]?.images : undefined;
    return own && own.length ? own : product.images ?? [];
  }, [product, colors, colorIdx]);

  const count = imageIds.length;
  const safeActive = count ? Math.min(active, count - 1) : 0;

  const go = useCallback(
    (dir: 1 | -1) => setActive((i) => (count ? (i + dir + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    document.body.classList.add('has-sticky-buy');
    return () => document.body.classList.remove('has-sticky-buy');
  }, []);

  useEffect(() => {
    if (lightbox === null) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') setLightbox((i) => (i === null || !count ? i : (i + 1) % count));
      else if (e.key === 'ArrowLeft') setLightbox((i) => (i === null || !count ? i : (i - 1 + count) % count));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [lightbox, count]);

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
  const categoryHref = `/?kategori=${encodeURIComponent(category)}#urunler`;
  const productUrl = `${SITE_URL}/urun/${productSlug}`;

  const priceNode = (
    <>
      {formatPriceRange(priceMin, ranged ? 0 : priceMax)}
      {ranged && <small>&apos;den başlayan</small>}
    </>
  );

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < SWIPE_MIN) return;
    go(dx < 0 ? 1 : -1);
  };

  const selectColor = (i: number) => {
    setColorIdx(i);
    setActive(0);
  };

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
            <div className="pdp-gallery">
              <div
                className="pdp-main"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {count > 0 ? (
                  <Image
                    key={imageIds[safeActive]}
                    src={toSrc(imageIds[safeActive], MAIN_TRANSFORM)}
                    alt={title}
                    fill
                    sizes="(max-width: 960px) 100vw, 55vw"
                    priority
                  />
                ) : null}
                {count > 1 && (
                  <>
                    <button type="button" className="icon-btn nav-arrow prev" onClick={() => go(-1)} aria-label="Önceki görsel">
                      <ChevronLeftIcon />
                    </button>
                    <button type="button" className="icon-btn nav-arrow next" onClick={() => go(1)} aria-label="Sonraki görsel">
                      <ChevronRightIcon />
                    </button>
                  </>
                )}
                {count > 0 && (
                  <button type="button" className="icon-btn zoom" onClick={() => setLightbox(safeActive)} aria-label="Görseli büyüt">
                    <ZoomIcon />
                  </button>
                )}
              </div>

              {count > 1 && (
                <div className="pdp-thumbs">
                  {imageIds.map((id, i) => (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      className="pdp-thumb"
                      aria-current={i === safeActive}
                      aria-label={`Görsel ${i + 1}`}
                      onClick={() => setActive(i)}
                    >
                      <Image src={toSrc(id, THUMB_TRANSFORM)} alt="" width={160} height={160} />
                    </button>
                  ))}
                </div>
              )}
            </div>

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

              <AddToCart product={product} color={colorName} />

              <div className="pdp-actions">
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
                  <WhatsAppIcon /> WhatsApp&apos;tan sipariş verin
                </a>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block">
                  Tasarımınızı gönderin
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
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <WhatsAppIcon /> WhatsApp&apos;tan sipariş
        </a>
      </div>

      {lightbox !== null && count > 0 && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} görselleri`}
          onClick={() => setLightbox(null)}
        >
          <button ref={closeRef} type="button" className="icon-btn lb-close" onClick={() => setLightbox(null)} aria-label="Kapat">
            <CloseIcon />
          </button>
          {count > 1 && (
            <button
              type="button"
              className="icon-btn lb-prev"
              aria-label="Önceki görsel"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + count) % count); }}
            >
              <ChevronLeftIcon />
            </button>
          )}
          <Image
            src={toSrc(imageIds[Math.min(lightbox, count - 1)], MAIN_TRANSFORM)}
            alt={title}
            width={1200}
            height={1200}
            sizes="92vw"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 && (
            <button
              type="button"
              className="icon-btn lb-next"
              aria-label="Sonraki görsel"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % count); }}
            >
              <ChevronRightIcon />
            </button>
          )}
          {count > 1 && <div className="lb-count" aria-live="polite">{lightbox + 1} / {count}</div>}
        </div>
      )}

      <Footer />
    </>
  );
}
