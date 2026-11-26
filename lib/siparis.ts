import 'server-only';

import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getOrder } from './orders';
import type { Production } from './siparis-takip';
import { adminDb } from './firebase-admin';
import { deletePrivate, uploadPrivate } from './cloudinary-private';
import { ProductSchema } from './schemas';
import { displayTitle } from './format';
import { cartTotal } from './cart';
import { getActive, getPriceMin, getSlug, getTitle } from './product-utils';
import { looksLikeImage } from './image-sniff';
import type { ConfiguratorCup, ConfiguratorDesign, Product } from '@/types';
import { CUP_ID_PREFIX, cupToProduct, isCupId } from './configurator-lines';
import type { CartOverview, CartProductInfo } from './cart-types';
import {
  MAX_PHOTO_BYTES, MAX_PROOF_IMAGES, ORDER_FOLDER, ORDER_TOKEN_RE, OrderInput, OrderLine, OrderRequest, OrderRequestSchema,
  PHOTO_TTL_MS, Proof, Shipping, UPLOAD_TTL_MS, canCustomerDelete, canReplyProof, orderImageIds,
} from './siparis-types';
import type { TalepStatus } from './talep-status';

// Firestore kuralları bu koleksiyona istemciden erişime izin vermez; yalnızca Admin SDK kullanır.
const COL = 'siparis_talepleri';

export class OrderError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const ref = (token: string) => adminDb.collection(COL).doc(token);

/** Boş alanlar Firestore'a yazılmaz (undefined kabul edilmez). */
const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

function parse(token: string, data: unknown): OrderRequest | null {
  const r = OrderRequestSchema.safeParse({ ...(data as object), token });
  if (!r.success) {
    console.warn(`[siparis] Geçersiz sipariş belgesi (${token.slice(0, 6)})`);
    return null;
  }
  return r.data;
}

async function readProducts(ids: string[]): Promise<Product[]> {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return [];
  const snaps = await adminDb.getAll(...unique.map((id) => (isCupId(id)
    ? adminDb.collection('configurator_cups').doc(id.slice(CUP_ID_PREFIX.length) || '-')
    : adminDb.collection('products').doc(id))));
  return snaps.flatMap((s, i) => {
    if (!s.exists) return [];
    if (isCupId(unique[i])) return [cupToProduct({ ...(s.data() as ConfiguratorCup), id: s.id })];
    const r = ProductSchema.safeParse({ id: s.id, ...s.data() });
    return r.success ? [r.data as unknown as Product] : [];
  });
}

/** Seçilen hazır tasarımlar; ad ve görsel istemciden değil Firestore'dan alınır. */
async function readDesigns(ids: string[]): Promise<Map<string, { id: string; name: string; image?: string }>> {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return new Map();
  const snaps = await adminDb.getAll(...unique.map((id) => adminDb.collection('configurator_designs').doc(id)));
  return new Map(snaps.flatMap((s) => {
    const d = s.data() as ConfiguratorDesign | undefined;
    if (!s.exists || !d?.active) return [];
    return [[s.id, { id: s.id, name: d.name, ...(d.imagePublicId ? { image: d.imagePublicId } : {}) }] as const];
  }));
}

