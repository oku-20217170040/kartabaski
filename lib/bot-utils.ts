// Telegram botunun saf kuralları (Firebase/Next bağımlılığı yok → test edilebilir). Yalnız sunucuda kullanılır.
// Mesajlar düz metindir. Gruba açık adres, müşteri notu ve fotoğraf gönderilmez.
import { createHmac, timingSafeEqual } from 'crypto';
import { waNumber } from './cart';
import { displayTitle } from './format';
import { ORDER_STATUS_LABELS, Order, OrderStatus, isDueToday, isLate, lateDays, nextStatus, orderTitle } from './orders-utils';
import { Production, nextStep } from './siparis-takip';
import { OrderRequest, ShippingSchema, Shipping, normalizeOrderCode, orderNo, orderUrl, trackingMessage } from './siparis-types';
import { TALEP_LABELS } from './talep-status';
import type { Review } from './reviews-utils';
import { DAY_MS, trDayKey, trHour } from './tr-time';

export interface Button { text: string; callback_data?: string; url?: string }
export interface Card { text: string; reply_markup?: { inline_keyboard: Button[][] } }

// ── Güvenlik ─────────────────────────────────────────────────────────────────

const derive = (token: string, purpose: string) => createHmac('sha256', token).update(`kartabaski-${purpose}`).digest('hex');
/** Telegram'ın her istekte geri gönderdiği gizli başlık; ayrı bir ortam değişkeni gerektirmez. */
export const webhookSecret = (token: string) => derive(token, 'webhook');
/** Grubu bağlamak için bir kez yazılan kod. */
export const setupCode = (token: string) => derive(token, 'kur').slice(0, 10);

export function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Komutlar ve düğme verisi ─────────────────────────────────────────────────

export function parseCommand(text: string): { cmd: string; args: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return m ? { cmd: m[1].toLowerCase(), args: (m[2] ?? '').trim() } : null;
}

export type BotAction =
  | { kind: 'claim' | 'machine' | 'show' | 'refresh' | 'cargo'; token: string }
  | { kind: 'advance' | 'deliver'; token: string; from: OrderStatus }
  | { kind: 'review'; id: string; status: 'onayli' | 'gizli' }
  | { kind: 'join'; userId: string }
  | { kind: 'social'; platform: string; on: boolean };

const TOKEN_KINDS = { c: 'claim', m: 'machine', g: 'show', r: 'refresh', k: 'cargo' } as const;
const STEP_KINDS = { a: 'advance', t: 'deliver' } as const;

/** Telegram düğme verisi en çok 64 bayt olabilir: tek harfli tür ve kimlik. */
export function encodeAction(a: BotAction): string {
  switch (a.kind) {
    case 'claim': return `c:${a.token}`;
    case 'machine': return `m:${a.token}`;
    case 'show': return `g:${a.token}`;
    case 'refresh': return `r:${a.token}`;
    case 'cargo': return `k:${a.token}`;
    case 'advance': return `a:${a.token}:${a.from}`;
    case 'deliver': return `t:${a.token}:${a.from}`;
    case 'review': return `${a.status === 'onayli' ? 'y' : 'n'}:${a.id}`;
    case 'join': return `j:${a.userId}`;
    case 'social': return `o:${a.platform}:${a.on ? 1 : 0}`;
  }
}

export function decodeAction(data: string): BotAction | null {
  const [k, a, b] = data.split(':');
  if (!a || !/^[A-Za-z0-9_-]{1,40}$/.test(a)) return null;
  if (k === 'y' || k === 'n') return { kind: 'review', id: a, status: k === 'y' ? 'onayli' : 'gizli' };
  if (k === 'j') return /^\d+$/.test(a) ? { kind: 'join', userId: a } : null;
  if (k === 'o') return b === '0' || b === '1' ? { kind: 'social', platform: a, on: b === '1' } : null;
  if (!/^[a-f0-9]{32}$/.test(a)) return null;
  if (k in TOKEN_KINDS) return { kind: TOKEN_KINDS[k as keyof typeof TOKEN_KINDS], token: a };
  if (k in STEP_KINDS && b && b in ORDER_STATUS_LABELS) return { kind: STEP_KINDS[k as keyof typeof STEP_KINDS], token: a, from: b as OrderStatus };
  return null;
}

