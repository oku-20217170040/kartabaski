import 'server-only';
import { adminDb } from './firebase-admin';
import { ProductSchema } from './schemas';
import { SepetTalebiSchema } from './cart-schemas';
import { cartTotal } from './cart';
import { displayTitle } from './format';
import { getActive, getPriceMin, getSlug, getTitle } from './product-utils';
import type { Product } from '@/types';
import type { CartOverview, CartProductInfo, SepetTalebi, SepetTalebiItem, SepetTalebiStatus } from './cart-types';

const CART_COL = 'sepet_talepleri';
const PRODUCTS_COL = 'products';

async function readProducts(ids: string[]): Promise<Product[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const snaps = await adminDb.getAll(...unique.map((id) => adminDb.collection(PRODUCTS_COL).doc(id)));
  const out: Product[] = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const r = ProductSchema.safeParse({ id: s.id, ...s.data() });
    if (r.success) out.push(r.data as unknown as Product);
  }
  return out;
}

/** /sepet sayfası için: yalnızca sepetteki ürünlerin güncel bilgisi (az okuma). */
export async function getCartProductInfo(ids: string[]): Promise<CartProductInfo[]> {
  const products = await readProducts(ids);
  return products.map((p) => ({
    id: p.id,
    slug: getSlug(p),
    title: displayTitle(getTitle(p)),
    unitPrice: getPriceMin(p) || 0,
    image: p.images?.[0] ?? null,
    category: p.category,
    active: getActive(p),
    colors: (p.colors ?? []).map((c) => c.name),
  }));
}

export interface RawCartLine { productId: string; qty: number; color?: string; note?: string }

/**
 * İstemcinin gönderdiği satırlardan talep anlık görüntüsünü üretir: ad/fiyat Firestore'dan gelir,
 * istemciye güvenilmez. Pasif / bulunamayan ürünler atılır; geçersiz renk silinir.
 */
export async function resolveCartLines(lines: RawCartLine[]): Promise<SepetTalebiItem[]> {
  const products = new Map((await readProducts(lines.map((l) => l.productId))).map((p) => [p.id, p]));
  const out: SepetTalebiItem[] = [];
  for (const l of lines) {
    const p = products.get(l.productId);
    if (!p || !getActive(p)) continue;
    const colorDef = l.color ? p.colors?.find((c) => c.name === l.color) : undefined;
    const item: SepetTalebiItem = {
      productId: p.id,
      slug: getSlug(p),
      title: displayTitle(getTitle(p)),
      unitPrice: getPriceMin(p) || 0,
      qty: l.qty,
      image: colorDef?.images?.[0] ?? p.images?.[0] ?? null,
    };
    if (colorDef) item.color = colorDef.name;
    if (l.note?.trim()) item.note = l.note.trim();
    out.push(item);
  }
  return out;
}

export async function saveCartRequest(
  data: Omit<SepetTalebi, 'id' | 'createdAt' | 'status' | 'total'> & { items: SepetTalebiItem[] }
): Promise<{ id: string; total: number }> {
  const total = cartTotal(data.items);
  // Firestore undefined kabul etmez; boş alanları hiç yazma
  const items = data.items.map((i) => Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined && v !== '')));
  const clean = Object.fromEntries(Object.entries({ ...data, items }).filter(([, v]) => v !== undefined && v !== ''));
  const ref = await adminDb.collection(CART_COL).add({ ...clean, total, createdAt: Date.now(), status: 'yeni' });
  return { id: ref.id, total };
}

function parseRequest(id: string, data: Record<string, unknown>): SepetTalebi | null {
  const r = SepetTalebiSchema.safeParse({ id, ...data });
  if (!r.success) {
    console.warn(`[cart-requests] Geçersiz sepet talebi (id: ${id})`);
    return null;
  }
  return r.data as SepetTalebi;
}

export async function getCartRequests(): Promise<SepetTalebi[]> {
  const snap = await adminDb.collection(CART_COL).orderBy('createdAt', 'desc').limit(300).get();
  return snap.docs.map((d) => parseRequest(d.id, d.data())).filter((t): t is SepetTalebi => t !== null);
}

export async function getCartRequest(id: string): Promise<SepetTalebi | null> {
  const s = await adminDb.collection(CART_COL).doc(id).get();
  return s.exists ? parseRequest(s.id, s.data() ?? {}) : null;
}

/** Yeni durumdaki talep sayısı — count() aggregate: tek okuma maliyeti. */
export async function countNewCartRequests(): Promise<number> {
  const snap = await adminDb.collection(CART_COL).where('status', '==', 'yeni').count().get();
  return snap.data().count;
}

export async function updateCartRequestStatus(id: string, status: SepetTalebiStatus): Promise<void> {
  await adminDb.collection(CART_COL).doc(id).update({ status });
}

export async function updateCartRequestNote(id: string, adminNote: string): Promise<void> {
  await adminDb.collection(CART_COL).doc(id).update({ adminNote });
}

export async function markCartRequestOrdered(id: string, orderId: string): Promise<void> {
  await adminDb.collection(CART_COL).doc(id).update({ status: 'siparis', orderId });
}

export async function deleteCartRequest(id: string): Promise<void> {
  await adminDb.collection(CART_COL).doc(id).delete();
}

export async function getCartOverview(): Promise<CartOverview> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const col = adminDb.collection(CART_COL);
  const [newCount, last30Snap, recentSnap] = await Promise.all([
    countNewCartRequests(),
    col.where('createdAt', '>=', since).count().get(),
    col.orderBy('createdAt', 'desc').limit(5).get(),
  ]);
  const recent = recentSnap.docs
    .map((d) => parseRequest(d.id, d.data()))
    .filter((t): t is SepetTalebi => t !== null)
    .map((t) => ({
      id: t.id as string,
      name: t.name || undefined,
      total: t.total,
      itemCount: t.items.length,
      createdAt: t.createdAt,
      status: t.status,
    }));
  return { newCount, last30: last30Snap.data().count, recent };
}
