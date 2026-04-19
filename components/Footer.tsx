import Link from 'next/link';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import LogoSVG from '@/components/LogoSVG';

const WA_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PHONE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 010 .18h0A2 2 0 012 2v3" />
  </svg>
);

const IG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;
const IG_HREF = 'https://www.instagram.com/kartabaskii/';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="pro-footer">
      {/* Top divider glow */}
      <div className="footer-divider-glow" />

      <div className="container">
        <div className="footer-top">

          {/* Brand column */}
          <div className="footer-brand">
            <Link href="/" className="footer-logo-link">
              <LogoSVG height={40} />
            </Link>
            <p className="footer-brand-desc">
              Hayal Et, Biz Basalım — Kişiye özel kupa baskı.
              Türkiye&apos;nin her yerine hızlı kargo.
            </p>

            {/* Sosyal medya + WhatsApp */}
            <div className="footer-social-row">
              <a
                href={WA_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-wa-btn"
              >
                {WA_ICON}
                Sipariş Ver
              </a>
              <a
                href={IG_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-ig-btn"
                aria-label="Instagram'da takip et"
              >
                {IG_ICON}
                Instagram
              </a>
            </div>

            {/* Trust badges */}
            <div className="footer-badges">
              <span className="footer-badge">✓ Ücretsiz Tasarım</span>
              <span className="footer-badge">✓ 3 İş Günü Kargo</span>
            </div>
          </div>

          {/* Pages */}
          <div className="footer-col">
            <h4 className="footer-col-head">Sayfalar</h4>
            <ul className="footer-nav">
              <li><Link href="/">☕ Tüm Ürünler</Link></li>
              <li><Link href="/kategoriler">🗂️ Kategoriler</Link></li>
              <li><Link href="/nasil-siparis-verilir">📋 Nasıl Sipariş?</Link></li>
              <li><Link href="/hakkimizda">ℹ️ Hakkımızda</Link></li>
              <li><Link href="/#iletisim">📞 İletişim</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-col">
            <h4 className="footer-col-head">Kategoriler</h4>
            <ul className="footer-nav">
              <li><Link href="/?category=Seramik%20Nescafe%20Fincan%C4%B1">Seramik Nescafe Fincanı</Link></li>
              <li><Link href="/?category=L%C3%BCks%20Kupa">Lüks Kupa</Link></li>
              <li><Link href="/?category=Nescafe%20Fincan%C4%B1">Nescafe Fincanı</Link></li>
              <li><Link href="/?category=Latte%20Fincan%C4%B1">Latte Fincanı</Link></li>
              <li><Link href="/?category=Pro%20Kupa">Pro Kupa</Link></li>
              <li><Link href="/?category=B%C3%BCy%C3%BCk%20Kupa">Büyük Kupa</Link></li>
              <li><Link href="/?category=Sihirli%20Kupa">Sihirli Kupa</Link></li>
              <li><Link href="/?category=%C3%96zel%20Tasar%C4%B1m">Özel Tasarım</Link></li>
              <li><Link href="/?category=Kurumsal">Kurumsal</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h4 className="footer-col-head">İletişim</h4>
            <ul className="footer-contact-list">
              <li>
                <span className="fc-icon">{PHONE_ICON}</span>
                <a href={`tel:+${PHONE}`}>{PHONE_DISPLAY}</a>
              </li>
              <li>
                <span className="fc-icon">🌐</span>
                <span>Türkiye geneli online hizmet</span>
              </li>
              <li>
                <span className="fc-icon">📦</span>
                <span>3 iş günü içinde kargoya teslim</span>
              </li>
              <li>
                <span className="fc-icon" style={{ color: '#E1306C' }}>{IG_ICON}</span>
                <a href={IG_HREF} target="_blank" rel="noopener noreferrer">@kartabaskii</a>
              </li>
              <li>
                <span className="fc-icon">✉️</span>
                <a href="mailto:info@kartabaski.com">info@kartabaski.com</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p>© {year} KAR-TA BASKI. Tüm hakları saklıdır.</p>
          <div className="footer-bottom-right">
            <span className="footer-location-pill">
              🇹🇷 Türkiye Geneli Online Hizmet
            </span>
          </div>
        </div>
      </div>

    </footer>
  );
}
