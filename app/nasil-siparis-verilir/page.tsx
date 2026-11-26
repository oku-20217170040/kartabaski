import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon, ChevronDownIcon } from '@/components/icons';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Nasıl Sipariş Verilir?',
  description: 'Kupa baskı siparişi dört adımda: kupayı tasarlayıp sepete ekleyin, siparişi WhatsApp’tan gönderin, önizlemeyi onaylayın, 3 iş günü içinde kargoya verelim.',
  alternates: { canonical: '/nasil-siparis-verilir' },
};

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

const STEPS = [
  { title: 'Tasarlayıp sepete ekleyin', text: 'Kupayı seçin; yazınızı ve fotoğraflarınızı ekleyin. Hazır tasarımınız yoksa işaretleyin, ücretsiz hazırlayalım. Farklı kupaları aynı sepette toplayabilirsiniz.' },
  { title: 'Siparişi gönderin', text: 'Sepette adınızı ve telefonunuzu yazıp siparişi oluşturun. WhatsApp’a yalnızca sipariş bağlantınız gider; ayrıntılar o sayfadadır.' },
  { title: 'Önizlemeyi onaylayın', text: 'Baskıdan önce size dijital önizleme gönderiyoruz. Değişiklik isterseniz düzeltiriz; onayınız olmadan baskı yapılmaz.' },
  { title: 'Baskı ve kargo', text: 'Onaydan sonra baskıya alınır ve 3 iş günü içinde kargoya verilir. Türkiye’nin her yerine gönderim yapıyoruz.' },
];

const FAQ = [
  { q: 'Tek adet sipariş verebilir miyim?', a: 'Evet. Minimum sipariş adedi yok; tek bir hediyelik kupa da basıyoruz.' },
  { q: 'Tasarımım yoksa ne yapmalıyım?', a: 'Fotoğrafınızı, logonuzu ya da yazdırmak istediğiniz metni gönderin. Tasarımı ücretsiz olarak biz hazırlıyoruz.' },
  { q: 'Baskıdan önce sonucu görebilir miyim?', a: 'Evet. Dijital önizleme gönderiyoruz ve siz onaylamadan baskıya geçmiyoruz.' },
  { q: 'Siparişim ne zaman kargoya verilir?', a: 'Tasarım onayından sonra 3 iş günü içinde. Türkiye’nin her yerine gönderim yapıyoruz.' },
  { q: 'Toplu siparişte indirim var mı?', a: '45 adet ve üzeri siparişlerde adet başı fiyat düşüyor. Adet ve ürün bilgisini yazın, size özel teklif hazırlayalım.' },
];

export default function NasilSiparisVerilirPage() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li aria-current="page">Nasıl sipariş verilir?</li>
              </ol>
            </nav>
            <h1 className="display">Dört adımda siparişiniz hazır.</h1>
            <p className="lead">Sitede ödeme alınmıyor. Siparişinizi hazırlayın, fiyatı ve son hâlini WhatsApp’tan birlikte netleştirelim.</p>
          </header>
        </div>

        <section className="steps steps-4" aria-label="Sipariş adımları">
          <div className="wrap">
            {STEPS.map((s, i) => (
              <div className="step" key={s.title}>
                <span className="step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="sss-baslik">
          <div className="wrap">
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
        </section>

        <section className="section-tight" aria-labelledby="cta-baslik">
          <div className="wrap">
            <h2 id="cta-baslik" className="h2">Başlamaya hazır mısınız?</h2>
            <div className="hero-ctas">
              <a className="btn btn-primary" href={WA_HREF} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp ile yazın
              </a>
              <Link className="btn btn-outline" href="/#urunler">Ürünlere göz atın</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
