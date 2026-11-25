// Blog yazısı tipleri — istemci ve sunucu ortak kullanır (server-only içermez).

export interface FaqItem { q: string; a: string }

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string; // liste kartı + meta description
  content: string; // basit Markdown
  coverImage?: string; // Cloudinary public_id
  tags: string[];
  faq: FaqItem[]; // FAQPage JSON-LD (GEO/AI arama için)
  productIds?: string[]; // yazıda geçen/önerilen ürünler (ürün sayfasında "İlgili yazılar" için)
  categories?: string[]; // ilgili kupa kategorileri
  published: boolean;
  publishedAt: number; // yayınlanma zamanı (ms); taslakta 0
  updatedAt: number;
  scheduledAt?: number; // taslak + ileri tarih = planlı yayın (cron yayına alır)
  auto?: boolean; // otomasyonla üretildi
}

export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
