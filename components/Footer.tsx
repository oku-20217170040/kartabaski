import Link from 'next/link';
import { PHONE, PHONE_DISPLAY, WHATSAPP_BASE } from '@/lib/constants';

const WA_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const MAP_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CLOCK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const PHONE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 0130 2.18h0A2 2 0 0122 4v3" />
  </svg>
);

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
              <img src="/logo.svg" alt="ÜmitSpot" height={40} style={{ display: 'block' }} />
            </Link>
            <p className="footer-brand-desc">
              Esenyurt&apos;un en güvenilir ikinci el ve sıfır spot mobilya, beyaz eşya alım satım merkezi.
            </p>

            {/* WhatsApp CTA */}
            <a
              href={`${WHATSAPP_BASE}?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum`}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-wa-btn"
            >
              {WA_ICON}
              WhatsApp ile Yazın
            </a>

            {/* Trust badges */}
            <div className="footer-badges">
              <span className="footer-badge">✓ Güvenilir Satıcı</span>
              <span className="footer-badge">✓ Aynı Gün Teslimat</span>
            </div>
          </div>

          {/* Pages */}
          <div className="footer-col">
            <h4 className="footer-col-head">Sayfalar</h4>
            <ul className="footer-nav">
              <li><Link href="/">🛋️ Tüm Ürünler</Link></li>
              <li><Link href="/kategoriler">🗂️ Kategoriler</Link></li>
              <li><Link href="/urun-sat" style={{ color: '#f59e0b' }}>🏷️ Eşyanı Sat</Link></li>
              <li><Link href="/hakkimizda">ℹ️ Hakkımızda</Link></li>
              <li><Link href="/#iletisim">📍 İletişim</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-col">
            <h4 className="footer-col-head">Kategoriler</h4>
            <ul className="footer-nav">
              <li><Link href="/?category=Mobilya">Mobilya</Link></li>
              <li><Link href="/?category=Beyaz%20E%C5%9Fya">Beyaz Eşya</Link></li>
              <li><Link href="/?category=Elektronik">Elektronik</Link></li>
              <li><Link href="/?category=Yatak">Yatak & Baza</Link></li>
              <li><Link href="/?category=Koltuk">Koltuk</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h4 className="footer-col-head">İletişim</h4>
            <ul className="footer-contact-list">
              <li>
                <span className="fc-icon">{PHONE_ICON}</span>
                <a href={`tel:+${PHONE}`}>
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <span className="fc-icon">{MAP_ICON}</span>
                <span>Mehmet Akif Ersoy Mah. 1824 Sk. 11A Esenyurt / İstanbul</span>
              </li>
              <li>
                <span className="fc-icon">{CLOCK_ICON}</span>
                <span>Her gün 09:00 – 00:00</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p>© {year} Ümit Spot. Tüm hakları saklıdır.</p>
          <div className="footer-bottom-right">
            <span className="footer-location-pill">
              📍 Esenyurt, İstanbul
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .pro-footer {
          position: relative;
          background: #0a0d12;
          padding-top: 64px;
          margin-top: 80px;
        }
        .footer-divider-glow {
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(37,211,102,0.4), transparent);
        }

        .footer-top {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.3fr;
          gap: 48px;
          padding-bottom: 48px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        @media (max-width: 1024px) {
          .footer-top { grid-template-columns: 1fr 1fr; gap: 36px; }
          .footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 640px) {
          .footer-top { grid-template-columns: 1fr; gap: 28px; }
        }

        /* Brand */
        .footer-logo-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-bottom: 14px;
        }
        .footer-logo-badge {
          width: 34px; height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #25D366, #16a34a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 0 20px rgba(37,211,102,0.3);
        }
        .footer-logo-text {
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .footer-logo-text span {
          color: var(--accent);
        }
        .footer-brand-desc {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
          margin-bottom: 20px;
          max-width: 320px;
        }
        .footer-wa-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, #25D366, #16a34a);
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(37,211,102,0.3);
          margin-bottom: 16px;
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .footer-wa-btn:hover {
          box-shadow: 0 6px 30px rgba(37,211,102,0.45);
          transform: translateY(-1px);
        }
        .footer-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .footer-badge {
          padding: 4px 12px;
          border-radius: 100px;
          border: 1px solid rgba(37,211,102,0.2);
          background: rgba(37,211,102,0.06);
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
        }

        /* Columns */
        .footer-col {}
        .footer-col-head {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text);
          margin: 0 0 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .footer-nav {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .footer-nav a {
          color: var(--muted);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.15s;
        }
        .footer-nav a:hover { color: var(--text); }

        /* Contact list */
        .footer-contact-list {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .footer-contact-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .footer-contact-list a {
          color: var(--accent);
          text-decoration: none;
        }
        .footer-contact-list a:hover { text-decoration: underline; }
        .fc-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--accent);
        }

        /* Bottom */
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0 32px;
          color: var(--muted);
          font-size: 13px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .footer-location-pill {
          padding: 4px 14px;
          border-radius: 100px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 12px;
          color: var(--muted);
        }
      `}</style>
    </footer>
  );
}
