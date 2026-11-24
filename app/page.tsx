import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { getProductsServer } from '@/lib/products-server';
import { cloudinaryUrl, displayTitle } from '@/lib/format';
import { getActive, getFeatured, getPriceMin, getPriceMax, getSlug, getTitle } from '@/lib/product-utils';
import { jsonLdString } from '@/lib/site';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection, { HeroProduct } from '@/components/HeroSection';
import ProductsClient from './ProductsClient';
import { WhatsAppIcon, PhoneIcon, MailIcon, InstagramIcon, ArrowRightIcon, ChevronDownIcon } from '@/components/icons';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import { INSTAGRAM_URL } from '@/lib/site';

const getProducts = unstable_cache(() => getProductsServer(), ['products'], {
  tags: ['products'],
  revalidate: 3600,
});

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;
const CORPORATE_IMAGE = 'karta-baski/urunler/zmh4gnc6fpg1f85d9jbo';
const CONFIGURATOR_IMAGE = 'karta-baski/urunler/vnhktkf0rx0x52x3skdt';

const STEPS = [
  { title: 'Ürünü ve rengi seçin', text: 'Kupa, fincan ya da sihirli kupa. Kulp ve iç rengini siz belirleyin.' },
  { title: 'Tasarımınızı gönderin', text: 'Fotoğraf, logo ya da yazı. Hazır bir tasarımınız yoksa ücretsiz hazırlıyoruz.' },
  { title: 'Onaylayın, kargoya verelim', text: 'Önizlemeyi onayladığınızda baskıya alınır, 3 iş günü içinde kargoya verilir.' },
];

