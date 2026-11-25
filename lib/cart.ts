import type { CartItem, SepetTalebiItem, CartProductInfo } from './cart-types';
import { MAX_CART_ITEMS, MAX_QTY } from './cart-schemas';
import { SITE_URL } from './site';

// Saf sepet mantığı: Firebase / ürün bağımlılığı yok (istemci ve sunucu ortak).

export { MAX_CART_ITEMS, MAX_QTY };
export const CART_STORAGE_KEY = 'kartabaski-cart-v1';
export const NOTE_MAX = 200;

export function clampQty(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(v, MAX_QTY);
}

export function lineKey(productId: string, color?: string): string {
  return `${productId}::${(color ?? '').trim().toLowerCase()}`;
}

/** Aynı ürün + renk varsa adet artar (en fazla MAX_QTY); yeni satır MAX_CART_ITEMS ile sınırlıdır. */
export function addToCart(items: CartItem[], item: CartItem): CartItem[] {
  const existing = items.find((i) => i.key === item.key);
  if (existing) {
    return items.map((i) =>
      i.key === item.key
        ? { ...i, qty: clampQty(i.qty + item.qty), note: item.note?.trim() ? item.note : i.note }
        : i
    );
  }
  if (items.length >= MAX_CART_ITEMS) return items;
  return [...items, { ...item, qty: clampQty(item.qty) }];
}

export function removeFromCart(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => i.key !== key);
}

export function setQty(items: CartItem[], key: string, qty: number): CartItem[] {
  return items.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i));
}

export function setNote(items: CartItem[], key: string, note: string): CartItem[] {
  const clean = note.slice(0, NOTE_MAX);
  return items.map((i) => (i.key === key ? { ...i, note: clean || undefined } : i));
}

/** Tahmini toplam: birim fiyat (priceMin) × adet. Fiyatsız satırlar katılmaz. */
export function cartTotal(items: { unitPrice: number; qty: number }[]): number {
  return items.reduce((sum, i) => sum + (i.unitPrice > 0 ? i.unitPrice * i.qty : 0), 0);
}

/** Toplam adet (Navbar rozeti). */
export function cartCount(items: { qty: number }[]): number {
  return items.reduce((s, i) => s + i.qty, 0);
}

/**
 * Sepeti güncel ürün bilgisiyle eşler. Yalnızca açıkça pasif (active=false) ürünler `unavailable` olur.
 * Bilgisi gelmeyen ürün sepetteki kayıtla available kalır (sunucu talep anında zaten doğrular).
 * Güncel fiyat/ad varsa onunla değişir; artık olmayan renk temizlenir.
 */
export function reconcileCart(
  items: CartItem[],
  fresh: CartProductInfo[]
): { available: CartItem[]; unavailable: CartItem[] } {
  const map = new Map(fresh.map((p) => [p.id, p]));
  const available: CartItem[] = [];
  const unavailable: CartItem[] = [];
  for (const item of items) {
    const p = map.get(item.productId);
    if (!p) { available.push(item); continue; }
    if (!p.active) { unavailable.push(item); continue; }
    const color = item.color && p.colors.includes(item.color) ? item.color : undefined;
    available.push({
      ...item,
      title: p.title || item.title,
      unitPrice: p.unitPrice,
      image: p.image ?? item.image,
      slug: p.slug || item.slug,
      color,
    });
  }
  return { available, unavailable };
}

/** localStorage'dan okunan ham metni güvenle sepete çevirir (bozuk/eski veri çökertmez). */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: CartItem[] = [];
    for (const x of data) {
      if (!x || typeof x !== 'object') continue;
      const r = x as Record<string, unknown>;
      if (typeof r.productId !== 'string' || !r.productId || typeof r.title !== 'string') continue;
      const color = typeof r.color === 'string' && r.color.trim() ? r.color.trim().slice(0, 60) : undefined;
      const key = lineKey(r.productId, color);
      if (out.some((o) => o.key === key)) continue;
      out.push({
        key,
        productId: r.productId,
        slug: typeof r.slug === 'string' && r.slug ? r.slug : r.productId,
        title: r.title,
        unitPrice: typeof r.unitPrice === 'number' && r.unitPrice > 0 ? r.unitPrice : 0,
        image: typeof r.image === 'string' ? r.image : null,
        category: typeof r.category === 'string' ? r.category : '',
        qty: clampQty(r.qty),
        color,
        note: typeof r.note === 'string' && r.note.trim() ? r.note.slice(0, NOTE_MAX) : undefined,
      });
    }
    return out.slice(0, MAX_CART_ITEMS);
  } catch {
    return [];
  }
}

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** Talep No: kayıt id'sinin ilk 6 karakteri (admin panelinde eşleştirmek için). */
export function requestNo(id?: string): string {
  return id ? id.slice(0, 6).toUpperCase() : '';
}

export interface CartMessageInput {
  ref?: string;
  items: SepetTalebiItem[];
  total: number;
  name?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  note?: string;
}

export function buildCartWhatsAppMessage(i: CartMessageInput): string {
  const no = requestNo(i.ref);
  const lines: string[] = [no ? `*SEPET TALEBİ* (No: ${no})` : '*SEPET TALEBİ*', '', `*Ürünler (${i.items.length})*`];
  i.items.forEach((p, n) => {
    const price = p.unitPrice > 0 ? `${fmt(p.unitPrice)}₺'den başlayan` : 'fiyat sorunuz';
    lines.push(`${n + 1}) ${p.title} — ${p.qty} adet (${price})`);
    if (p.color) lines.push(`   Renk: ${p.color}`);
    if (p.note?.trim()) lines.push(`   Kişiselleştirme: ${p.note.trim()}`);
    lines.push(`   ${SITE_URL}/urun/${p.slug}`);
  });
  if (i.total > 0) lines.push('', `*Tahmini toplam:* ${fmt(i.total)}₺ (kesin fiyat WhatsApp'ta onaylanır)`);

  const contact: string[] = [];
  if (i.name?.trim()) contact.push(`Ad: ${i.name.trim()}`);
  if (i.phone?.trim()) contact.push(`Tel: ${i.phone.trim()}`);
  const place = [i.district?.trim(), i.city?.trim()].filter(Boolean).join(' / ');
  if (place) contact.push(`İl/İlçe: ${place}`);
  if (i.address?.trim()) contact.push(`Adres: ${i.address.trim()}`);
  if (contact.length) lines.push('', '*İletişim*', ...contact);
  if (i.note?.trim()) lines.push('', `*Not:* ${i.note.trim()}`);
  lines.push('', 'Kişiselleştirme fotoğrafını/tasarımını bu sohbetten göndereceğim.');
  return lines.join('\n');
}

/** Türkiye numarasını wa.me biçimine çevirir. */
export function waNumber(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return d;
}

export function customerWhatsappLink(t: { name?: string; phone?: string; id?: string }): string {
  const no = requestNo(t.id);
  const text = `Merhaba${t.name ? ` ${t.name}` : ''}, KAR-TA BASKI'dan yazıyoruz.${no ? ` ${no} numaralı` : ''} sepet talebiniz için bilgi vermek istiyoruz.`;
  return `https://wa.me/${waNumber(t.phone ?? '')}?text=${encodeURIComponent(text)}`;
}