/** "/kargo KB… Firma TakipNo [https://…]" */
export function parseCargo(args: string): { code: string; shipping: Shipping } | string {
  const usage = 'Şöyle yazın: /kargo KBXXXXXXXXXXX Yurtiçi Kargo 1234567890';
  const words = args.split(/\s+/).filter(Boolean);
  const code = normalizeOrderCode(words.shift() ?? '');
  if (!code) return `Sipariş kodu geçersiz. ${usage}`;
  const url = /^https?:\/\//i.test(words[words.length - 1] ?? '') ? words.pop() : undefined;
  const trackingNo = words.pop() ?? '';
  const parsed = ShippingSchema.safeParse({ carrier: words.join(' '), trackingNo, ...(url ? { url } : {}) });
  return parsed.success ? { code, shipping: parsed.data } : `${parsed.error.issues[0]?.message ?? 'Kargo bilgisi eksik'}. ${usage}`;
}

// ── Mesajlar ─────────────────────────────────────────────────────────────────

const money = (n: number) => `${Math.round(n).toLocaleString('tr-TR')}₺`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const waLink = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

export interface CardOptions { site: string; header?: string; footer?: string }

/** Bir siparişin gruptaki kartı: özet, sıradaki iş ve onu yapan düğme. */
export function orderCard(order: OrderRequest, production: Production | null, { site, header, footer }: CardOptions): Card {
  const step = nextStep(order, production);
  const open = order.status !== 'tamamlandi' && order.status !== 'iptal';
  const place = [order.district, order.city].filter(Boolean).join(' / ');
  const lines = order.items.map((i, n) => {
    const extra = [i.back ? 'iki yüz' : '', i.needsDesign ? 'tasarım hazırlanacak' : '', i.note ? 'ürün notu var' : ''].filter(Boolean).join(', ');
    return `${n + 1}) ${displayTitle(i.title)} × ${i.qty}${i.color ? ` (${i.color})` : ''}${extra ? ` · ${extra}` : ''}`;
  });
  const pending = step.action === 'proof' || step.action === 'remind' ? step.title : step.action === 'shipping' ? 'Kargo bilgisi girilmedi' : '';
  const blocks = [
    [header ?? 'Sipariş', `Kod: ${orderNo(order)}`, `${order.name} · ${order.phone}`, place],
    [
      ...lines.slice(0, 12),
      lines.length > 12 ? `… ve ${lines.length - 12} kalem daha` : '',
      order.total > 0 ? `Tahmini toplam: ${money(order.total)}` : '',
    ],
    [
      production ? `Üretim aşaması: ${ORDER_STATUS_LABELS[production.status]}` : `Durum: ${TALEP_LABELS[order.status as keyof typeof TALEP_LABELS]?.label ?? order.status}`,
      pending,
      order.note ? 'Müşterinin sipariş notu var (panelde).' : '',
      order.shipping ? `Kargo: ${order.shipping.carrier} · ${order.shipping.trackingNo}` : '',
      order.claimedBy ? `İlgilenen: ${order.claimedBy}` : '',
    ],
    [footer ?? ''],
  ];
  const text = blocks.map((b) => b.filter(Boolean).join('\n')).filter(Boolean).join('\n\n');

  const token = order.token;
  const panel = `${site}/admin/siparisler/${token}`;
  const rows: Button[][] = [];
  const act = (label: string, a: BotAction): Button => ({ text: label, callback_data: encodeAction(a) });

  if (open && !order.claimedBy) rows.push([act('Ben ilgileniyorum', { kind: 'claim', token })]);
  if (step.action === 'machine') rows.push([act('Üretime aktar', { kind: 'machine', token })]);
  if (step.action === 'proof') rows.push([{ text: 'Yeni önizleme gönder', url: panel }]);
  if (step.action === 'remind') rows.push([{ text: 'Müşteriye hatırlat (WhatsApp)', url: waLink(order.phone, `Merhaba, baskı önizlemeniz hazır, onayınızı bekliyoruz: ${orderUrl(token, site)}`) }]);
  if (step.action === 'shipping') rows.push([act('Kargo bilgisi gir', { kind: 'cargo', token })]);
  const next = production && open ? nextStatus(production.status) : null;
  if (next && (step.action === 'advance' || step.action === 'shipping')) {
    rows.push([act(`Sonraki aşama: ${ORDER_STATUS_LABELS[next]}`, { kind: 'advance', token, from: production!.status })]);
  }
  rows.push([
    { text: 'Takip linki', url: waLink(order.phone, trackingMessage(order, site)) },
    { text: 'Panelde aç', url: panel },
  ]);
  rows.push([act('Yenile', { kind: 'refresh', token })]);
  return { text: clip(text, 3900), reply_markup: { inline_keyboard: rows } };
}