/** /sepet sayfası için: yalnızca sepetteki ürünlerin güncel bilgisi (az okuma). */
export async function getCartProductInfo(ids: string[]): Promise<CartProductInfo[]> {
  return (await readProducts(ids)).map((p) => ({
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

/** Siparişi "yükleniyor" olarak açar. Ad ve fiyat Firestore'dan okunur. */
export async function createOrder(input: OrderInput): Promise<{ token: string; accepted: number[] }> {
  const products = new Map((await readProducts(input.items.map((i) => i.productId))).map((p) => [p.id, p]));
  const designs = await readDesigns(input.items.flatMap((i) => (i.readyId ? [i.readyId] : [])));
  const lines: Record<string, unknown>[] = [];
  const accepted: number[] = [];
  input.items.forEach(({ productId, readyId, ...line }, index) => {
    const p = products.get(productId);
    if (!p || !getActive(p)) return;
    const ready = readyId ? designs.get(readyId) : undefined;
    if (readyId && !ready) throw new OrderError(`“${displayTitle(getTitle(p))}” için seçtiğiniz hazır tasarım artık yok. Satırı sepetten çıkarıp yeniden seçin.`);
    accepted.push(index);
    lines.push(compact({
      ...line, ready, productId, slug: getSlug(p), title: displayTitle(getTitle(p)), unitPrice: getPriceMin(p) || 0, files: [],
    }));
  });
  if (!lines.length) throw new OrderError('Sepetteki ürünler artık satışta değil.');

  const token = randomBytes(16).toString('hex');
  const now = Date.now();
  const { items: _items, kvkk: _kvkk, website: _website, ...contact } = input;
  void _items; void _kvkk; void _website;
  await ref(token).set({
    ...compact(contact),
    items: lines,
    total: cartTotal(lines as unknown as OrderLine[]),
    status: 'yukleniyor', createdAt: now, updatedAt: now, kvkkAt: now,
  });
  return { token, accepted };
}

export async function getOrderRequest(token: string): Promise<OrderRequest | null> {
  if (!ORDER_TOKEN_RE.test(token)) return null;
  const snap = await ref(token).get();
  return snap.exists ? parse(token, snap.data()) : null;
}

/** Görsel olduğunu doğrulayıp kapalı depoya yükler. */
async function storeImage(file: Blob): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) throw new OrderError('Fotoğraf 8 MB’dan büyük olamaz.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(bytes.subarray(0, 16))) throw new OrderError('Yalnızca fotoğraf yükleyebilirsiniz.');
  const type = file.type.startsWith('image/') ? file.type : 'image/jpeg';
  return uploadPrivate(`data:${type};base64,${bytes.toString('base64')}`, ORDER_FOLDER);
}

/** Yükleme aşamasındaki siparişin bir satırına fotoğraf ya da önizleme ekler. */
export async function addOrderImage(token: string, line: number, kind: 'photo' | 'preview', file: Blob): Promise<void> {
  const check = (o: OrderRequest | null) => {
    if (!o) throw new OrderError('Sipariş bulunamadı.', 404);
    if (o.status !== 'yukleniyor') throw new OrderError('Bu siparişe artık fotoğraf eklenemiyor.', 409);
    const item = o.items[line];
    if (!item) throw new OrderError('Sipariş satırı bulunamadı.', 404);
    if (kind === 'photo' ? item.files.length >= item.photoCount : !item.hasPreview || item.preview) {
      throw new OrderError('Bu satır için fotoğraf sınırına ulaşıldı.', 409);
    }
  };
  check(await getOrderRequest(token));
  const id = await storeImage(file);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref(token));
      const order = snap.exists ? parse(token, snap.data()) : null;
      check(order);
      const items = (snap.data()?.items ?? []) as Record<string, unknown>[];
      const item = { ...items[line] };
      if (kind === 'photo') item.files = [...((item.files as string[]) ?? []), id];
      else item.preview = id;
      tx.update(ref(token), { items: items.map((x, i) => (i === line ? item : x)), updatedAt: Date.now() });
    });
  } catch (error) {
    await deletePrivate([id]);
    throw error;
  }
}

/** Yükleme bitti: sipariş yöneticiye düşer. İlk kez tamamlanıyorsa true. */
export async function completeOrder(token: string): Promise<{ order: OrderRequest; first: boolean }> {
  const first = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(token));
    const order = snap.exists ? parse(token, snap.data()) : null;
    if (!order) throw new OrderError('Sipariş bulunamadı.', 404);
    if (order.status !== 'yukleniyor') return false;
    if (order.items.some((i) => i.files.length < i.photoCount)) throw new OrderError('Fotoğrafların tamamı yüklenmedi. Tekrar deneyin.', 409);
    tx.update(ref(token), { status: 'yeni', updatedAt: Date.now() });
    return true;
  });
  const order = await getOrderRequest(token);
  if (!order) throw new OrderError('Sipariş bulunamadı.', 404);
  return { order, first };
}

