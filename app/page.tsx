import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getProductsServer } from '@/lib/products-server';
import { displayTitle, formatPriceRange } from '@/lib/format';
import { getActive, getPriceMin, getPriceMax, getSlug, getTitle } from '@/lib/product-utils';
import { jsonLdString } from '@/lib/site';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import PrintWall from '@/components/PrintWall';
import { VITRIN_PRODUCT_SLUG } from '@/lib/vitrin';
import ProductsClient from './ProductsClient';
import { WhatsAppIcon, MailIcon, InstagramIcon, ChevronDownIcon } from '@/components/icons';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import { INSTAGRAM_URL, SITE_URL } from '@/lib/site';
import { HOME_FAQ as FAQ } from '@/lib/faq';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL, types: { 'application/rss+xml': `${SITE_URL}/feed.xml` } },
};

const getProducts = unstable_cache(() => getProductsServer(), ['products'], {
  tags: ['products'],
  revalidate: 3600,
});

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

function GridFallback() {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>
          <div className="skeleton" style={{ aspectRatio: '1' }} />
          <div className="skeleton" style={{ height: 16, width: '70%', marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const products = await getProducts();
  const active = products.filter(getActive);

  const prices = active.map((p) => getPriceMin(p) || getPriceMax(p)).filter((n) => n > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : null;

  const mug = active.find((p) => getSlug(p) === VITRIN_PRODUCT_SLUG);
  const mugProduct = mug
    ? {
        slug: getSlug(mug),
        title: displayTitle(getTitle(mug)),
        price: formatPriceRange(getPriceMin(mug), getPriceMax(mug)),
        // Firestore tarih nesneleri istemciye düz veri olarak geçsin.
        product: JSON.parse(JSON.stringify(mug)),
      }
    : null;

  return (
    <>
      <Navbar />
      <main id="icerik">
        <HeroSection lowestPrice={lowestPrice} mugProduct={mugProduct} />
        <PrintWall />

        <section className="catalog-section" id="urunler" aria-labelledby="urunler-baslik" style={{ scrollMarginTop: 'var(--header-h)' }}>
          <div className="wrap">
            <Suspense fallback={<GridFallback />}>
              <ProductsClient initialProducts={products} />
            </Suspense>
          </div>
        </section>

        <div className="ikili">
          <section className="ikili-blok" aria-labelledby="kurumsal-baslik">
            <h2 id="kurumsal-baslik" className="h2">Şirket logonuzla,<br />toplu sipariş.</h2>
            <p>45 adet ve üzerinde adet fiyatı düşer. Logonuzu gönderin; önce kupanın üstünde gösterelim, onaylarsanız basıp Türkiye’nin her yerine gönderelim.</p>
            <Link href="/kurumsal" className="btn btn-light">Teklif isteyin</Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vitrin/b-simge.webp" alt="Küçük logo baskılı yeşil kulplu kupa" loading="lazy" />
          </section>
          <section className="ikili-blok is-red" aria-labelledby="konfigurator-baslik">
            <h2 id="konfigurator-baslik" className="h2">Tasarımınız yoksa hazırlardan seçin.</h2>
            <p>Kupa modelini ve hazır bir deseni yan yana koyun, beğendiğiniz eşleşmeyi bize gönderin.</p>
            <Link href="/konfigurator" className="btn btn-light">Eşleştirmeyi deneyin</Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vitrin/b-sehir.webp" alt="Renkli şehir silueti baskılı kupa" loading="lazy" />
          </section>
        </div>

        <section className="sorular" aria-labelledby="sss-baslik">
          <div className="wrap">
            <h2 id="sss-baslik" className="h2">Sipariş vermeden önce sorulanlar</h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}<ChevronDownIcon size={20} /></summary>
                  <div>{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="tabela" id="iletisim" aria-label="İletişim" style={{ scrollMarginTop: 'var(--header-h)' }}>
          <div className="wrap">
            <p className="tabela-ust">Aklınızdakini anlatmak için arayın</p>
            <a className="tabela-no" href={`tel:+${PHONE}`}>{PHONE_DISPLAY}</a>
            <div className="tabela-yollar">
              <a href={WA_HREF} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={20} /> WhatsApp’tan yazın</a>
              <a href="mailto:info@kartabaski.com"><MailIcon size={20} /> info@kartabaski.com</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><InstagramIcon size={20} /> @kartabaskii</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqSchema) }} />
    </>
  );
}
