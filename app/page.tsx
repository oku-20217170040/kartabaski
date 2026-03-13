import { getProducts } from '@/lib/products';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import ProductsClient from './ProductsClient';

export const revalidate = 60;

export default async function HomePage() {
  const products = await getProducts();

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
                  <span className="contact-pro-eyebrow">📍 Esenyurt, İstanbul</span>
                  <h2 className="contact-pro-title">Bir ürün mü buldunuz?</h2>
                  <p className="contact-pro-desc">
                    Satın almak veya fiyat öğrenmek için WhatsApp&apos;tan yazın.
                    Aynı gün cevap, aynı gün teslimat.
                  </p>
                  <div className="contact-pro-meta">
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">🕐</span>
                      <span>Her gün 09:00 – 00:00</span>
                    </div>
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">🚚</span>
                      <span>Aynı gün teslimat & nakliye</span>
                    </div>
                    <div className="contact-meta-item">
                      <span className="contact-meta-icon">💬</span>
                      <span>Fiyat pazarlığı yapılır</span>
                    </div>
                  </div>
                </div>

                <div className="contact-pro-right">
                  <div className="contact-pro-card">
                    <div className="contact-pro-card-top">
                      <div className="contact-pro-avatar">Ü</div>
                      <div>
                        <div className="contact-pro-name">Ümit Spot</div>
                        <div className="contact-pro-status">
                          <span className="contact-pro-dot" />
                          Çevrimiçi
                        </div>
                      </div>
                    </div>
                    <p className="contact-pro-bubble">
                      Merhaba! Ürünlerimiz hakkında bilgi almak istiyorum 👋
                    </p>
                    <a
                      href="https://wa.me/905426447296?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-pro-wa-btn"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp ile Yaz
                    </a>
                    <p className="contact-pro-phone">📞 0542 644 72 96</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        .contact-pro {
          margin: 80px 0 40px;
          padding: 60px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          position: relative;
          overflow: hidden;
        }
        .contact-pro::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(37,211,102,0.4), transparent);
        }
        .contact-pro::after {
          content: '';
          position: absolute;
          top: -200px; right: -200px;
          width: 400px; height: 400px;
          background: rgba(37,211,102,0.04);
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .contact-pro-inner {
          display: flex;
          gap: 60px;
          align-items: center;
          position: relative;
          z-index: 1;
        }
        .contact-pro-left { flex: 1; }
        .contact-pro-right { flex-shrink: 0; width: 300px; }

        .contact-pro-eyebrow {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 100px;
          background: rgba(37,211,102,0.08);
          border: 1px solid rgba(37,211,102,0.2);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .contact-pro-title {
          font-size: 32px;
          font-weight: 800;
          color: var(--text);
          margin: 0 0 12px;
          line-height: 1.2;
        }
        .contact-pro-desc {
          color: var(--muted);
          font-size: 15px;
          line-height: 1.7;
          margin-bottom: 24px;
          max-width: 400px;
        }
        .contact-pro-meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .contact-meta-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 14px;
        }
        .contact-meta-icon { font-size: 16px; }

        /* Card */
        .contact-pro-card {
          background: #0d1520;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .contact-pro-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .contact-pro-avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #25D366, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 0 20px rgba(37,211,102,0.3);
        }
        .contact-pro-name {
          font-weight: 700;
          color: var(--text);
          font-size: 15px;
        }
        .contact-pro-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--accent);
        }
        .contact-pro-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 6px rgba(37,211,102,0.7);
          animation: dot-blink 2s ease-in-out infinite;
        }
        .contact-pro-bubble {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px 12px 12px 4px;
          padding: 12px 16px;
          color: var(--muted);
          font-size: 14px;
          font-style: italic;
          line-height: 1.5;
          margin: 0;
        }
        .contact-pro-wa-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, #25D366, #16a34a);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          box-shadow: 0 4px 24px rgba(37,211,102,0.35);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .contact-pro-wa-btn:hover {
          box-shadow: 0 6px 36px rgba(37,211,102,0.5);
          transform: translateY(-1px);
        }
        .contact-pro-phone {
          text-align: center;
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }

        @media (max-width: 900px) {
          .contact-pro { padding: 36px 24px; }
          .contact-pro-inner { flex-direction: column; gap: 32px; }
          .contact-pro-right { width: 100%; }
        }
      `}</style>
    </>
  );
}
