import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppIcon } from '@/components/icons';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <div className="notice">
            <div>
              <p className="eyebrow">404</p>
              <h1 className="display">Aradığınız sayfa bulunamadı.</h1>
              <p className="lead">Adres değişmiş ya da sayfa kaldırılmış olabilir. Ana sayfadan devam edebilir ya da bize yazabilirsiniz.</p>
              <div className="hero-ctas">
                <Link href="/" className="btn btn-primary">Ana sayfaya dön</Link>
                <a
                  className="btn btn-outline"
                  href={`${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon size={18} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