export async function deleteOrderRequest(token: string): Promise<void> {
  const order = await getOrderRequest(token);
  if (!order) return;
  await deletePrivate(orderImageIds(order));
  await ref(token).delete();
}

export async function deleteByCustomer(token: string): Promise<OrderRequest> {
  const order = await getOrderRequest(token);
  if (!order) throw new OrderError('Sipariş bulunamadı.', 404);
  if (!canCustomerDelete(order.status)) throw new OrderError('Siparişiniz üretime alındı; iptal için WhatsApp’tan yazın.', 409);
  await deleteOrderRequest(token);
  return order;
}

// ── Yönetici ─────────────────────────────────────────────────────────────────

export async function listOrderRequests(): Promise<OrderRequest[]> {
  const snap = await adminDb.collection(COL).orderBy('createdAt', 'desc').limit(300).get();
  return snap.docs
    .map((d) => parse(d.id, d.data()))
    .filter((o): o is OrderRequest => o !== null && o.status !== 'yukleniyor');
}

export async function countNewOrderRequests(): Promise<number> {
  const snap = await adminDb.collection(COL).where('status', '==', 'yeni').count().get();
  return snap.data().count;
}

export async function getOrderRequestOverview(): Promise<CartOverview> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const col = adminDb.collection(COL);
  const [newCount, last30Snap, recentSnap] = await Promise.all([
    countNewOrderRequests(),
    col.where('createdAt', '>=', since).count().get(),
    col.orderBy('createdAt', 'desc').limit(10).get(),
  ]);
  const recent = recentSnap.docs
    .map((d) => parse(d.id, d.data()))
    .filter((o): o is OrderRequest => o !== null && o.status !== 'yukleniyor')
    .slice(0, 5)
    .map((o) => ({ id: o.token, name: o.name || undefined, total: o.total, itemCount: o.items.length, createdAt: o.createdAt, status: o.status }));
  return { newCount, last30: last30Snap.data().count, recent };
}

export async function setOrderAdmin(token: string, patch: { status?: TalepStatus; adminNote?: string; orderId?: string }): Promise<void> {
  const now = Date.now();
  // Fotoğraf saklama süresi siparişin kapandığı andan sayılır.
  const closing = patch.status === undefined ? undefined
    : patch.status === 'tamamlandi' || patch.status === 'iptal' ? now : FieldValue.delete();
  await ref(token).update(compactUpdate({ ...patch, closedAt: closing, updatedAt: now }));
}

/** Siparişin üretim hattındaki işi (aktarılmadıysa ya da silindiyse null). */
export async function getProduction(order: Pick<OrderRequest, 'orderId'>): Promise<Production | null> {
  if (!order.orderId) return null;
  const job = await getOrder(order.orderId);
  return job ? { status: job.status, stageAt: job.stageAt } : null;
}

// ── Baskı önizlemesi ve kargo ────────────────────────────────────────────────

/** Yeni önizleme gönderir; önceki tur geçmişe taşınır. */
export async function sendProof(token: string, files: Blob[], message?: string): Promise<Proof> {
  const open = (o: OrderRequest | null) => {
    if (!o || o.status === 'yukleniyor') throw new OrderError('Sipariş bulunamadı.', 404);
    if (o.status === 'tamamlandi' || o.status === 'iptal') throw new OrderError('Kapanmış siparişe önizleme gönderilemez.', 409);
  };
  open(await getOrderRequest(token));
  if (!files.length || files.length > MAX_PROOF_IMAGES) throw new OrderError(`1–${MAX_PROOF_IMAGES} görsel seçin.`);

  const images: string[] = [];
  try {
    for (const file of files) images.push(await storeImage(file));
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref(token));
      const order = snap.exists ? parse(token, snap.data()) : null;
      open(order);
      const previous = order!.proof;
      const proof: Proof = {
        round: (previous?.round ?? 0) + 1,
        images,
        sentAt: Date.now(),
        state: 'bekliyor',
        ...(message ? { message } : {}),
      };
      tx.update(ref(token), {
        proof,
        proofHistory: [...(order!.proofHistory ?? []), ...(previous ? [previous] : [])],
        attention: false,
        updatedAt: proof.sentAt,
        ...(order!.status === 'yeni' ? { status: 'incelendi' } : {}),
      });
      return proof;
    });
  } catch (error) {
    await deletePrivate(images);
    throw error;
  }
}

