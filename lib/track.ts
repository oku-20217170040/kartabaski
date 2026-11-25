import { trackEvent } from './analytics-client';

// WhatsApp tıklamalarını (varsa) Google Analytics'e ve kendi istatistiklerimize gönderir:
// hangi ürün / hangi buton ne kadar sipariş getiriyor.
export function trackWhatsApp(source: string, product?: string, slug?: string) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.('event', 'whatsapp_click', { source, ...(product && { product }) });
  } catch {
    // Analitik hatası kullanıcı akışını bozmasın
  }
  trackEvent('whatsapp', { src: source, ...(slug && { slug }) });
}

export { trackEvent };
