// Sipariş: müşteri ve yönetici tarafının ortak kuralları (server-only değil, testli).
import { z } from 'zod';
import { MAX_CART_ITEMS, MAX_QTY, PHONE_RE } from './cart-schemas';
import { SITE_URL } from './site';
import { TALEP_STATUSES, type TalepStatus } from './talep-status';
import { SIDE_LABELS } from './design-sides';

export const ORDER_FOLDER = 'karta-baski/siparisler';
export const MAX_LINE_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT = 40;
export const MAX_PROOF_IMAGES = 4;
export const MAX_PROOF_TEXT = 500;
/** Yüklemesi yarım kalan siparişler bu süre sonunda silinir. */
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
/** Tamamlanan / iptal edilen siparişlerin fotoğrafları bu süre sonunda silinir. */
export const PHOTO_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const ORDER_TOKEN_RE = /^[a-f0-9]{32}$/;
export type OrderRequestStatus = 'yukleniyor' | TalepStatus;

const trimmed = (max: number) => z.string().trim().max(max);

export const PlacementSchema = z.object({
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
  scale: z.number().min(0.1).max(5),
  rotate: z.number().min(-180).max(180),
});

/** Bir baskı yüzünün biçim alanları. */
const SideStyle = {
  text: trimmed(MAX_TEXT).optional(),
  font: z.enum(['duz', 'el']).optional(),
  placement: PlacementSchema.optional(),
  removeBg: z.boolean().optional(),
};
const LineDesign = { ...SideStyle, needsDesign: z.boolean().optional() };

const ReadyId = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/).optional();
const PhotoCount = z.number().int().min(0).max(MAX_LINE_PHOTOS);

const OrderItemInput = z
  .object({
    productId: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/, 'Geçersiz ürün'),
    qty: z.number().int().min(1).max(MAX_QTY),
    color: trimmed(60).optional(),
    note: trimmed(200).optional(),
    photoCount: PhotoCount,
    hasPreview: z.boolean(),
    readyId: ReadyId,
    ...LineDesign,
    /** Varsa baskı iki yüzedir; yukarıdaki alanlar ön yüzdür. */
    back: z.object({ ...SideStyle, photoCount: PhotoCount, readyId: ReadyId }).optional(),
  })
  .refine((i) => i.photoCount + (i.back?.photoCount ?? 0) <= MAX_LINE_PHOTOS, {
    message: `Bir üründe en fazla ${MAX_LINE_PHOTOS} fotoğraf olabilir.`,
  });

// İstemci yalnız ürün kimliği, adet, renk ve tasarım gönderir; ad ve fiyat sunucuda okunur.
export const OrderInputSchema = z.object({
  items: z
    .array(OrderItemInput)
    .min(1, 'Sepet boş')
    .max(MAX_CART_ITEMS, `En fazla ${MAX_CART_ITEMS} satır`),
  name: trimmed(80).min(2, 'Ad soyad gerekli'),
  phone: trimmed(20).regex(PHONE_RE, 'Geçerli bir telefon numarası girin'),
  city: trimmed(60).optional(),
  district: trimmed(60).optional(),
  address: trimmed(300).optional(),
  note: trimmed(500).optional(),
  kvkk: z.literal(true, { message: 'Aydınlatma metnini onaylamanız gerekiyor' }),
  website: z.string().max(0, 'Sipariş gönderilemedi. Sayfayı yenileyip tekrar deneyin.').optional(), // honeypot
});
export type OrderInput = z.infer<typeof OrderInputSchema>;

/** Özel mesajı olmayan alanlarda İngilizce metin yerine bu döner. */
export const parseOrderInput = (data: unknown) =>
  OrderInputSchema.safeParse(data, { error: () => 'Sipariş bilgileri geçersiz. Sayfayı yenileyip tekrar deneyin.' });

/** Konfigüratördeki hazır tasarım (herkese açık görsel). */
const ReadySchema = z.object({ id: z.string(), name: z.string(), image: z.string().optional() });

