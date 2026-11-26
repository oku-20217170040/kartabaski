/**
 * @jest-environment node
 */
import {
  decodeAction, encodeAction, orderCard, parseCargo, parseCommand, pickReminders, reviewCard, sameSecret, setupCode,
  staleKeys, summaryText, webhookSecret,
} from '@/lib/bot-utils';
import { OrderRequestSchema, customerView } from '@/lib/siparis-types';
import type { Order } from '@/lib/orders-utils';
import type { Review } from '@/lib/reviews-utils';
import { DAY_MS, trTime } from '@/lib/tr-time';

const SITE = 'https://www.kartabaski.com';
const TOKEN = 'ab'.repeat(16);
const noon = trTime('2026-11-27', 12);
const line = { productId: 'p1', slug: 'pro-kupa', title: 'Pro Kupa — Kişiye Özel Baskı', unitPrice: 300, qty: 12, color: 'Yeşil', files: ['gizli/foto1'], note: 'GİZLİ ÜRÜN NOTU' };
const order = (extra: Record<string, unknown> = {}) => OrderRequestSchema.parse({
  token: TOKEN, code: 'KB7H3QMW2PXZ9', createdAt: noon, updatedAt: noon, status: 'yeni', total: 3600, name: 'Ayşe Yılmaz', phone: '0555 111 22 33',
  city: 'İzmir', district: 'Bornova', address: 'GİZLİ SOKAK No: 5', street: 'GİZLİ SOKAK', note: 'GİZLİ SİPARİŞ NOTU', items: [line], ...extra,
});
const buttons = (c: ReturnType<typeof orderCard>) => c.reply_markup!.inline_keyboard.flat();

describe('güvenlik', () => {
  it('gizli başlık ve kurulum kodu anahtara bağlı, birbirinden farklı', () => {
    expect(webhookSecret('1:a')).toMatch(/^[a-f0-9]{64}$/);
    expect(webhookSecret('1:a')).not.toBe(webhookSecret('1:b'));
    expect(setupCode('1:a')).toHaveLength(10);
    expect(webhookSecret('1:a').startsWith(setupCode('1:a'))).toBe(false);
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abd', 'abc')).toBe(false);
    expect(sameSecret('', 'abc')).toBe(false);
  });
});

describe('komut ve düğme verisi', () => {
  it('komutu, bot adını ve devamını ayırır', () => {
    expect(parseCommand('/siparis@kartabot KB7H3QMW2PXZ9 ')).toEqual({ cmd: 'siparis', args: 'KB7H3QMW2PXZ9' });
    expect(parseCommand('/Bugun')).toEqual({ cmd: 'bugun', args: '' });
    expect(parseCommand('merhaba')).toBeNull();
  });

  it('düğme verisi 64 baytı geçmez ve geri çözülür', () => {
    const actions = [
      { kind: 'claim', token: TOKEN }, { kind: 'advance', token: TOKEN, from: 'paketleme' }, { kind: 'deliver', token: TOKEN, from: 'kargoda' },
      { kind: 'review', id: 'AbCdEfGhIjKlMnOpQrSt', status: 'gizli' }, { kind: 'join', userId: '123456789012' }, { kind: 'social', platform: 'instagram', on: false },
    ] as const;
    for (const a of actions) {
      const data = encodeAction(a);
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(decodeAction(data)).toEqual(a);
    }
    for (const bad of ['', 'c', 'c:xyz', `a:${TOKEN}:uzay`, 'j:abc', 'o:instagram:2', `z:${TOKEN}`]) expect(decodeAction(bad)).toBeNull();
  });

  it('kargo komutunu çok kelimeli firmayla okur', () => {
    expect(parseCargo('kb7h3qmw2pxz9 Yurtiçi Kargo 123456 https://takip.ornek.com/123456'))
      .toEqual({ code: 'KB7H3QMW2PXZ9', shipping: { carrier: 'Yurtiçi Kargo', trackingNo: '123456', url: 'https://takip.ornek.com/123456' } });
    expect(parseCargo('KB7H3QMW2PXZ9 Aras 98765')).toMatchObject({ shipping: { carrier: 'Aras', trackingNo: '98765' } });
    expect(parseCargo('yanlis Aras 98765')).toContain('Sipariş kodu geçersiz');
    expect(parseCargo('KB7H3QMW2PXZ9 98765')).toContain('Kargo firmasını yazın');
    expect(parseCargo('KB7H3QMW2PXZ9 Aras 98765 http://acik.com')).toContain('https');
  });
});

