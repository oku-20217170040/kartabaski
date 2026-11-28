import { MAX_SUMMARY, parseLayers } from './tasarim/model';
import type { CartDesign, CartItem, CartProductInfo, DesignSide } from './cart-types';
import { MAX_CART_ITEMS, MAX_QTY } from './cart-schemas';

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

/** Düzenlenen satırı yerinde değiştirir; yeni satırsa ekler. */
export function upsertLine(items: CartItem[], item: CartItem): CartItem[] {
  if (items.some((i) => i.key === item.key)) return items.map((i) => (i.key === item.key ? { ...item, qty: clampQty(item.qty) } : i));
  return addToCart(items, item);
}

/** Satırların cihazda tuttuğu dosya kimlikleri. */
export function designFileIds(items: CartItem[]): string[] {
  return items.flatMap((i) => (i.design
    ? [...i.design.photos, ...(i.design.back?.photos ?? []), ...(i.design.preview ? [i.design.preview] : [])]
    : []));
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

/** Katalogdan silinmiş ürün için sunucunun döndürdüğü kayıt. */
export function missingProductInfo(id: string): CartProductInfo {
  return { id, slug: '', title: '', unitPrice: 0, image: null, category: '', active: false, colors: [] };
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
    // Tasarımlı satırda müşterinin seçtiği renk korunur (vitrin renkleri katalogda olmayabilir).
    const color = item.color && (item.design || p.colors.includes(item.color)) ? item.color : undefined;
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

const FILE_ID = /^[A-Za-z0-9-]{1,64}$/;

const MAX_PHOTOS = 8;

function parseSide(d: Record<string, unknown>, room: number): DesignSide {
  const photos = Array.isArray(d.photos) ? d.photos.filter((p): p is string => typeof p === 'string' && FILE_ID.test(p)) : [];
  const p = d.placement as Record<string, unknown> | undefined;
  const placement = p && ['x', 'y', 'scale', 'rotate'].every((k) => typeof p[k] === 'number')
    ? { x: p.x as number, y: p.y as number, scale: p.scale as number, rotate: p.rotate as number }
    : undefined;
  const layers = parseLayers(d.layers);
  const r = d.ready as Record<string, unknown> | undefined;
  const ready = r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(r.id) && typeof r.name === 'string'
    ? { id: r.id, name: r.name.slice(0, 120), ...(typeof r.image === 'string' ? { image: r.image } : {}) }
    : undefined;
  return {
    photos: photos.slice(0, room),
    ...(ready ? { ready } : {}),
    ...(typeof d.text === 'string' && d.text.trim() ? { text: d.text.slice(0, MAX_SUMMARY) } : {}),
    ...(d.font === 'el' || d.font === 'duz' ? { font: d.font } : {}),
    ...(placement ? { placement } : {}),
    ...(d.removeBg === true ? { removeBg: true } : {}),
    // Silinen ya da sığmayan fotoğrafı gösteren katman atılır.
    ...(layers ? { layers: layers.filter((l) => l.kind !== 'photo' || (l.n < 0 ? Boolean(ready) : l.n < Math.min(photos.length, room))) } : {}),
  };
}

function parseDesign(x: unknown): CartDesign | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const d = x as Record<string, unknown>;
  const front = parseSide(d, MAX_PHOTOS);
  const back = d.back && typeof d.back === 'object'
    ? parseSide(d.back as Record<string, unknown>, MAX_PHOTOS - front.photos.length)
    : undefined;
  return {
    ...front,
    ...(back ? { back } : {}),
    ...(typeof d.preview === 'string' && FILE_ID.test(d.preview) ? { preview: d.preview } : {}),
    ...(d.needsDesign === true ? { needsDesign: true } : {}),
  };
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
      const design = parseDesign(r.design);
      const key = design && typeof r.key === 'string' && r.key.startsWith('d:') ? r.key.slice(0, 80) : lineKey(r.productId, color);
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
        design,
      });
    }
    return out.slice(0, MAX_CART_ITEMS);
  } catch {
    return [];
  }
}

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

/** Sipariş no: kayıt id'sinin ilk 6 karakteri. */
export function requestNo(id?: string): string {
  return id ? id.slice(0, 6).toUpperCase() : '';
}

/** Türkiye numarasını wa.me biçimine çevirir. */
export function waNumber(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return d;
}

export function customerWhatsappLink(t: { name?: string; phone?: string; id?: string; code?: string }): string {
  const no = t.code ?? requestNo(t.id);
  const text = `Merhaba${t.name ? ` ${t.name}` : ''}, KAR-TA BASKI'dan yazıyoruz.${no ? ` ${no} numaralı` : ''} siparişiniz için bilgi vermek istiyoruz.`;
  return `https://wa.me/${waNumber(t.phone ?? '')}?text=${encodeURIComponent(text)}`;
}
