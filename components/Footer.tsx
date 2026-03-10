import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">Ümit<span>Spot</span></div>
            <p className="footer-desc">
              Esenyurt'un en yakın spotçusu. İkinci el ve sıfır spot mobilya, beyaz eşya alım satımında güvenilir adresiniz.
            </p>
          </div>
          <div>
            <div className="footer-col-title">Sayfalar</div>
            <ul className="footer-links">
              <li><Link href="/">Tüm Ürünler</Link></li>
              <li><Link href="/kategoriler">Kategoriler</Link></li>
              <li><Link href="/urun-sat" style={{ color: '#f59e0b' }}>🏷️ Eşyanı Sat</Link></li>
              <li><Link href="/#iletisim">İletişim</Link></li>
              <li><Link href="/hakkimizda">Hakkımızda</Link></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Kategoriler</div>
            <ul className="footer-links">
              <li><Link href="/?category=Mobilya">Mobilya</Link></li>
              <li><Link href="/?category=Beyaz%20E%C5%9Fya">Beyaz Eşya</Link></li>
              <li><Link href="/?category=Elektronik">Elektronik</Link></li>
              <li><Link href="/?category=Yatak">Yatak</Link></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">İletişim</div>
            <ul className="footer-links">
              <li>
                <a href="https://wa.me/905426447296" target="_blank" rel="noopener noreferrer">
                  📱 0542 644 72 96
                </a>
              </li>
              <li>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                  📍 Mehmet Akif Ersoy Mah. 1824 Sk. 11A Esenyurt / İstanbul
                </span>
              </li>
              <li>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                  🕐 Her gün 09:00 – 00:00
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Ümit Spot. Tüm hakları saklıdır.</p>
          <p>Esenyurt, İstanbul</p>
        </div>
      </div>
    </footer>
  );
}
