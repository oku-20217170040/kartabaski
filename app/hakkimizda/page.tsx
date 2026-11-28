import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon } from '@/components/icons';
import SocialLinks from '@/components/SocialLinks';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT, SITE_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Hakkımızda',
  description: 'KAR-TA BASKI kişiye özel kupa ve fincan baskısı yapar. Tek adetten toplu siparişe, önizleme onayınızla baskıya alır, Türkiye’nin her yerine gönderir.',
  alternates: { canonical: '/hakkimizda' },
};

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

const WORKFLOW = [
  { title: 'Tasarım', text: 'Hazır bir tasarımınız yoksa fotoğrafınızı, logonuzu ya da metninizi gönderin; tasarımı ücretsiz hazırlıyoruz.' },
  { title: 'Önizleme', text: 'Baskıdan önce dijital önizleme gönderiyoruz. Onayınız olmadan hiçbir şey basılmaz.' },
  { title: 'Gönderim', text: 'Onaydan sonra 3 iş günü içinde kargoya veriyoruz. Türkiye’nin her yerine gönderim yapıyoruz.' },
];

export default function HakkimizdaPage() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li aria-current="page">Hakkımızda</li>
              </ol>
            </nav>
            <h1 className="display">Kupanız, <em>sizin</em> tasarımınızla.</h1>
            <p className="lead">{SITE_NAME}, kişiye özel kupa ve fincan baskısı yapar. Tek bir hediyelik kupadan şirket siparişine kadar her işi aynı özenle ele alıyoruz.</p>
          </header>
        </div>

        <section className="section" aria-labelledby="ne-yapiyoruz">
          <div className="wrap">
            <div className="prose">
              <h2 id="ne-yapiyoruz" style={{ marginTop: 0 }}>Ne yapıyoruz?</h2>
              <p>Fotoğraf, logo ya da yazı; neyi kupaya taşımak istiyorsanız onu basıyoruz. Minimum sipariş adedi yok, tek adet de sipariş verebilirsiniz.</p>
              <p>Kupanızı sitede tasarlayıp sepete ekleyerek sipariş oluşturabilir ya da bize doğrudan WhatsApp’tan yazabilirsiniz. Kesin fiyat ve onay WhatsApp üzerinden ilerler; sitede ödeme alınmaz.</p>
            </div>
          </div>
        </section>

        <section className="section-tight" aria-labelledby="nasil-calisiyoruz">
          <div className="wrap">
            <div className="section-head">
              <h2 id="nasil-calisiyoruz" className="h2">Nasıl çalışıyoruz?</h2>
            </div>
            <div className="cols-3">
              {WORKFLOW.map((w, i) => (
                <div key={w.title}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="iletisim-baslik">
          <div className="wrap">
            <h2 id="iletisim-baslik" className="h2">Aklınızdaki bir fikir mi var?</h2>
            <p className="lead" style={{ marginTop: 12 }}>Bize yazın, birlikte kupaya dönüştürelim.</p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href={WA_HREF} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp ile yazın
              </a>
              <Link className="btn btn-outline" href="/nasil-siparis-verilir">Sipariş nasıl verilir?</Link>
            </div>
            <div className="tabela-yollar" aria-label="Sosyal hesaplarımız">
              <SocialLinks />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
