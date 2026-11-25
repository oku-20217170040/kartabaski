import Link from 'next/link';
import { ArrowRightIcon, WhatsAppIcon } from './icons';
import { WHATSAPP_BASE } from '@/lib/constants';

const STUDIO_WA_TEXT =
  'Merhaba, kupaya özel bir fotoğraf/tasarım bastırmak için önizleme rica ediyorum.';

/** Ürün ızgarası içinde özel tasarım atölyesine yönlendiren editoryal dergi kartı. */
export function StudioPromoCard() {
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(STUDIO_WA_TEXT)}`;

  return (
    <aside className="studio-card" aria-label="Ücretsiz özel tasarım atölyesi">
      <div className="studio-card-top">
        <span className="studio-card-tag">Ücretsiz Tasarım</span>
        <svg
          className="studio-card-art"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M7 40h25" />
          <path d="M10 17h17v15a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5V17Z" />
          <path d="M10 17c0-1.4 3.8-2.4 8.5-2.4s8.5 1 8.5 2.4" />
          <path d="M27 20.5h3.5a3.5 3.5 0 0 1 0 7H27" />
          <rect x="14.5" y="22.5" width="8" height="8" rx="1" strokeDasharray="2 2" />
          <path d="M31.5 15.5l8.5-8.5 3 3-8.5 8.5-4 1 1-4Z" />
          <path d="M38 9l3 3" />
          <path d="M12.5 7v4M10.5 9h4" />
          <path d="M21 5.5v3M19.5 7h3" />
        </svg>
      </div>

      <div className="studio-card-body">
        <p className="studio-card-hand font-hand">Aklında bambaşka bir fikir mi var?</p>
        <h3 className="studio-card-title">Fotoğrafı atın, önizlemeyi biz hazırlayalım.</h3>
        <p className="studio-card-desc">
          Tasarım bilmenize gerek yok; onayınız olmadan baskıya geçmiyoruz.
        </p>
      </div>

      <div className="studio-card-actions">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-light btn-sm"
        >
          <WhatsAppIcon size={16} /> Tasarım gönder
        </a>
        <Link href="/konfigurator" className="studio-card-sublink">
          veya kendin eşleştir <ArrowRightIcon size={14} />
        </Link>
      </div>
    </aside>
  );
}

export default StudioPromoCard;
