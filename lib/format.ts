// Saf (pure) yardımcılar — Firebase istemci SDK'sına bağımlı değildir; server ve client'ta güvenle import edilir.
import { PHONE, DEFAULT_WA_TEXT } from './constants';
import { SITE_URL } from './site';

// ── Cloudinary ───────────────────────────────────────────────────────────────

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

export function cloudinaryUrl(publicId: string, opts = 'f_auto,q_auto,w_1200,c_limit'): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${opts}/${publicId}`;
}

export function cloudinaryThumb(publicId: string): string {
  return cloudinaryUrl(publicId, 'f_auto,q_auto,w_600,c_limit');
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function whatsappLink(productTitle?: string, slug?: string, color?: string): string {
  if (!productTitle) {
    return `https://wa.me/${PHONE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;
  }
  const productUrl = slug ? `\n🔗 ${SITE_URL}/urun/${slug}` : '';
  const colorLine = color ? `\n🎨 Renk: ${color}` : '';
  const text = `Merhaba, aşağıdaki ürün için sipariş vermek istiyorum. Fiyat bilgisi alabilir miyim?\n\n☕ ${productTitle}${colorLine}${productUrl}`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}

// ── Fiyat ────────────────────────────────────────────────────────────────────

export function formatPriceRange(priceMin: number, priceMax: number): string {
  const fmt = (n: number) => `${new Intl.NumberFormat('tr-TR').format(n)}₺`;
  if (!priceMin && !priceMax) return 'Fiyat için yazın';
  if (priceMin && !priceMax) return fmt(priceMin);
  if (!priceMin && priceMax) return fmt(priceMax);
  if (priceMin === priceMax) return fmt(priceMin);
  return `${fmt(priceMin)} – ${fmt(priceMax)}`;
}

// ── Görünen ürün adı ─────────────────────────────────────────────────────────

const TITLE_SUFFIX = /\s*[—–-]\s*kişiye özel baskı\s*$/i;
const KEEP_LOWER = new Set(['ve', 'ile', 'de', 'da']);

/**
 * Vitrinde gösterilecek ürün adı. Veriyi değiştirmez; yalnızca sunumu tutarlı hale getirir:
 * "— Kişiye Özel Baskı" ekini atar, TAMAMI BÜYÜK HARF yazılmış adları Türkçe kurallarla
 * baş harfi büyük biçime çevirir.
 */
export function displayTitle(title: string): string {
  let t = (title || '').replace(TITLE_SUFFIX, '').trim();
  const letters = t.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (letters.length > 3 && letters === letters.toLocaleUpperCase('tr-TR')) {
    t = t
      .toLocaleLowerCase('tr-TR')
      .split(/\s+/)
      .map((w, i) =>
        i > 0 && KEEP_LOWER.has(w) ? w : w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1),
      )
      .join(' ');
  }
  return t;
}

// ── Renk adı → örnek renk ────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  'beyaz': '#FFFFFF', 'siyah': '#1B1A17', 'kırmızı': '#C8352E', 'mavi': '#3D6FB6',
  'lacivert': '#1E2B4F', 'yeşil': '#3F8F4E', 'koyu yeşil': '#1F4A36', 'sarı': '#F2D64B',
  'turuncu': '#E8833A', 'pembe': '#E7A0B4', 'mor': '#6B4A8E', 'lila': '#B9A2D6',
  'gri': '#9A968E', 'kahverengi': '#7A5235', 'bordo': '#6E1F2A', 'krem': '#EFE6D2',
  'pastel yeşil': '#BFD8C0', 'pastel sarı': '#F3E6A6', 'pastel mavi': '#BBD3EA',
  'pastel pembe': '#F1CAD3', 'pembe pastel': '#F1CAD3', 'pastel mor': '#D3C6E6',
  'transparan': '#EDEAE4',
};

/** Renk adını örnek renk değerine çevirir; bilinmiyorsa null döner. */
export function colorSwatch(name: string): string | null {
  return COLOR_HEX[(name || '').trim().toLocaleLowerCase('tr-TR')] ?? null;
}
