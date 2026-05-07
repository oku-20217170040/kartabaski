import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Testimonials from '@/components/Testimonials';
import { WHATSAPP_BASE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Kurumsal Kupa Baski | Toplu Siparis & Ozel Fiyat',
  description:
    'Kurumsal kupa baski hizmeti. 10+ adet ozel fiyat, ucretsiz tasarim, logo baski, 3 is gunu teslimat. Promosyon, personel hediyesi, etkinlik icin ideal.',
  keywords: [
    'kurumsal kupa baski',
    'toplu kupa siparis',
    'promosyon kupa',
    'logo baski kupa',
    'kurumsal hediye',
    'personel hediyesi kupa',
    'toplu siparis kupa fiyat',
  ],
};

const PRICING_TIERS = [
  { range: '1 adet', price: '200 - 350', note: 'Bireysel fiyat', highlight: false },
  { range: '10 - 49 adet', price: '110 - 170', note: 'Adet basi', highlight: false },
  { range: '50+ adet', price: '85 - 160', note: 'Adet basi', highlight: true },
];

const BENEFITS = [
  { icon: '🎨', title: 'Ucretsiz Tasarim', desc: 'Logonuzu veya ozel tasariminizi ucretsiz hazirliyoruz. Onay sizde.' },
  { icon: '📦', title: '3 Is Gunu Teslimat', desc: 'Onayli siparisler 3 is gunu icinde kargoya verilir.' },
  { icon: '💰', title: 'Toplu Siparis Indirimi', desc: '10+ adet siparislerde ozel kurumsal fiyatlandirma.' },
  { icon: '✨', title: 'Yuksek Kalite Baski', desc: 'Solmayan, bulasik makinesine dayanikli profesyonel baski.' },
  { icon: '🚚', title: 'Turkiye Geneli Kargo', desc: '81 ile guvenli ve hizli kargo. Toplu siparislerde ozel paketleme.' },
  { icon: '🤝', title: 'Ozel Muhatap', desc: 'Kurumsal siparisleriniz icin WhatsApp uzerinden bire bir iletisim.' },
];

const USE_CASES = [
  { icon: '🏢', title: 'Personel Hediyesi', desc: 'Dogum gunu, yildonumu veya hosgeldin hediyesi olarak kisisellestirilmis kupalar.' },
  { icon: '🎉', title: 'Etkinlik & Lansman', desc: 'Konferans, seminer veya lansmanlarinizda katilimcilara ozel hatira.' },
  { icon: '📈', title: 'Promosyon & Tanitim', desc: 'Logolu kupalarla markanizi musterilerinizin masasina tasiyin.' },
  { icon: '🎁', title: 'Ozel Gun Hediyeleri', desc: 'Yilbasi, Ogretmenler Gunu, Anneler Gunu icin toplu hediye cozumu.' },
];

const WA_KURUMSAL = `${WHATSAPP_BASE}?text=${encodeURIComponent(
  'Merhaba, kurumsal toplu kupa siparişi hakkında bilgi almak istiyorum.'
)}`;

