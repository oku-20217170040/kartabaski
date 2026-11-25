import {
  OCCASIONS, EVERGREEN_TOPICS, upcomingOccasions, pickNextTopic, occasionTopic, categoryTopic, keywordTopic, evergreenPool, findTopic,
} from '@/lib/blog-topics';
import { trTime, trDayKey } from '@/lib/tr-time';
import { CATEGORIES } from '@/types';

const at = (day: string, h = 12) => trTime(day, h);

describe('özel gün takvimi', () => {
  const byId = (id: string) => OCCASIONS.find((o) => o.id === id)!;

  it('sabit ve hesaplanan tarihler doğru', () => {
    expect(trDayKey(byId('sevgililer-gunu').dateOf(2027))).toBe('2027-02-14');
    expect(trDayKey(byId('ogretmenler-gunu').dateOf(2026))).toBe('2026-11-24');
    expect(trDayKey(byId('anneler-gunu').dateOf(2026))).toBe('2026-05-10'); // Mayıs ayının 2. pazarı
    expect(trDayKey(byId('babalar-gunu').dateOf(2026))).toBe('2026-06-21'); // Haziran ayının 3. pazarı
    expect(trDayKey(byId('anneler-gunu').dateOf(2027))).toBe('2027-05-09');
  });

  it('bayram tablosunda olmayan yıl için 0 döner (yanlış tarihle yazı üretilmez)', () => {
    expect(byId('ramazan-bayrami').dateOf(2026)).toBeGreaterThan(0);
    expect(byId('ramazan-bayrami').dateOf(2099)).toBe(0);
  });

  it('upcomingOccasions yakın günleri sırayla verir', () => {
    const list = upcomingOccasions(at('2026-11-10'), 60).map((o) => o.def.id);
    expect(list.slice(0, 2)).toEqual(['ogretmenler-gunu', 'yilbasi']);
    expect(list).not.toContain('anneler-gunu');
  });
});

describe('pickNextTopic', () => {
  it('Öğretmenler Günü yaklaşırken o güne yönelik yazı öne alınır (acil)', () => {
    const p = pickNextTopic(at('2026-11-10'), { usedIds: [] })!;
    expect(p.urgent).toBe(true);
    expect(p.topic.id).toBe('occ-ogretmenler-gunu-2026');
    expect(p.topic.title).toContain('Öğretmenler Günü');
  });

  it('kullanılmış özel gün atlanır; sıradaki özel gün gelir', () => {
    const p = pickNextTopic(at('2026-12-10'), { usedIds: ['occ-ogretmenler-gunu-2026'] })!;
    expect(p.topic.id).toBe('occ-yilbasi-2026');
  });

  it('gününe 4 günden az kaldıysa kargo yetişmez: özel gün yazısı üretilmez', () => {
    const p = pickNextTopic(at('2026-12-29'), { usedIds: [] })!;
    expect(p.urgent).toBe(false);
  });

  it('özel gün yoksa sabit/kategori konuları sırayla, kullanılanlar atlanarak gelir', () => {
    const now = at('2026-09-10'); // 21 gün içinde özel gün yok
    const first = pickNextTopic(now, { usedIds: [] })!;
    expect(first.urgent).toBe(false);
    const second = pickNextTopic(now, { usedIds: [first.topic.id] })!;
    expect(second.topic.id).not.toBe(first.topic.id);
  });

  it('tüm konular bitince null', () => {
    const now = at('2026-09-10');
    const all = evergreenPool(['kupa baskı fiyatları']).map((t) => t.id);
    expect(pickNextTopic(now, { usedIds: all, keywordTargets: ['kupa baskı fiyatları'] })).toBeNull();
  });

  it('anahtar kelime hedefleri havuza girer', () => {
    const ids = evergreenPool(['isimli kupa']).map((t) => t.id);
    expect(ids).toContain('kw-isimli-kupa');
  });
});

describe('konu içerikleri', () => {
  it('sabit konular kimlik bakımından tekil ve tam doldurulmuş', () => {
    const ids = EVERGREEN_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of EVERGREEN_TOPICS) {
      expect(t.title.length).toBeGreaterThan(15);
      expect(t.sections.length).toBeGreaterThanOrEqual(3);
      expect(t.faq.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('her kategori için rehber konusu var', () => {
    for (const c of CATEGORIES) expect(categoryTopic(c).categories).toEqual([c]);
  });

  it('eski/başka işletme izleri yok', () => {
    const text = JSON.stringify([EVERGREEN_TOPICS, OCCASIONS.map((o) => occasionTopic(o, 2026, 1)), CATEGORIES.map(categoryTopic), keywordTopic('x kupa')]).toLocaleLowerCase('tr-TR');
    for (const bad of ['ümit spot', 'spotçu', 'ikinci el', 'nakliye', 'sanal depo', 'mobilya']) expect(text).not.toContain(bad);
  });

  it('özel gün konusu en geç sipariş tarihini yazar', () => {
    const o = OCCASIONS.find((x) => x.id === 'sevgililer-gunu')!;
    const t = occasionTopic(o, 2027, o.dateOf(2027));
    expect(t.intro).toContain('14 Şubat');
    expect(t.faq[0].a).toContain('7 Şubat');
  });

  it('findTopic elle seçilen konuyu bulur', () => {
    expect(findTopic('sihirli-kupa-nasil-calisir', Date.now())?.title).toContain('Sihirli Kupa');
    expect(findTopic('yok', Date.now())).toBeNull();
  });
});