const FAQ = [
  {
    q: 'Tek adet sipariş verebilir miyim?',
    a: 'Evet. Minimum sipariş adedi yok; tek bir hediyelik kupa da basıyoruz.',
  },
  {
    q: 'Tasarımım hazır değil, ne yapmalıyım?',
    a: 'Fotoğrafınızı, logonuzu ya da yazdırmak istediğiniz metni WhatsApp üzerinden gönderin. Tasarımı ücretsiz olarak biz hazırlıyoruz.',
  },
  {
    q: 'Baskıdan önce nasıl görüneceğini görebilir miyim?',
    a: 'Evet. Baskıya geçmeden önce tasarımın dijital önizlemesini size gönderiyoruz; onayınız olmadan baskı yapılmaz.',
  },
  {
    q: 'Siparişim ne zaman kargoya verilir?',
    a: 'Tasarım onayından sonra 3 iş günü içinde kargoya teslim ediyoruz. Türkiye’nin her yerine gönderim yapıyoruz.',
  },
  {
    q: 'Toplu siparişte indirim var mı?',
    a: '45 adet ve üzeri siparişlerde adet başı fiyat düşüyor. Adet ve ürün bilgisini yazın, size özel teklif hazırlayalım.',
  },
];

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
          <div className="skeleton" style={{ aspectRatio: '4 / 5' }} />
          <div className="skeleton" style={{ height: 16, width: '70%', marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const products = await getProducts();
  const active = products.filter(getActive);

  const featuredProduct =
    active.find((p) => getFeatured(p) && p.images?.[0]) ?? active.find((p) => p.images?.[0]);
  const featured: HeroProduct | null = featuredProduct
    ? {
        title: displayTitle(getTitle(featuredProduct)),
        slug: getSlug(featuredProduct),
        imageId: featuredProduct.images[0],
        priceMin: getPriceMin(featuredProduct),
        priceMax: getPriceMax(featuredProduct),
        colorCount: featuredProduct.colors?.length ?? 0,
      }
    : null;

  const prices = active.map(getPriceMin).filter((n) => n > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : null;

  return (
    <>
      <Navbar />
      <main id="icerik">
        <HeroSection featured={featured} lowestPrice={lowestPrice} />

        <section className="steps" aria-label="Sipariş adımları">
          <div className="wrap">
            {STEPS.map((s, i) => (
              <div className="step" key={s.title}>
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="urunler" aria-labelledby="urunler-baslik" style={{ scrollMarginTop: 'var(--header-h)' }}>
          <div className="wrap">
            <div className="section-head">
              <h2 id="urunler-baslik" className="h2">Ürünler</h2>
              <Link href="/kategoriler" className="text-link">Kategorilere göre gezin</Link>
            </div>
            <Suspense fallback={<GridFallback />}>
              <ProductsClient initialProducts={products} />
            </Suspense>
          </div>
        </section>

        <section className="section-tight" aria-labelledby="konfigurator-baslik">
          <div className="wrap">
            <div className="feature">
              <div className="feature-media">
                <Image
                  src={cloudinaryUrl(CONFIGURATOR_IMAGE, 'f_auto,q_auto,w_1000,h_800,c_fill')}
                  alt="Çalışma masasında baskılı kupa"
                  width={1000}
                  height={800}
                  sizes="(max-width: 960px) 100vw, 50vw"
                />
              </div>
              <div className="feature-body">
                <p className="eyebrow">Kendin tasarla</p>
                <h2 id="konfigurator-baslik" className="h2" style={{ marginTop: 14 }}>Bardağı ve tasarımı siz eşleştirin.</h2>
                <p>Kupa modelini ve hazır tasarımlardan birini seçin, kombinasyonu görün. Beğendiğiniz eşleşmeyi tek tıkla WhatsApp üzerinden bize iletin.</p>
                <div>
                  <Link href="/konfigurator" className="btn btn-outline">
                    Kombinasyon oluşturun <ArrowRightIcon size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band" aria-labelledby="kurumsal-baslik">
              <div className="wrap">
                <div>
                  <p className="eyebrow">Kurumsal</p>
                  <h2 id="kurumsal-baslik" className="h2">Ekibiniz, müşterileriniz ve etkinlikleriniz için logolu kupa.</h2>
                  <p>Adede göre fiyat ve toplu kargo. Logonuzu gönderin, size özel teklif hazırlayalım.</p>
                  <ul className="dash-list">
                    <li>45 adet ve üzerinde adet başı indirimli fiyat</li>
                    <li>Baskı öncesi dijital önizleme ve onay</li>
                    <li>Türkiye geneline toplu gönderim</li>
                  </ul>
                  <Link href="/kurumsal" className="btn btn-light">Kurumsal teklif isteyin</Link>
                </div>
                <div className="band-media">
                  <Image
                    src={cloudinaryUrl(CORPORATE_IMAGE, 'f_auto,q_auto,w_1000,h_800,c_fill')}
                    alt="Ofis masasında logolu kupa"
                    width={1000}
                    height={800}
                    sizes="(max-width: 960px) 100vw, 50vw"
                  />
                </div>
              </div>
        </section>

        <section className="section" id="iletisim" aria-labelledby="sss-baslik" style={{ scrollMarginTop: 'var(--header-h)' }}>
          <div className="wrap contact-grid">
            <div>
              <h2 id="sss-baslik" className="h2" style={{ marginBottom: 24 }}>Sık sorulanlar</h2>
              <div className="faq">
                {FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}<ChevronDownIcon size={18} /></summary>
                    <div>{f.a}</div>
                  </details>
                ))}
              </div>
            </div>
            <div>
              <h2 className="h2" style={{ marginBottom: 24 }}>Bize ulaşın</h2>
              <div className="contact-list">
                <a className="contact-row" href={WA_HREF} target="_blank" rel="noopener noreferrer">
                  <span><span className="k">WhatsApp · sipariş ve teklif</span><span className="v">Mesaj gönderin</span></span>
                  <WhatsAppIcon className="arrow" size={20} />
                </a>
                <a className="contact-row" href={`tel:+${PHONE}`}>
                  <span><span className="k">Telefon</span><span className="v">{PHONE_DISPLAY}</span></span>
                  <PhoneIcon className="arrow" />
                </a>
                <a className="contact-row" href="mailto:info@kartabaski.com">
                  <span><span className="k">E-posta</span><span className="v">info@kartabaski.com</span></span>
                  <MailIcon className="arrow" />
                </a>
                <a className="contact-row" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                  <span><span className="k">Instagram</span><span className="v">@kartabaskii</span></span>
                  <InstagramIcon className="arrow" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqSchema) }} />
    </>
  );
}