/** Teslim muhasebeye yazdığı için ikinci bir onay ister. */
export const deliverConfirm = (token: string, from: OrderStatus): Button[][] => [
  [{ text: 'Evet, teslim edildi', callback_data: encodeAction({ kind: 'deliver', token, from }) }],
  [{ text: 'Vazgeç', callback_data: encodeAction({ kind: 'refresh', token }) }],
];

export function reviewCard(review: Review, site: string, footer?: string): Card {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const text = [
    review.status === 'bekliyor' ? 'Yeni yorum onay bekliyor' : 'Yorum',
    `${stars} (${review.rating}/5)`,
    `Ürün: ${review.productTitle ? displayTitle(review.productTitle) : 'Genel yorum'}`,
    `Ad: ${review.name}`,
    '',
    review.text,
    review.images.length ? `\nFotoğraf: ${review.images.length} adet (yayınlamadan önce panelden bakın)` : '',
    footer ? `\n${footer}` : '',
  ].join('\n').trim();
  const panel: Button = { text: 'Panelde aç', url: `${site}/admin/yorumlar` };
  const rows: Button[][] = review.status === 'bekliyor'
    ? [[
      { text: 'Yayınla', callback_data: encodeAction({ kind: 'review', id: review.id, status: 'onayli' }) },
      { text: 'Gizle', callback_data: encodeAction({ kind: 'review', id: review.id, status: 'gizli' }) },
    ], [panel]]
    : [[panel]];
  return { text: clip(text, 3900), reply_markup: { inline_keyboard: rows } };
}

/** Açık siparişler: her biri için kartını açan bir düğme. */
export function orderList(orders: OrderRequest[]): Card {
  if (!orders.length) return { text: 'Açık sipariş yok.' };
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt);
  const shown = sorted.slice(0, 20);
  const text = [
    `Açık siparişler (${orders.length}), eskiden yeniye:`,
    '',
    ...shown.map((o) => `${orderNo(o)} · ${o.name} · ${TALEP_LABELS[o.status as keyof typeof TALEP_LABELS]?.label ?? o.status}${o.proof?.state === 'duzeltme' ? ' · düzeltme istendi' : ''}${o.claimedBy ? ` · ${o.claimedBy}` : ''}`),
    orders.length > shown.length ? `… ve ${orders.length - shown.length} sipariş daha (panelde)` : '',
  ].join('\n').trim();
  return {
    text: clip(text, 3900),
    reply_markup: { inline_keyboard: shown.map((o) => [{ text: `${o.name} · ${orderNo(o)}`, callback_data: encodeAction({ kind: 'show', token: o.token }) }]) },
  };
}

