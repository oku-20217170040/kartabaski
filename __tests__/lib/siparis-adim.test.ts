/** Yöneticiye gösterilen "sıradaki adım" ve baskı dosyası adı. */
import { nextStep, printFileName } from '@/lib/siparis-takip';
import { OrderRequestSchema } from '@/lib/siparis-types';

const order = (extra: Record<string, unknown> = {}) => OrderRequestSchema.parse({
  token: 'a'.repeat(32), code: 'KB7H3QMW2PXZ9', createdAt: 1, updatedAt: 1, status: 'yeni', total: 0, name: 'Ali', phone: '0555 111 22 33', items: [], ...extra,
});
const proof = (state: string) => ({ round: 1, images: [], sentAt: 2, state });

describe('nextStep', () => {
  it('yeni siparişte üretime aktarmayı önerir', () => {
    expect(nextStep(order(), null)).toMatchObject({ action: 'machine', label: 'Üretime aktar' });
  });

  it('müşteri cevabı her şeyden önce gelir', () => {
    expect(nextStep(order({ proof: proof('duzeltme') }), null).action).toBe('proof');
    expect(nextStep(order({ proof: proof('bekliyor'), orderId: 'x' }), { status: 'tasarim' }).action).toBe('remind');
    expect(nextStep(order({ proof: proof('onaylandi') }), null).action).toBe('machine');
  });

  it('üretimdeki işte sonraki aşamayı söyler', () => {
    expect(nextStep(order({ orderId: 'x', status: 'siparis' }), { status: 'tasarim' })).toMatchObject({ action: 'advance', label: 'Sonraki aşama: Baskı' });
  });

  it('paket hazırken kargo bilgisi yoksa onu ister', () => {
    const o = order({ orderId: 'x', status: 'siparis' });
    expect(nextStep(o, { status: 'paketleme' }).action).toBe('shipping');
    expect(nextStep(o, { status: 'kargoda' }).action).toBe('shipping');
    const shipped = order({ orderId: 'x', status: 'siparis', shipping: { carrier: 'Aras', trackingNo: '123456' } });
    expect(nextStep(shipped, { status: 'paketleme' }).action).toBe('advance');
    expect(nextStep(shipped, { status: 'kargoda' })).toMatchObject({ action: 'advance' });
  });

  it('kapanan ya da bağlantısı kopan siparişte eylem yoktur', () => {
    expect(nextStep(order({ status: 'iptal' }), null).action).toBe('none');
    expect(nextStep(order({ status: 'tamamlandi', proof: proof('bekliyor') }), null).action).toBe('none');
    expect(nextStep(order({ orderId: 'x', status: 'siparis' }), { status: 'teslim' }).action).toBe('none');
    expect(nextStep(order({ orderId: 'x', status: 'siparis' }), null).action).toBe('none');
  });
});

describe('printFileName', () => {
  it('kod, sıra, ürün ve yüzden dosya adı üretir', () => {
    expect(printFileName('KB7H3QMW2PXZ9', 0, 'Lüks Kupa — Özel', 'Arka yüz', false)).toBe('KB7H3QMW2PXZ9-1-luks-kupa-ozel-arka-yuz.png');
    expect(printFileName('KB7H3QMW2PXZ9', 1, 'Sihirli Kupa', '', true)).toBe('KB7H3QMW2PXZ9-2-sihirli-kupa-aynali.png');
  });
});