/** Müşterinin onayı ya da düzeltme isteği. Tur numarası eski bir önizlemenin onaylanmasını engeller. */
export async function replyProof(
  token: string,
  round: number,
  decision: 'onaylandi' | 'duzeltme',
  reply?: string,
): Promise<{ order: OrderRequest; proof: Proof }> {
  if (!ORDER_TOKEN_RE.test(token)) throw new OrderError('Sipariş bulunamadı.', 404);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(token));
    const order = snap.exists ? parse(token, snap.data()) : null;
    if (!order) throw new OrderError('Sipariş bulunamadı.', 404);
    if (!canReplyProof(order) || order.proof!.round !== round) {
      throw new OrderError('Bu önizleme artık geçerli değil. Sayfayı yenileyin.', 409);
    }
    const proof: Proof = { ...order.proof!, state: decision, repliedAt: Date.now(), ...(reply ? { reply } : {}) };
    tx.update(ref(token), { proof, attention: true, updatedAt: proof.repliedAt });
    return { order, proof };
  });
}

export async function markOrderSeen(token: string): Promise<void> {
  await ref(token).update({ attention: false });
}

export async function setShipping(token: string, shipping: Shipping | null): Promise<void> {
  await ref(token).update({ shipping: shipping ? compact(shipping) : FieldValue.delete(), updatedAt: Date.now() });
}

export async function countRepliedOrders(): Promise<number> {
  const snap = await adminDb.collection(COL).where('attention', '==', true).count().get();
  return snap.data().count;
}

/** Üretim hattında teslim/iptal edilen işlerin siparişi de kapanır (saklama süresi buradan başlar). */
export async function syncClosedOrders(limit = 100): Promise<{ closed: number }> {
  const snap = await adminDb.collection(COL).where('status', '==', 'siparis').limit(limit).get();
  let closed = 0;
  for (const d of snap.docs) {
    const production = await getProduction({ orderId: d.data().orderId });
    if (production?.status !== 'teslim' && production?.status !== 'iptal') continue;
    await setOrderAdmin(d.id, { status: production.status === 'teslim' ? 'tamamlandi' : 'iptal' });
    closed += 1;
  }
  return { closed };
}

const compactUpdate = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Zamanlanmış temizlik: yarım yüklemeler silinir; bitmiş siparişlerin fotoğrafları 30 gün sonra kaldırılır. */
export async function cleanupOrderRequests(limit = 20): Promise<{ abandoned: number; purged: number }> {
  const col = adminDb.collection(COL);
  const now = Date.now();
  // Tek alanlı sorgular: bileşik indeks gerektirmez.
  const [uploading, closed] = await Promise.all([
    col.where('status', '==', 'yukleniyor').limit(100).get(),
    col.where('status', 'in', ['tamamlandi', 'iptal']).limit(300).get(),
  ]);
  const abandoned = uploading.docs.filter((d) => d.data().createdAt < now - UPLOAD_TTL_MS).slice(0, limit);
  for (const d of abandoned) await deleteOrderRequest(d.id);

  const stale = closed.docs
    .filter((d) => !d.data().photosDeletedAt && (d.data().closedAt ?? d.data().updatedAt) < now - PHOTO_TTL_MS)
    .slice(0, limit);
  for (const d of stale) {
    const order = parse(d.id, d.data());
    if (!order) continue;
    await deletePrivate(orderImageIds(order));
    const items = (d.data().items as Record<string, unknown>[]).map(({ preview: _p, ...i }) => ({ ...i, files: [] }));
    const blank = (p: Proof) => ({ ...p, images: [] });
    await ref(d.id).update(compactUpdate({
      items,
      proof: order.proof ? blank(order.proof) : undefined,
      proofHistory: order.proofHistory?.map(blank),
      photosDeletedAt: now,
    }));
  }
  return { abandoned: abandoned.length, purged: stale.length };
}
