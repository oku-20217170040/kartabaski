'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';
import { WhatsAppIcon } from '@/components/icons';

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

export default function WhatsAppFloat() {
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ürün, tasarım ve sipariş sayfalarının kendi düğmesi var; yönetimde gerekmiyor.
  if (pathname.startsWith('/urun/') || pathname.startsWith('/admin') || pathname.startsWith('/tasarla') || pathname.startsWith('/konfigurator') || pathname.startsWith('/siparis') || !visible) return null;

  return (
    <a className="wa-float" href={WA_HREF} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp üzerinden yazın">
      <WhatsAppIcon size={22} />
      <span className="wa-label">Sipariş için yazın</span>
    </a>
  );
}
