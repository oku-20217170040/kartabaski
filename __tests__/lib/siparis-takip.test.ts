import { buildTracking } from '@/lib/siparis-takip';
import { OrderRequest, Proof, ProofReplySchema, ShippingSchema, canReplyProof, customerView, orderImageIds } from '@/lib/siparis-types';

const proof: Proof = { round: 1, images: ['p1'], sentAt: 200, state: 'bekliyor' };
const base = { status: 'yeni' as const, createdAt: 100 };
const states = (t: ReturnType<typeof buildTracking>) => t.steps.map((s) => s.state);

describe('sipariş çizelgesi', () => {
  it('yeni siparişte yalnız ilk adım güncel', () => {
    const t = buildTracking(base);
    expect(t.headline).toBe('Siparişiniz alındı');
    expect(states(t)).toEqual(['current', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(t.steps[0].at).toBe(100);
  });

  it('bekleyen önizleme onay adımına taşır', () => {
    const t = buildTracking({ ...base, status: 'incelendi', proof });
    expect(t.headline).toBe('Onayınızı bekliyoruz');
    expect(states(t).slice(0, 2)).toEqual(['done', 'current']);
    expect(buildTracking({ ...base, proof: { ...proof, state: 'duzeltme' } }).headline).toBe('Düzeltme isteğiniz bizde');
  });

  it('üretim aşamasını ve tarihini izler', () => {
    const t = buildTracking({ ...base, status: 'siparis', proof }, { status: 'baski', stageAt: { baski: 500 } });
    expect(t.headline).toBe('Baskı');
    expect(states(t)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo']);
    expect(t.steps[2].at).toBe(500);
  });

  it('kargo bilgisi kargoda adımına, teslim son adıma getirir', () => {
    const shipped = buildTracking({ ...base, status: 'siparis', shipping: { carrier: 'Kargo', trackingNo: '1234' } }, { status: 'baski' });
    expect(shipped.headline).toBe('Kargoda');
    expect(states(buildTracking({ ...base, status: 'siparis' }, { status: 'teslim' })).every((s) => s === 'done')).toBe(true);
    expect(buildTracking({ ...base, status: 'tamamlandi' }).headline).toBe('Teslim edildi');
  });

  it('iptal çizelgeyi kapatır', () => {
    expect(buildTracking({ ...base, status: 'iptal' }).cancelled).toBe(true);
    expect(buildTracking({ ...base, status: 'siparis' }, { status: 'iptal' }).cancelled).toBe(true);
  });
});

describe('önizleme onayı ve kargo kuralları', () => {
  it('düzeltme isteği açıklama ister', () => {
    expect(ProofReplySchema.safeParse({ round: 1, decision: 'onaylandi' }).success).toBe(true);
    expect(ProofReplySchema.safeParse({ round: 1, decision: 'duzeltme' }).success).toBe(false);
    expect(ProofReplySchema.safeParse({ round: 1, decision: 'duzeltme', reply: 'Yazıyı büyütün' }).success).toBe(true);
  });

  it('yalnız açık siparişte bekleyen önizleme cevaplanır', () => {
    expect(canReplyProof({ status: 'incelendi', proof })).toBe(true);
    expect(canReplyProof({ status: 'tamamlandi', proof })).toBe(false);
    expect(canReplyProof({ status: 'incelendi', proof: { ...proof, state: 'onaylandi' } })).toBe(false);
    expect(canReplyProof({ status: 'yeni' })).toBe(false);
  });

  it('takip bağlantısı yalnız https olabilir', () => {
    expect(ShippingSchema.safeParse({ carrier: 'Kargo', trackingNo: '1234' }).success).toBe(true);
    expect(ShippingSchema.safeParse({ carrier: 'Kargo', trackingNo: '1234', url: 'https://ornek.com/x' }).success).toBe(true);
    expect(ShippingSchema.safeParse({ carrier: 'Kargo', trackingNo: '1234', url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('önizleme görselleri siparişin görsellerine dahildir; yönetici işareti müşteriye gitmez', () => {
    const order = {
      token: 'a', createdAt: 1, updatedAt: 1, status: 'incelendi', total: 0, name: 'Ali', phone: '05551112233',
      items: [], proof: { ...proof, images: ['p2'] }, proofHistory: [proof], attention: true,
    } as unknown as OrderRequest;
    expect(orderImageIds(order)).toEqual(['p1', 'p2']);
    expect(customerView(order)).not.toHaveProperty('attention');
  });
});
