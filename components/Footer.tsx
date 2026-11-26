import Link from 'next/link';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT, PHONE, PHONE_DISPLAY } from '@/lib/constants';
import { INSTAGRAM_URL } from '@/lib/site';
import { WhatsAppIcon, InstagramIcon, PhoneIcon, MailIcon } from '@/components/icons';

const EMAIL = 'info@kartabaski.com';
const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

const PRODUCT_LINKS = [
  { label: 'Lüks Kupa', category: 'Lüks Kupa' },
  { label: 'Kahve Fincanı', category: 'Kahve Fincanı' },
  { label: 'Latte Fincanı', category: 'Latte Fincanı' },
  { label: 'Sihirli Kupa', category: 'Sihirli Kupa' },
  { label: 'Büyük Kupa', category: 'Büyük Kupa' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-cols">
          <div>
            <p className="footer-about">
              Kupaya ve fincana istediğinizi basıyoruz. Bir tane de olur, yüz tane de. Siparişi WhatsApp’tan alıyoruz.
            </p>
          </div>

          <div>
            <h2>Ürünler</h2>
            <ul>
              {PRODUCT_LINKS.map((l) => (
                <li key={l.category}>
                  <Link href={`/?kategori=${encodeURIComponent(l.category)}#urunler`}>{l.label}</Link>
                </li>
              ))}
              <li><Link href="/kategoriler">Tüm kategoriler</Link></li>
            </ul>
          </div>

          <div>
            <h2>Bilgi</h2>
            <ul>
              <li><Link href="/nasil-siparis-verilir">Nasıl sipariş verilir</Link></li>
              <li><Link href="/kurumsal">Kurumsal siparişler</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/konfigurator">Kendin tasarla</Link></li>
              <li><Link href="/hakkimizda">Hakkımızda</Link></li>
            </ul>
          </div>

          <div className="footer-contact">
            <h2>İletişim</h2>
            <ul>
              <li><a href={WA_HREF} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={16} /> WhatsApp</a></li>
              <li><a href={`tel:+${PHONE}`}><PhoneIcon size={16} /> {PHONE_DISPLAY}</a></li>
              <li><a href={`mailto:${EMAIL}`}><MailIcon size={16} /> {EMAIL}</a></li>
              <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><InstagramIcon size={16} /> Instagram</a></li>
            </ul>
          </div>
        </div>

        <span className="footer-mark" aria-hidden="true">Kar-Ta Baskı</span>

        <div className="footer-legal">
          <span>© {year} KAR-TA BASKI</span>
          <span>Türkiye geneline kargo</span>
        </div>
      </div>
    </footer>
  );
}
