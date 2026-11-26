import { WhatsAppIcon } from './icons';
import { WHATSAPP_BASE } from '@/lib/constants';

const WA_TEXT = 'Merhaba, aradığım kupayı sitede bulamadım. Fotoğrafımı/tasarımımı gönderip bilgi almak istiyorum.';

/** Ürün ızgarasının içinde, aradığını bulamayanlar için tek renkli kutu. */
export function StudioPromoCard() {
  return (
    <aside className="studio-slip" aria-label="Özel sipariş">
      <div>
        <h3>Aradığınız kupa burada yok mu?</h3>
        <p>Ne istediğinizi yazın, elimizde ne varsa gösterelim.</p>
      </div>
      <a
        href={`${WHATSAPP_BASE}?text=${encodeURIComponent(WA_TEXT)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-block"
      >
        <WhatsAppIcon size={18} /> Bize yazın
      </a>
    </aside>
  );
}

export default StudioPromoCard;
