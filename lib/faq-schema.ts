// FAQPage JSON-LD üreticisi. Google yalnızca sayfada GÖRÜNEN sorular için şemayı dikkate alır:
// blog yazısında SSS bölümü aynı listeyi görünür basar.
import type { FaqItem } from './posts-types';

export function faqPageSchema(items: FaqItem[]) {
  const valid = items.filter((f) => f.q.trim() && f.a.trim());
  if (valid.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Kupa baskıyla ilgili genel sorular (blog taslaklarına eklenir). */
export const GENERAL_FAQ: FaqItem[] = [
  {
    q: 'Kupa baskıda minimum sipariş adedi var mı?',
    a: 'Hayır. Tek adet de sipariş verebilirsiniz; toplu ve kurumsal siparişlerde adede göre özel fiyat sunuyoruz.',
  },
  {
    q: 'Baskıdan önce tasarımı görebilir miyim?',
    a: 'Evet. Baskıya geçmeden önce tasarımın dijital önizlemesini WhatsApp üzerinden gönderiyoruz; onayınız olmadan baskı yapılmaz.',
  },
  {
    q: 'Siparişim ne zaman kargoya verilir?',
    a: 'Tasarım onayından sonra genellikle 3 iş günü içinde kargoya veriyoruz ve Türkiye genelinde gönderim yapıyoruz.',
  },
];
