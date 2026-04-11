import { unstable_cache } from 'next/cache';
import { getProducts as _getProducts } from '@/lib/products';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import ProductsClient from './ProductsClient';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

const getProducts = unstable_cache(
  () => _getProducts(),
  ['products'],
  { tags: ['products'] }
);

export default async function HomePage() {
  const products = await getProducts();
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />

        <section className="products-page" style={{ paddingTop: 48 }}>
          <div className="container">
            <ProductsClient initialProducts={products} />

            {/* Contact Section */}
            <section id="iletisim" className="contact-pro">
              <div className="contact-pro-inner">
                <div className="contact-pro-left">
                  <span className="contact-pro-eyebrow">Türkiye Geneli Online Hizmet</span>
                  <h2 className="contact-pro-title">Sipariş vermek ister misiniz?</h2>
                  <p className="contact-pro-desc">
                    Tasarımınızı gönderin veya biz tasarlayalım — ücretsiz.
                    Siparişiniz 3 iş günü içinde kargoya verilir.
                  </p>
                  <div className="contact-pro-meta">
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">🎨</span>
                      <span>Ücretsiz tasarım desteği</span>
                    </div>
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">🚚</span>
                      <span>Türkiye geneli kargo</span>
                    </div>
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">📦</span>
                      <span>3 iş günü kargoya teslim</span>
                    </div>
                  </div>
                </div>

                <div className="contact-pro-right">
                  <div className="contact-pro-card">
                    <div className="contact-pro-card-top">
                      <div className="contact-pro-avatar">K</div>
                      <div>
                        <div className="contact-pro-name">KAR-TA BASKI</div>
                        <div className="contact-pro-status">
                          <span className="contact-pro-dot" />
                          Çevrimiçi
                        </div>
                      </div>
                    </div>
                    <p className="contact-pro-bubble">
                      Merhaba! Kupa baskı siparişi için yazabilirsiniz 👋
                    </p>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-pro-wa-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp ile Yaz
                    </a>
                    <a href={`tel:+${PHONE}`} className="contact-pro-phone">📞 {PHONE_DISPLAY}</a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
      <Footer />

    </>
  );
}
