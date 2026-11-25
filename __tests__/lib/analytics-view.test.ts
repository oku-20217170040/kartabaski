import { emptyDay } from '@/lib/analytics-stats';
import type { DailyStats } from '@/lib/analytics-types';
import { aiBreakdown, blogRows, funnel, dayRows, delta, groupSources, mergeByLabel, productRows, splitPeriods, weekdayAverages } from '@/lib/analytics-view';
import { sourceLabel, AI_SOURCES } from '@/lib/analytics-utils';

const d = (day: string, extra: Partial<DailyStats> = {}): DailyStats => ({ ...emptyDay(day), ...extra });

describe('mergeByLabel', () => {
  it('eski ham alan adlarını yeni adlarla birleştirir', () => {
    expect(mergeByLabel({ 'chatgpt.com': 2, ChatGPT: 3, Google: 5 }, sourceLabel)).toEqual({ ChatGPT: 5, Google: 5 });
  });
});

describe('splitPeriods ve delta', () => {
  const days = Array.from({ length: 14 }, (_, i) => d(`2026-10-${String(15 + i).padStart(2, '0')}`, { uv: i }));
  it('son n gün ve önceki n gün', () => {
    const { cur, prev } = splitPeriods(days, 7);
    expect(cur.map((x) => x.uv)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(prev!.map((x) => x.uv)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('yeterli veri yoksa önceki dönem null', () => {
    expect(splitPeriods(days.slice(0, 10), 7).prev).toBeNull();
  });
  it('değişim oranı; önceki 0 ise null', () => {
    expect(delta(150, 100)).toBeCloseTo(0.5);
    expect(delta(50, 100)).toBeCloseTo(-0.5);
    expect(delta(5, 0)).toBeNull();
  });
});

describe('groupSources', () => {
  it('kaynakları beş gruba toplar, boş gruplar 0', () => {
    const g = groupSources({ Google: 10, 'chatgpt.com': 2, Claude: 1, Instagram: 4, Threads: 1, Doğrudan: 7, 'ornek.com': 3 });
    expect(Object.fromEntries(g.map((x) => [x.group, x.value]))).toEqual({
      'Arama motoru': 10, 'Sosyal medya': 5, 'Yapay zeka': 3, 'Doğrudan': 7, 'Diğer siteler': 3,
    });
    expect(groupSources({}).every((x) => x.value === 0)).toBe(true);
  });
});

describe('aiBreakdown', () => {
  it('tüm yapay zeka asistanlarını listeler, gelmeyenler 0', () => {
    const r = aiBreakdown({ Claude: 2 }, { chatgpt_com: 4 });
    expect(r).toHaveLength(AI_SOURCES.length);
    expect(r[0]).toEqual({ name: 'ChatGPT', value: 4 });
    expect(r[1]).toEqual({ name: 'Claude', value: 2 });
    expect(r.find((x) => x.name === 'Gemini')!.value).toBe(0);
  });
  it('aynı oturum hem kaynakta hem utm’de varsa iki kez saymaz', () => {
    expect(aiBreakdown({ ChatGPT: 3 }, { 'chatgpt.com': 3 })[0].value).toBe(3);
  });
});

describe('weekdayAverages', () => {
  it('günlere göre ortalama ziyaretçi (2026-10-26 Pazartesi)', () => {
    const w = weekdayAverages([d('2026-10-26', { uv: 10 }), d('2026-11-02', { uv: 20 }), d('2026-10-27', { uv: 4 })]);
    expect(w[0]).toEqual({ label: 'Pazartesi', value: 15 });
    expect(w[1]).toEqual({ label: 'Salı', value: 4 });
    expect(w[6].value).toBe(0);
  });
});

describe('dayRows', () => {
  it('yeniden eskiye, en çok gelen kaynak ve etkileşimlerle', () => {
    const rows = dayRows([
      d('2026-10-27', { uv: 5, pv: 9, sess: 6, multi: 3, ref: { Google: 4, Doğrudan: 2 }, ev: { whatsapp: 1 } }),
      d('2026-10-28', { uv: 8, ref: { 'chatgpt.com': 1 } }),
    ]);
    expect(rows.map((r) => r.day)).toEqual(['2026-10-28', '2026-10-27']);
    expect(rows[0].weekday).toBe('Çarşamba');
    expect(rows[0].topSource).toBe('ChatGPT');
    expect(rows[1]).toMatchObject({ uv: 5, pv: 9, wa: 1, cart: 0, topSource: 'Google', bounce: 0.5 });
  });
});

describe('productRows', () => {
  it('ilgi oranı = (WhatsApp + sepet) / görüntüleme; tekil yoksa 0', () => {
    const s = d('t', { prod: { a: 10, b: 4 }, prodU: { a: 6 }, pwa: { a: 1 }, pcart: { a: 1, b: 2 }, prodDur: { a: 300 }, prodDurN: { a: 5 } });
    const rows = productRows(s);
    expect(rows[0]).toEqual({ slug: 'a', views: 10, unique: 6, avgSec: 60, wa: 1, cart: 1, rate: 0.2 });
    expect(rows[1]).toMatchObject({ slug: 'b', unique: 0, avgSec: 0, rate: 0.5 });
  });
});

describe('funnel / blogRows', () => {
  it('huni sırası ve blog listesi', () => {
    const s = d('t', { pv: 100, prod: { a: 30, b: 10 }, blog: { x: 5, y: 9 }, ev: { cart_add: 4, cart_send: 2, whatsapp: 7 } });
    expect(funnel(s).map((f) => f.value)).toEqual([100, 40, 4, 2, 7]);
    expect(blogRows(s)[0]).toEqual({ slug: 'y', views: 9 });
  });
});
