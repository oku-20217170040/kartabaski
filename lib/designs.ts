import 'server-only';

import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { deleteCloudinaryImages, uploadToCloudinary } from './cloudinary-admin';
import { getProductBySlugServer } from './products-server';
import { displayTitle } from './format';
import { getActive, getSlug, getTitle } from './product-utils';
import { looksLikeImage } from './image-sniff';
import {
  Design, DesignInput, DesignSchema, DesignStatus,
  DESIGN_FOLDER, DESIGN_TOKEN_RE, DRAFT_TTL_MS, MAX_DESIGN_FILES, MAX_DESIGN_FILE_BYTES, canCustomerEdit,
} from './design-types';

// Firestore kuralları bu koleksiyona istemciden erişime izin vermez; yalnızca Admin SDK kullanır.
const COL = 'tasarim_talepleri';

export class DesignError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Boş alanlar Firestore'a yazılmaz (undefined kabul edilmez). */
const compact = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

function parse(token: string, data: unknown): Design | null {
  const r = DesignSchema.safeParse({ ...(data as object), token });
  if (!r.success) {
    console.warn(`[designs] Geçersiz tasarım belgesi (${token.slice(0, 6)})`);
    return null;
  }
  return r.data;
}

/** Görsel olduğunu doğrular ve Cloudinary'ye yükler. */
async function uploadImage(file: Blob): Promise<string> {
  if (file.size > MAX_DESIGN_FILE_BYTES) throw new DesignError('Fotoğraf 8 MB’dan büyük olamaz.', 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(bytes.subarray(0, 16))) throw new DesignError('Yalnızca fotoğraf yükleyebilirsiniz.');
  const type = file.type.startsWith('image/') ? file.type : 'image/jpeg';
  return uploadToCloudinary(`data:${type};base64,${bytes.toString('base64')}`, DESIGN_FOLDER);
}

async function productFor(slug: string) {
  const product = await getProductBySlugServer(slug);
  if (!product || !getActive(product)) throw new DesignError('Seçtiğiniz kupa artık satışta değil.');
  return { productSlug: getSlug(product), productTitle: displayTitle(getTitle(product)), product };
}

export async function getDesign(token: string): Promise<Design | null> {
  if (!DESIGN_TOKEN_RE.test(token)) return null;
  const snap = await adminDb.collection(COL).doc(token).get();
  return snap.exists ? parse(token, snap.data()) : null;
}

export async function createDesign(input: DesignInput, preview?: Blob | null, photo?: Blob | null): Promise<string> {
  const { productSlug, productTitle } = await productFor(input.productSlug);
  const token = randomBytes(16).toString('hex');
  const files = photo ? [await uploadImage(photo)] : [];
  const previewId = preview ? await uploadImage(preview) : undefined;
  const now = Date.now();
  await adminDb.collection(COL).doc(token).set(compact({
    ...input, productSlug, productTitle,
    preview: previewId, files, status: 'taslak', createdAt: now, updatedAt: now,
  }));
  return token;
}

async function editable(token: string): Promise<Design> {
  const design = await getDesign(token);
  if (!design) throw new DesignError('Sipariş bağlantısı bulunamadı.', 404);
  if (!canCustomerEdit(design.status)) throw new DesignError('Siparişiniz işleme alındı; değişiklik için WhatsApp’tan yazın.', 409);
  return design;
}

const ref = (token: string) => adminDb.collection(COL).doc(token);

export async function addDesignFile(token: string, file: Blob): Promise<string> {
  const design = await editable(token);
  if (design.files.length >= MAX_DESIGN_FILES) throw new DesignError(`En fazla ${MAX_DESIGN_FILES} fotoğraf ekleyebilirsiniz.`);
  const id = await uploadImage(file);
  await ref(token).update({ files: FieldValue.arrayUnion(id), updatedAt: Date.now() });
  return id;
}

export async function removeDesignFile(token: string, publicId: string): Promise<void> {
  const design = await editable(token);
  if (!design.files.includes(publicId)) throw new DesignError('Fotoğraf bulunamadı.', 404);
  await ref(token).update({ files: FieldValue.arrayRemove(publicId), updatedAt: Date.now() });
  await deleteCloudinaryImages([publicId]);
}

export async function updateDesign(token: string, patch: { note?: string; productSlug?: string; color?: string }): Promise<void> {
  const design = await editable(token);
  const next: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.productSlug !== undefined || patch.color !== undefined) {
    const { productSlug, productTitle, product } = await productFor(patch.productSlug ?? design.productSlug);
    next.productSlug = productSlug;
    next.productTitle = productTitle;
    // Renk yalnızca seçilen kupada varsa saklanır; kupa değişince eski renk silinir.
    const color = patch.color ?? (productSlug === design.productSlug ? design.color : undefined);
    const known = product.colors?.some((c) => c.name === color) || (productSlug === design.productSlug && color === design.color);
    next.color = color && known ? color : FieldValue.delete();
  }
  await ref(token).update(next);
}

/** Taslağı siparişe çevirir. İlk kez gönderiliyorsa true döner (bildirim bir kez gitsin). */
export async function submitDesign(token: string): Promise<{ design: Design; first: boolean }> {
  const design = await editable(token);
  const first = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref(token));
    if (snap.data()?.status !== 'taslak') return false;
    tx.update(ref(token), { status: 'yeni', updatedAt: Date.now() });
    return true;
  });
  return { design, first };
}

// ── Yönetici ─────────────────────────────────────────────────────────────────

export async function listDesigns(): Promise<Design[]> {
  const snap = await adminDb.collection(COL).orderBy('createdAt', 'desc').limit(200).get();
  return snap.docs.map((d) => parse(d.id, d.data())).filter((d): d is Design => d !== null);
}

export async function countNewDesigns(): Promise<number> {
  const snap = await adminDb.collection(COL).where('status', '==', 'yeni').count().get();
  return snap.data().count;
}

export async function setDesignAdmin(token: string, patch: { status?: DesignStatus; adminNote?: string }): Promise<void> {
  await ref(token).update(compactUpdate({ ...patch, updatedAt: Date.now() }));
}

const compactUpdate = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export async function deleteDesign(token: string): Promise<void> {
  const design = await getDesign(token);
  if (!design) return;
  await deleteCloudinaryImages([...design.files, ...(design.preview ? [design.preview] : [])]);
  await ref(token).delete();
}

/** Süresi geçen taslakları siler (zamanlanmış görev, tur başına sınırlı). */
export async function cleanupDraftDesigns(limit = 20): Promise<{ deleted: number }> {
  // Tek alanlı sorgu: bileşik indeks gerektirmez.
  const snap = await adminDb.collection(COL).where('createdAt', '<', Date.now() - DRAFT_TTL_MS).orderBy('createdAt', 'desc').limit(200).get();
  const drafts = snap.docs.filter((d) => d.data().status === 'taslak').slice(0, limit);
  for (const d of drafts) await deleteDesign(d.id);
  return { deleted: drafts.length };
}
