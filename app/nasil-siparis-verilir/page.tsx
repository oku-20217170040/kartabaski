import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Nasıl Sipariş Verilir?',
  description: 'KAR-TA BASKI\'dan kupa baskı siparişi nasıl verilir? 3 kolay adımda kişiye özel kupa siparişinizi verin.',
};

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

const STEPS = [
  {
    number: '1',
    icon: '☕',
    title: 'Ürünü Seç',
    desc: 'Katalogumuzdan beğendiğin kupa modelini seç. Sihirli mat, konik, seramik nescafe veya özel tasarım — dilediğin modeli seçebilirsin.',
  },
  {
    number: '2',
    icon: '💬',
    title: "WhatsApp'tan Yaz",
    desc: 'Seçtiğin kupa modelini ve istediğin tasarımı WhatsApp\'tan bize gönder. Tasarımın yoksa endişelenme — ücretsiz tasarım desteği sunuyoruz.',
  },
  {
    number: '3',
    icon: '📦',
    title: 'Kapıda Teslim',
    desc: 'Siparişin onaylandıktan sonra 3 iş günü içinde kargoya verilir. Türkiye\'nin her yerine kapıya teslim.',
  },
];

export default function NasilSiparisVerilir() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 'var(--nav-h)' }}>
        <div className="container" style={{ maxWidth: 800, paddingTop: 64, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="how-eyebrow">Sipariş Süreci</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: '16px 0 20px', lineHeight: 1.1 }}>
              Nasıl Sipariş Verilir?
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 17, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              3 kolay adımda kişiye özel kupanı kapıda teslim al.
              Tasarım bilgin olmasa bile — biz hallederiz.
            </p>
          </div>

          {/* Steps */}
          <div className="how-steps">
            {STEPS.map((step, i) => (
              <div key={step.number} className="how-step">
                <div className="how-step-left">
                  <div className="how-step-number">{step.number}</div>
                  {i < STEPS.length - 1 && <div className="how-step-line" />}
                </div>
                <div className="how-step-right">
                  <div className="how-step-icon">{step.icon}</div>
                  <h2 className="how-step-title">{step.title}</h2>
                  <p className="how-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Info cards */}
          <div className="how-info-grid">
            <div className="how-info-card">
              <div className="how-info-icon">🎨</div>
              <div className="how-info-title">Ücretsiz Tasarım</div>
              <p>Tasarımın yoksa endişelenme. İsteğini anlat, biz tasarlayalım.</p>
            </div>
            <div className="how-info-card">
              <div className="how-info-icon">🚀</div>
              <div className="how-info-title">Hızlı Üretim</div>
              <p>Onaylanan siparişler 3 iş günü içinde kargoya verilir.</p>
            </div>
            <div className="how-info-card">
              <div className="how-info-icon">🇹🇷</div>
              <div className="how-info-title">Türkiye Geneli</div>
              <p>Türkiye&apos;nin her yerine kargo. Bireysel ve kurumsal siparişler.</p>
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', marginTop: 64 }}>
            <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 16 }}>
              Hadi başlayalım — ilk adım sadece bir mesaj kadar yakın!
            </p>
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="how-cta-btn"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Hemen Sipariş Ver
            </a>
          </div>
        </div>
      </main>
      <Footer />

    </>
  );
}