describe('sipariş kartı', () => {
  it('özet verir; adres, not ve fotoğraf içermez', () => {
    const c = orderCard(order(), null, { site: SITE, header: 'Yeni sipariş' });
    expect(c.text).toContain('KB7H3QMW2PXZ9');
    expect(c.text).toContain('Pro Kupa × 12 (Yeşil)');
    expect(c.text).toContain('Bornova / İzmir');
    expect(JSON.stringify(c)).not.toMatch(/GİZLİ|gizli\/foto/);
    expect(buttons(c).map((b) => b.text)).toEqual(['Ben ilgileniyorum', 'Üretime aktar', 'Takip linki', 'Panelde aç', 'Yenile']);
    expect(buttons(c).find((b) => b.text === 'Takip linki')!.url).toMatch(/^https:\/\/wa\.me\/905551112233\?text=/);
  });

  it('üretimde sonraki aşamayı, pakette ayrıca kargo girişini sunar', () => {
    const o = order({ orderId: 'is1', status: 'siparis', claimedBy: 'İhsan' });
    const c = orderCard(o, { status: 'paketleme' }, { site: SITE });
    expect(c.text).toContain('İlgilenen: İhsan');
    expect(buttons(c).map((b) => b.text).slice(0, 2)).toEqual(['Kargo bilgisi gir', 'Sonraki aşama: Kargoda']);
  });

  it('kapanmış siparişte işlem düğmesi yoktur', () => {
    const c = orderCard(order({ status: 'iptal' }), null, { site: SITE });
    expect(buttons(c).map((b) => b.text)).toEqual(['Takip linki', 'Panelde aç', 'Yenile']);
  });

  it('ilgilenen adı müşteriye gönderilmez', () => {
    expect(JSON.stringify(customerView(order({ claimedBy: 'Fahrettin' })))).not.toContain('Fahrettin');
  });
});

describe('yorum, özet ve hatırlatma', () => {
  const review: Review = { id: 'r1', productId: '', productTitle: '', productSlug: '', name: 'Can', rating: 4, text: 'Güzel', images: [], status: 'bekliyor', createdAt: noon };

  it('bekleyen yorumda yayınla ve gizle vardır, değerlendirilmişte yoktur', () => {
    expect(reviewCard(review, SITE).reply_markup!.inline_keyboard[0].map((b) => b.text)).toEqual(['Yayınla', 'Gizle']);
    expect(reviewCard({ ...review, status: 'onayli' }, SITE).reply_markup!.inline_keyboard).toHaveLength(1);
  });

  it('özet geciken ve bugün teslim işleri sayar', () => {
    const job = (extra: Partial<Order>): Order => ({ id: 'j', status: 'baski', items: [{ title: 'Kupa', qty: 1, unitPrice: 1 }], channel: 'WhatsApp', createdAt: noon, dueAt: noon, customerName: 'Mehmet', ...extra });
    const text = summaryText({ orders: [order(), order({ proof: { round: 1, images: [], sentAt: noon, state: 'duzeltme' } })], jobs: [job({}), job({ dueAt: noon - 2 * DAY_MS })], pendingReviews: 3, now: noon });
    expect(text).toContain('Yeni sipariş: 2');
    expect(text).toContain('Düzeltme isteyen: 1');
    expect(text).toContain('Üretimde: 2 (Baskı 2)');
    expect(text).toContain('Geciken (1):');
    expect(text).toContain('2 gün');
    expect(text).toContain('Bugün teslim (1):');
  });

  it('dokunulmayan siparişi ve cevapsız önizlemeyi günde bir hatırlatır', () => {
    const old = order({ createdAt: noon - 4 * 3600_000 });
    const [first] = pickReminders([old], {}, noon);
    expect(first.header).toContain('kimse ilgilenmedi');
    expect(pickReminders([old], { [first.key]: noon }, noon)).toEqual([]);
    expect(pickReminders([order({ createdAt: noon - 3600_000 })], {}, noon)).toEqual([]);
    expect(pickReminders([order({ createdAt: noon - DAY_MS, claimedBy: 'Serhat' })], {}, noon)).toEqual([]);
    expect(pickReminders([old], {}, trTime('2026-11-27', 23))).toEqual([]);
    const waiting = order({ status: 'incelendi', proof: { round: 1, images: [], sentAt: noon - DAY_MS - 1, state: 'bekliyor' } });
    expect(pickReminders([waiting], {}, noon)[0].header).toContain('cevap vermedi');
    expect(staleKeys({ a: noon - 4 * DAY_MS, b: noon }, noon)).toEqual(['a']);
  });
});
