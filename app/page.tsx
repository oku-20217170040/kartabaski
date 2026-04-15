import { unstable_cache } from 'next/cache';
import { getProductsServer } from '@/lib/products-server';
import { cloudinaryThumb } from '@/lib/products';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import ProductsClient from './ProductsClient';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

const getProducts = unstable_cache(
  () => getProductsServer(),
  ['products'],
  { tags: ['products'] }
);

export default async function HomePage() {
  const products = await getProducts();
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

  // Hero için: önce featured, sonra diğerleri — ilk 3 ürünün görseli
  const heroImages = products
    .filter(p => p.images && p.images.length > 0)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    .slice(0, 3)
    .map(p => {
      const id = p.images![0];
      return id.startsWith('http') ? id : cloudinaryThumb(id);
    });

  return (
    <>
      <Navbar />
      <main>
        <HeroSection heroImages={heroImages} />

        <section className="products-page" style={{ paddingTop: 48 }}>
          <div className="container">
            <ProductsClient initialProducts={products} />

            {/* Konfiguratör Banner */}
            <a
              href="/konfigurator"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                background: 'linear-gradient(135deg, #006D2F 0%, #009140 60%, #25D366 100%)',
                borderRadius: 16,
                padding: '24px 28px',
                margin: '40px 0',
                textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(0,109,47,0.25)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Yeni Özellik ✦
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Kendi kombinasyonunu oluştur
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
                  Bardağını seç, tasarımını seç — biz basalım.
                </div>
              </div>
              <div style={{
                flexShrink: 0,
                background: '#fff',
                color: '#006D2F',
                fontWeight: 800,
                fontSize: 14,
                padding: '12px 22px',
                borderRadius: 10,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}>
                Dene →
              </div>
            </a>

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
                    <a href="mailto:info@kartabaski.com" className="contact-pro-phone" style={{ marginTop: 6 }}>✉️ info@kartabaski.com</a>
                    <a
                      href="https://www.instagram.com/kartabaskii/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-pro-ig"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                      Instagram&apos;da Takip Et
                    </a>
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
