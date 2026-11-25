import { buildPatch, classifyPath, classifyReferrer, isBot, istanbulParts, normalizeQuery, parseUA, sanitizeKey, unpathKey } from '@/lib/analytics-utils';
import { avgSeconds, bounceRate, dayRange, groupSeries, mergeDays, normalizeDay, returningShare, sumDays, topEntries } from '@/lib/analytics-stats';

const ctx = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari', ownHost: 'www.kartabaski.com', country: 'tr', city: 'İstanbul', hour: 14 };

describe('parseUA / isBot', () => {
  it('telefon, masaüstü, tablet ve uygulama içi tarayıcıyı ayırır', () => {
    expect(parseUA(ctx.ua)).toMatchObject({ device: 'Mobil', os: 'iOS' });
    expect(parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537').device).toBe('Masaüstü');
    expect(parseUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)').device).toBe('Tablet');
    expect(parseUA('Mozilla/5.0 (Linux; Android 13; SM-S918B) Chrome/120 Mobile Safari Instagram 300.0').browser).toBe('Instagram (uygulama içi)');
    expect(parseUA('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120').browser).toBe('Edge');
  });

  it('botları ve UA’sız istekleri eler', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(ctx.ua)).toBe(false);
  });
});

describe('classifyReferrer', () => {
  it('kaynakları sınıflar', () => {
    expect(classifyReferrer('', 'www.kartabaski.com')).toBe('Doğrudan');
    expect(classifyReferrer('https://www.google.com.tr/', 'www.kartabaski.com')).toBe('Google');
    expect(classifyReferrer('https://l.instagram.com/?u=x', 'www.kartabaski.com')).toBe('Instagram');
    expect(classifyReferrer('https://kartabaski.com/blog', 'www.kartabaski.com')).toBe('Doğrudan');
    expect(classifyReferrer('https://ornek-site.com/x', 'www.kartabaski.com')).toBe('ornek-site.com');
  });
});

describe('sanitizeKey / path', () => {
  it('Firestore için güvenli anahtar üretir', () => {
    expect(sanitizeKey('a.b/c')).toBe('a_b_c');
    expect(sanitizeKey('__x__')).toBe('x__x__');
    expect(sanitizeKey('   ')).toBe('bilinmiyor');
  });

  it('yolu ürün/kategori/sayfa/yok sayılan olarak sınıflar', () => {
    expect(classifyPath('/urun/masa-1')).toEqual({ kind: 'prod', key: 'masa-1' });
    expect(classifyPath('/kategori/masa-sandalye?x=1')).toEqual({ kind: 'cat', key: 'masa-sandalye' });
    expect(classifyPath('/admin/products').kind).toBe('skip');
    const page = classifyPath('/hakkimizda');
    expect(page.kind).toBe('page');
    expect(unpathKey(page.key)).toBe('/hakkimizda');
  });

  it('arama sorgusunu normalize eder, kısa/boşu eler', () => {
    expect(normalizeQuery('  Yemek   MASASI! ')).toBe('yemek masası');
    expect(normalizeQuery('a')).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
  });
});