const WA_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function KurumsalPage() {
  return (
    <>
      <Navbar />
      <main className="kurumsal-main">
        <div className="container kurumsal-container">

          {/* Breadcrumb */}
          <div className="kurumsal-breadcrumb">
            <Link href="/" style={{ color: 'var(--muted)' }}>Ana Sayfa</Link>
            <span>&rsaquo;</span>
            <span style={{ color: 'var(--text)' }}>Kurumsal</span>
          </div>

          {/* Hero */}
          <section className="kurumsal-hero">
            <div className="kurumsal-badge">Kurumsal Cozumler</div>
            <h1 className="kurumsal-title">
              Markanizi Her <span style={{ color: 'var(--accent)' }}>Masaya</span> Tasiyin
            </h1>
            <p className="kurumsal-subtitle">
              Logolu kupalar, personel hediyeleri, etkinlik promosyonlari.
              10+ adet siparislerde ozel fiyat ve ucretsiz tasarim destegi.
            </p>
            <div className="kurumsal-hero-btns">
              <a href={WA_KURUMSAL} target="_blank" rel="noopener noreferrer" className="btn-whatsapp kurumsal-btn">
                {WA_SVG} Kurumsal Teklif Al
              </a>
              <Link href="/" className="btn btn-secondary kurumsal-btn">
                Urunlere Goz At
              </Link>
            </div>
          </section>

          {/* Fiyat Tablosu */}
          <section className="kurumsal-section">
            <h2 className="kurumsal-h2">Toplu Siparis Fiyatlari</h2>
            <p className="kurumsal-section-desc">
              Tum modeller icin gecerli genel fiyat araliklari. Kesin fiyat icin WhatsApp&apos;tan ulasin.
            </p>
            <div className="kurumsal-grid kurumsal-grid--pricing">
              {PRICING_TIERS.map((tier) => (
                <div key={tier.range} className={`kurumsal-price-card ${tier.highlight ? 'kurumsal-price-card--highlight' : ''}`}>
                  {tier.highlight && <div className="kurumsal-price-ribbon">EN AVANTAJLI</div>}
                  <div className="kurumsal-price-label">{tier.range}</div>
                  <div className="kurumsal-price-value">
                    {tier.price}<span className="kurumsal-price-unit"> TL</span>
                  </div>
                  <div className="kurumsal-price-note">{tier.note}</div>
                </div>
              ))}
            </div>
            <p className="kurumsal-disclaimer">
              * Fiyatlar urune ve miktara gore degisiklik gosterebilir. KDV dahildir.
            </p>
          </section>

          {/* Avantajlar */}
          <section className="kurumsal-section">
            <h2 className="kurumsal-h2">Neden KAR-TA BASKI?</h2>
            <div className="kurumsal-grid kurumsal-grid--benefits">
              {BENEFITS.map((b) => (
                <div key={b.title} className="kurumsal-card">
                  <div className="kurumsal-card-icon">{b.icon}</div>
                  <div className="kurumsal-card-title">{b.title}</div>
                  <div className="kurumsal-card-desc">{b.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Kullanim Alanlari */}
          <section className="kurumsal-section">
            <h2 className="kurumsal-h2">Kimler Icin?</h2>
            <div className="kurumsal-grid kurumsal-grid--usecases">
              {USE_CASES.map((uc) => (
                <div key={uc.title} className="kurumsal-card kurumsal-card--center">
                  <div className="kurumsal-card-icon kurumsal-card-icon--lg">{uc.icon}</div>
                  <div className="kurumsal-card-title" style={{ fontSize: 15 }}>{uc.title}</div>
                  <div className="kurumsal-card-desc">{uc.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Referanslar */}
          <section className="kurumsal-section">
            <h2 className="kurumsal-h2">Musterilerimiz Ne Diyor?</h2>
            <p className="kurumsal-section-desc">
              500+ mutlu siparisin arkasindan gelen gercek geri bildirimler.
            </p>
            <Testimonials />
          </section>

          {/* Siparis Sureci */}
          <section className="kurumsal-section">
            <h2 className="kurumsal-h2">Kurumsal Siparis Nasil Verilir?</h2>
            <div className="kurumsal-grid kurumsal-grid--steps">
              {[
                { step: '1', icon: '📞', title: 'Bize Ulasin', desc: 'WhatsApp veya e-posta ile ihtiyacinizi bildirin.' },
                { step: '2', icon: '🎨', title: 'Tasarim Onayi', desc: 'Logonuz veya tasariminiz ile mockup hazirliyoruz.' },
                { step: '3', icon: '✅', title: 'Siparis Onayi', desc: 'Tasarimi onaylayin, odeme bilgilerini iletin.' },
                { step: '4', icon: '📦', title: 'Uretim & Kargo', desc: '3 is gunu icinde uretilip kargoya verilir.' },
              ].map((s) => (
                <div key={s.step} className="kurumsal-card kurumsal-card--center kurumsal-step-card">
                  <div className="kurumsal-step-number">{s.step}</div>
                  <div className="kurumsal-card-icon kurumsal-card-icon--lg" style={{ marginTop: 8 }}>{s.icon}</div>
                  <div className="kurumsal-card-title">{s.title}</div>
                  <div className="kurumsal-card-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="kurumsal-cta">
            <h2 className="kurumsal-cta-title">Kurumsal Teklifinizi Hemen Alin</h2>
            <p className="kurumsal-cta-desc">
              Miktar, model ve tasarim detaylarinizi WhatsApp uzerinden iletin.
              Size ozel fiyat teklifi hazirlayalim.
            </p>
            <div className="kurumsal-cta-btns">
              <a href={WA_KURUMSAL} target="_blank" rel="noopener noreferrer" className="kurumsal-cta-btn-primary">
                {WA_SVG} WhatsApp ile Teklif Al
              </a>
              <a href="mailto:info@kartabaski.com" className="kurumsal-cta-btn-secondary">
                E-posta Gonder
              </a>
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </>
  );
}
