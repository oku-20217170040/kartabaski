import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getProductsServer } from '@/lib/products-server';
import { getActive, getSlug } from '@/lib/product-utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Kurumsal Kupa Baskı',
  description: 'Firmanız ve etkinlikleriniz için logolu kupa. 45 adet ve üzerinde adet başı indirimli fiyat, baskı öncesi önizleme, Türkiye geneline toplu gönderim.',
  alternates: { canonical: '/kurumsal' },
};

const getProducts = unstable_cache(() => getProductsServer(), ['products'], {
  tags: ['products'],
  revalidate: 3600,
});

const QUOTE_TEXT = 'Merhaba, kurumsal kupa siparişi için teklif almak istiyorum. Firma: … Adet: … Ürün: …';
const QUOTE_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(QUOTE_TEXT)}`;

const BENEFITS = [
  { title: 'Adede göre fiyat', text: '45 adet ve üzeri siparişlerde adet başı fiyat düşer. Adedinizi yazın, size özel teklif hazırlayalım.' },
  { title: 'Baskı öncesi önizleme', text: 'Logonuzun kupadaki yerleşimini dijital önizlemeyle gönderiyoruz. Onayınız olmadan baskı yapılmaz.' },
  { title: 'Toplu gönderim', text: 'Onaydan sonra 3 iş günü içinde kargoya veriyoruz. Türkiye’nin her yerine gönderim yapıyoruz.' },
];

const QUOTE_STEPS = [
  { title: 'Bize yazın', text: 'Firma adınızı, adedi ve istediğiniz ürünü WhatsApp’tan iletin.' },
  { title: 'Logonuzu gönderin', text: 'Logonuzu JPG, PNG ya da PDF olarak gönderin. Hazır tasarım yoksa ücretsiz hazırlarız.' },
  { title: 'Teklifi ve önizlemeyi onaylayın', text: 'Size fiyat teklifi ve dijital önizleme göndeririz. Onayınızdan sonra baskıya alırız.' },
];

export default async function KurumsalPage() {
  const products = (await getProducts()).filter(getActive).slice(0, 4);

  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li aria-current="page">Kurumsal</li>
              </ol>
            </nav>
            <h1 className="display">Firmanız için <em>logolu</em> kupa.</h1>
            <p className="lead">Ekibiniz, müşterileriniz ve etkinlikleriniz için logolu kupa. Adede göre fiyat, önizleme ve toplu gönderim bir arada.</p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href={QUOTE_HREF} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> Teklif isteyin
              </a>
            </div>
          </header>
        </div>

        <section className="section" aria-labelledby="avantaj-baslik">
          <div className="wrap">
            <h2 id="avantaj-baslik" className="sr-only">Kurumsal siparişte neler var?</h2>
            <div className="cols-3">
              {BENEFITS.map((b, i) => (
                <div key={b.title}>
                  <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-tight" aria-labelledby="teklif-baslik">
          <div className="wrap">
            <div className="section-head">
              <h2 id="teklif-baslik" className="h2">Nasıl teklif alırsınız?</h2>
            </div>
            <div className="cols-3">
              {QUOTE_STEPS.map((s, i) => (
                <div key={s.title}>
                  <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
            <div className="hero-ctas">
              <a className="btn btn-primary" href={QUOTE_HREF} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp’tan teklif isteyin
              </a>
            </div>
          </div>
        </section>

        {products.length > 0 && (
          <section className="section" aria-labelledby="urun-baslik">
            <div className="wrap">
              <div className="section-head">
                <h2 id="urun-baslik" className="h2">Ürünlerimiz</h2>
                <Link href="/#urunler" className="text-link">Tüm ürünler</Link>
              </div>
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard key={getSlug(p)} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