describe('buildPatch', () => {
  it('oturumun ilk sayfasında oturum/cihaz/kaynak/konum yazar, ürün sayfasını sayar', () => {
    const p = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/urun/masa-1', n: 1, nv: true, nd: true, ref: 'https://www.google.com/' }, ctx) as Record<string, any>;
    expect(p.pv).toBe(1);
    expect(p.uv).toBe(1);
    expect(p.newV).toBe(1);
    expect(p.sess).toBe(1);
    expect(p.prod).toEqual({ 'masa-1': 1 });
    expect(p.hr).toEqual({ '14': 1 });
    expect(p.dev).toEqual({ Mobil: 1 });
    expect(p.ref).toEqual({ Google: 1 });
    expect(p.country).toEqual({ TR: 1 });
    expect(p.city).toEqual({ İstanbul: 1 });
  });

  it('ikinci sayfada yalnızca multi ve görüntüleme artar (oturum tekrar sayılmaz)', () => {
    const p = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/', n: 2 }, ctx) as Record<string, any>;
    expect(p.multi).toBe(1);
    expect(p.sess).toBeUndefined();
    expect(p.dev).toBeUndefined();
  });

  it('admin sayfalarını ve çok kısa süreleri saymaz', () => {
    expect(buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/admin', n: 1 }, ctx)).toEqual({});
    expect(buildPatch({ t: 'leave', vid: 'abcdefgh1', path: '/urun/x', dur: 1 }, ctx)).toEqual({});
  });

  it('süre ve etkinlikleri yazar', () => {
    const leave = buildPatch({ t: 'leave', vid: 'abcdefgh1', path: '/urun/masa-1', dur: 45, fl: true }, ctx) as Record<string, any>;
    expect(leave.dur).toBe(45);
    expect(leave.durN).toBe(1);
    expect(leave.prodDur).toEqual({ 'masa-1': 45 });
    const wa = buildPatch({ t: 'ev', vid: 'abcdefgh1', ev: 'whatsapp', src: 'hero', slug: 'masa-1' }, ctx) as Record<string, any>;
    expect(wa.ev).toEqual({ whatsapp: 1 });
    expect(wa.wasrc).toEqual({ hero: 1 });
    expect(wa.pwa).toEqual({ 'masa-1': 1 });
    expect(buildPatch({ t: 'ev', vid: 'abcdefgh1', ev: 'search', q: 'x' }, ctx)).toEqual({});
  });
});

describe('istanbulParts', () => {
  it('Türkiye saatine göre gün ve saat verir', () => {
    // 2026-01-01 22:30 UTC = 2026-01-02 01:30 İstanbul
    expect(istanbulParts(new Date('2026-01-01T22:30:00Z'))).toEqual({ day: '2026-01-02', hour: 1 });
  });
});

describe('istatistik toplama', () => {
  const a = normalizeDay('2026-01-05', { pv: 10, uv: 4, newV: 1, sess: 5, multi: 2, dur: 100, durN: 4, prod: { x: 3 }, bozuk: 'yok' });
  const b = normalizeDay('2026-01-06', { pv: 5, uv: 2, newV: 2, sess: 3, multi: 3, dur: 50, durN: 1, prod: { x: 1, y: 2 } });

  it('bozuk alanları 0/boş yapar, günleri toplar', () => {
    const s = sumDays([a, b]);
    expect(s.pv).toBe(15);
    expect(s.prod).toEqual({ x: 4, y: 2 });
    expect(mergeDays(a, b).uv).toBe(6);
  });

  it('oranları hesaplar', () => {
    const s = sumDays([a, b]);
    expect(avgSeconds(s)).toBe(30);
    expect(bounceRate(s)).toBeCloseTo(1 - 5 / 8);
    expect(returningShare(s)).toBeCloseTo((6 - 3) / 6);
    expect(bounceRate(normalizeDay('d', undefined))).toBe(0);
  });

  it('aralık ve gruplama (hafta Pazartesi başlar, ay)', () => {
    expect(dayRange('2026-03-01', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    // 2026-01-05 Pazartesi, 2026-01-11 Pazar → aynı hafta
    const days = dayRange('2026-01-11', 7).map((d) => normalizeDay(d, { pv: 1, uv: 1, sess: 1 }));
    expect(groupSeries(days, 'week')).toHaveLength(1);
    expect(groupSeries(days, 'month')).toHaveLength(1);
    expect(groupSeries(days, 'day')).toHaveLength(7);
  });

  it('en çok olanları sıralar', () => {
    expect(topEntries({ a: 1, b: 5, c: 3 }, 2)).toEqual([['b', 5], ['c', 3]]);
  });
});

describe('KAR-TA BASKI olayları', () => {
  const p = (b: object) => buildPatch({ t: 'ev', vid: 'abcdefgh1', ...b } as never, ctx) as Record<string, any>;
  it('blog yolu blog sayacına yazılır', () => {
    expect(classifyPath('/blog/kupa-bakimi')).toEqual({ kind: 'blog', key: 'kupa-bakimi' });
    const pv = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/blog/kupa-bakimi', n: 1 }, ctx) as Record<string, any>;
    expect(pv.blog).toEqual({ 'kupa-bakimi': 1 });
  });
  it('sepet, sepet gönderme, blog okuma ve filtre olayları', () => {
    expect(p({ ev: 'cart_add', slug: 'abc123' })).toEqual({ ev: { cart_add: 1 }, pcart: { abc123: 1 } });
    expect(p({ ev: 'cart_send' })).toEqual({ ev: { cart_send: 1 } });
    expect(p({ ev: 'blog_read', slug: 'x' })).toEqual({ ev: { blog_read: 1 } });
    expect(p({ ev: 'filter', q: 'Sihirli Kupa' }).flt).toEqual({ 'sihirli kupa': 1 });
    expect(p({ ev: 'search', q: 'latte', zero: true }).qz).toEqual({ latte: 1 });
  });
  it('bilinmeyen olay yok sayılır', () => {
    expect(p({ ev: 'baska' })).toEqual({});
  });
});