export interface SummaryInput {
  orders: OrderRequest[];
  jobs: Order[];
  pendingReviews: number;
  now: number;
}

/** Sabah özeti ve /bugun. */
export function summaryText({ orders, jobs, pendingReviews, now }: SummaryInput): string {
  const fresh = orders.filter((o) => o.status === 'yeni');
  const waiting = orders.filter((o) => o.proof?.state === 'bekliyor');
  const fix = orders.filter((o) => o.proof?.state === 'duzeltme');
  const late = jobs.filter((j) => isLate(j, now));
  const today = jobs.filter((j) => isDueToday(j, now));
  const stages = (['yeni', 'tasarim', 'baski', 'paketleme', 'kargoda'] as OrderStatus[])
    .map((s) => [s, jobs.filter((j) => j.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${ORDER_STATUS_LABELS[s]} ${n}`);
  const job = (j: Order) => `· ${j.customerName || 'Adsız'}: ${orderTitle(j)} (${ORDER_STATUS_LABELS[j.status]})`;
  return clip([
    `Günün özeti · ${trDayKey(now).split('-').reverse().join('.')}`,
    '',
    `Yeni sipariş: ${fresh.length}`,
    `Düzeltme isteyen: ${fix.length}`,
    `Onay beklenen: ${waiting.length}`,
    `Üretimde: ${jobs.length}${stages.length ? ` (${stages.join(', ')})` : ''}`,
    `Onay bekleyen yorum: ${pendingReviews}`,
    ...(late.length ? ['', `Geciken (${late.length}):`, ...late.slice(0, 10).map((j) => `${job(j)} · ${lateDays(j, now)} gün`)] : []),
    ...(today.length ? ['', `Bugün teslim (${today.length}):`, ...today.slice(0, 10).map(job)] : []),
  ].join('\n'), 3900);
}

// ── Hatırlatmalar ────────────────────────────────────────────────────────────

export const UNTOUCHED_MS = 3 * 3600_000;
export const PROOF_WAIT_MS = DAY_MS;

export interface Reminder { key: string; token: string; header: string }

/** Gündüz saatlerinde, her sipariş için günde en çok bir hatırlatma. */
export function pickReminders(orders: OrderRequest[], sent: Record<string, number>, now: number): Reminder[] {
  const hour = trHour(now);
  if (hour < 9 || hour >= 22) return [];
  const day = trDayKey(now);
  return orders.flatMap((o): Reminder[] => {
    const make = (type: string, header: string) => {
      const key = `${type}_${o.token}_${day}`;
      return sent[key] ? [] : [{ key, token: o.token, header }];
    };
    if (o.status === 'yeni' && !o.claimedBy && now - o.createdAt >= UNTOUCHED_MS) return make('yeni', 'Hatırlatma: bu siparişle henüz kimse ilgilenmedi');
    if ((o.status === 'yeni' || o.status === 'incelendi') && o.proof?.state === 'bekliyor' && now - o.proof.sentAt >= PROOF_WAIT_MS) {
      return make('onay', 'Hatırlatma: müşteri önizlemeye 1 gündür cevap vermedi');
    }
    return [];
  });
}

export const staleKeys = (sent: Record<string, number>, now: number) => Object.keys(sent).filter((k) => now - sent[k] > 3 * DAY_MS);

export const HELP_TEXT = [
  'KAR-TA BASKI yönetim botu',
  '',
  '/siparisler  Açık siparişler',
  '/siparis KOD  Bir siparişin kartı',
  '/bugun  Günün özeti',
  '/rapor  Son 7 günün üretim raporu',
  '/kargo KOD Firma TakipNo  Kargo bilgisi gir',
  '/otomasyon  Sosyal medya otomasyonlarını aç, kapat',
  '/yoneticiler  Botu kullanabilenler',
  '/katil  Yönetici olmak için onay iste',
].join('\n');