export const OrderLineSchema = z.object({
  productId: z.string(),
  slug: z.string(),
  title: z.string(),
  unitPrice: z.number().catch(0),
  qty: z.number().catch(1),
  color: z.string().optional(),
  note: z.string().optional(),
  ...LineDesign,
  photoCount: z.number().catch(0),
  hasPreview: z.boolean().catch(false),
  files: z.array(z.string()).catch([]),
  preview: z.string().optional(),
  ready: ReadySchema.optional(),
  back: z.object({
    ...SideStyle,
    photoCount: z.number().catch(0),
    files: z.array(z.string()).catch([]),
    ready: ReadySchema.optional(),
  }).optional(),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type ImageKind = 'photo' | 'back' | 'preview';

/** İki yüzün bütün fotoğrafları (önce ön yüz). */
export const lineFiles = (l: Pick<OrderLine, 'files' | 'back'>) => [...l.files, ...(l.back?.files ?? [])];

export const uploadsComplete = (l: Pick<OrderLine, 'files' | 'photoCount' | 'back'>) =>
  l.files.length >= l.photoCount && (!l.back || l.back.files.length >= l.back.photoCount);

export function canAddImage(l: OrderLine, kind: ImageKind): boolean {
  if (kind === 'preview') return l.hasPreview && !l.preview;
  if (kind === 'back') return Boolean(l.back && l.back.files.length < l.back.photoCount);
  return l.files.length < l.photoCount;
}

/** Ham satır kaydına yüklenen görseli ekler. */
export function appendImage(item: Record<string, unknown>, kind: ImageKind, id: string): Record<string, unknown> {
  if (kind === 'preview') return { ...item, preview: id };
  if (kind === 'photo') return { ...item, files: [...((item.files as string[]) ?? []), id] };
  const back = item.back as { files?: string[] };
  return { ...item, back: { ...back, files: [...(back.files ?? []), id] } };
}

/** Satırın baskı yüzleri; tek yüzlü baskıda ad boştur. */
export function lineSides(l: OrderLine) {
  const { text, font, placement, removeBg, ready, files, back } = l;
  return [
    { label: back ? SIDE_LABELS.front : '', text, font, placement, removeBg, ready, files },
    ...(back ? [{ ...back, label: SIDE_LABELS.back }] : []),
  ];
}

/** Üretim hattına giden satır notu. */
export function lineNote(l: OrderLine): string {
  const sides = lineSides(l).map((s) => {
    const parts = [s.ready ? `Hazır tasarım: ${s.ready.name}` : '', s.text ? `Yazı: ${s.text}` : ''].filter(Boolean).join(', ');
    if (!s.label) return parts;
    return `${s.label}: ${parts || `${s.files.length} fotoğraf`}`;
  });
  return [l.back ? 'İki yüze baskı' : '', ...sides, l.needsDesign ? 'Tasarım hazırlanacak' : '', l.note].filter(Boolean).join(' · ');
}

/** Yöneticinin gönderdiği baskı önizlemesi ve müşterinin cevabı. */
export const ProofSchema = z.object({
  round: z.number(),
  images: z.array(z.string()).catch([]),
  message: z.string().optional(),
  sentAt: z.number(),
  state: z.enum(['bekliyor', 'onaylandi', 'duzeltme']),
  reply: z.string().optional(),
  repliedAt: z.number().optional(),
});
export type Proof = z.infer<typeof ProofSchema>;

export const PROOF_LABELS: Record<Proof['state'], string> = {
  bekliyor: 'Onay bekliyor',
  onaylandi: 'Müşteri onayladı',
  duzeltme: 'Düzeltme istendi',
};

export const ProofReplySchema = z
  .object({
    round: z.number().int().min(1),
    decision: z.enum(['onaylandi', 'duzeltme']),
    reply: z.string().trim().max(MAX_PROOF_TEXT).optional(),
  })
  .refine((v) => v.decision === 'onaylandi' || Boolean(v.reply), { message: 'Neyi düzeltmemizi istediğinizi yazın.' });

export const ShippingSchema = z.object({
  carrier: trimmed(60).min(2, 'Kargo firmasını yazın'),
  trackingNo: trimmed(60).min(4, 'Takip numarasını yazın'),
  // Yalnız https: müşteri sayfasında bağlantı olarak gösterilir.
  url: trimmed(300).regex(/^https:\/\/[^\s]+$/, 'Bağlantı https:// ile başlamalı').optional(),
});
export type Shipping = z.infer<typeof ShippingSchema>;

export const OrderRequestSchema = z.object({
  token: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(['yukleniyor', ...TALEP_STATUSES]),
  items: z.array(OrderLineSchema),
  total: z.number().catch(0),
  name: z.string().catch(''),
  phone: z.string().catch(''),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
  adminNote: z.string().optional(),
  orderId: z.string().optional(),
  kvkkAt: z.number().optional(),
  photosDeletedAt: z.number().optional(),
  proof: ProofSchema.optional(),
  proofHistory: z.array(ProofSchema).optional(),
  /** Müşteri cevap verdi, yönetici henüz bakmadı. */
  attention: z.boolean().optional(),
  shipping: ShippingSchema.optional(),
  closedAt: z.number().optional(),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

/** Üretime alınmadan önce müşteri siparişini silebilir. */
export const canCustomerDelete = (status: OrderRequestStatus) =>
  status === 'yukleniyor' || status === 'yeni' || status === 'incelendi';

export const orderImageIds = (o: Pick<OrderRequest, 'items' | 'proof' | 'proofHistory'>): string[] => [
  ...o.items.flatMap((i) => [...lineFiles(i), ...(i.preview ? [i.preview] : [])]),
  ...[...(o.proofHistory ?? []), ...(o.proof ? [o.proof] : [])].flatMap((p) => p.images),
];

/** Sipariş açıkken (iptal/tamamlanmamış) bekleyen önizleme cevaplanabilir. */
export const canReplyProof = (o: Pick<OrderRequest, 'status' | 'proof'>) =>
  o.proof?.state === 'bekliyor' && o.status !== 'tamamlandi' && o.status !== 'iptal';

export const orderUrl = (token: string, base: string = SITE_URL) => `${base}/siparis/${token}`;

/** WhatsApp'a yalnızca sipariş bağlantısı gider. */
export const orderMessage = (token: string, base?: string) => `Siparişim: ${orderUrl(token, base)}`;

export const orderNo = (token: string) => token.slice(0, 6).toUpperCase();

export const orderImageUrl = (token: string, id: string, width?: 240 | 900) =>
  `/api/siparis/${token}/gorsel?id=${encodeURIComponent(id)}${width ? `&w=${width}` : '&indir=1'}`;

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length < 7 ? '***' : `${d.slice(0, 4)} *** ** ${d.slice(-2)}`;
}

/** "Ayşe Yılmaz" → "Ayşe Y." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? parts[0] ?? '' : `${parts[0]} ${parts[parts.length - 1][0].toLocaleUpperCase('tr-TR')}.`;
}

/** Bağlantı başkasına iletilebilir: müşteri sayfasına iletişim bilgisi ve iç notlar maskeli gider. */
export function customerView(o: OrderRequest) {
  const { address: _a, adminNote: _n, orderId: _o, attention: _t, ...rest } = o;
  void _a; void _n; void _o; void _t;
  return { ...rest, name: shortName(o.name), phone: maskPhone(o.phone) };
}
export type CustomerOrder = ReturnType<typeof customerView>;
