import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WHATSAPP_BASE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Hakkımızda | KAR-TA BASKI – Özel Kupa Baskı',
  description: 'KAR-TA BASKI olarak özel tasarım kupa baskı hizmetleri sunuyoruz. Hayal ettiğiniz tasarımı kupanıza baskı yaparak hayata geçiriyoruz.',
};

export default function HakkimizdaPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '70vh', padding: '60px 0' }}>
        <div className="container" style={{ maxWidth: 760 }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 40, fontSize: 13, color: 'var(--muted)' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>Ana Sayfa</Link>
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>Hakkımızda</span>
          </div>

          {/* Başlık */}
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>
            KAR-TA <span style={{ color: 'var(--accent)' }}>BASKI</span> Hakkında
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, marginBottom: 48, lineHeight: 1.7 }}>
            Hayal Et, Biz Basalım
          </p>

          {/* Bölümler */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
                ☕ Biz Kimiz?
              </h2>
              <p style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
                KAR-TA BASKI, kişiye özel kupa baskı alanında hizmet veren bir online mağazadır.
                Sihirli mat kupa, sihirli konik kupa, seramik nescafe fincanı ve daha fazlasını
                hayalinizdeki tasarımla kişiselleştiriyoruz. Türkiye'nin her yerine kargo hizmetimizle
                özel tasarımınızı kapınıza getiriyoruz.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
                ✨ Neden KAR-TA BASKI?
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {[
                  { icon: '🎨', title: 'Özel Tasarım', desc: 'Her müşteri için benzersiz, kişiselleştirilmiş baskı.' },
                  { icon: '⭐', title: 'Kaliteli Baskı', desc: 'Solmayan, uzun ömürlü yüksek kalite baskı teknolojisi.' },
                  { icon: '🚚', title: 'Türkiye Geneli Kargo', desc: 'Hızlı ve güvenli kargo ile kapınıza teslim.' },
                  { icon: '💬', title: 'WhatsApp Sipariş', desc: 'Kolay ve hızlı sipariş için sadece mesaj atın.' },
                ].map((item) => (
                  <div key={item.title} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '20px 16px',
                  }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{item.title}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
                📦 Nasıl Sipariş Verilir?
              </h2>
              <p style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: 8 }}>
                Ürünü seçin, WhatsApp üzerinden bize ulaşın ve tasarımınızı gönderin — biz hallederiz.
                Siparişleriniz genellikle 3–5 iş günü içinde hazırlanıp kargolanır.
              </p>
              <Link href="/nasil-siparis-verilir" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>
                Detaylı sipariş rehberi →
              </Link>
            </section>

            {/* CTA */}
            <section style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '28px 24px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Bir sorunuz mu var?</div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>WhatsApp üzerinden hemen yanıt alın.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a
                  href={`${WHATSAPP_BASE}?text=Merhaba%2C%20kupa%20bask%C4%B1%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-whatsapp"
                  style={{ fontSize: 14, padding: '12px 20px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
                <Link href="/" className="btn btn-secondary" style={{ fontSize: 14, padding: '12px 20px' }}>
                  Ürünlere Göz At
                </Link>
              </div>
            </section>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
