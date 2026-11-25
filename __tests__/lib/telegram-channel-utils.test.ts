import {
  pickBacklog, pickNewPosts, buildQueue, pickNewBlog, pickChannelUpdates, channelCaption, blogCaption, channelGate, channelTodayCount,
  manualGate, channelPostLink, socialHashtags, toHashtag, blogKey, CHANNEL_DAILY_LIMIT, CHANNEL_PER_RUN, CAPTION_MAX, type ChannelRow,
} from '@/lib/telegram-channel-utils';
import { trTime } from '@/lib/tr-time';

const row = (over: Partial<ChannelRow> & { id: string }): ChannelRow => ({
  createdAt: 2000, active: true, priceMin: 150, priceMax: 300, hasImage: true, ...over,
});

describe('pickNewPosts / pickBacklog / buildQueue', () => {
  it('yalnızca başlangıçtan sonra eklenen, aktif ve fotoğraflı modelleri eskiden yeniye seçer', () => {
    const rows = [
      row({ id: 'eski', createdAt: 500 }),
      row({ id: 'b', createdAt: 3000 }),
      row({ id: 'a', createdAt: 2500 }),
      row({ id: 'pasif', createdAt: 2600, active: false }),
      row({ id: 'fotosuz', createdAt: 2700, hasImage: false }),
    ];
    expect(pickNewPosts(rows, {}, 1000).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('daha önce gönderilenleri atlar ve sınırı uygular', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => row({ id: `p${n}`, createdAt: n }));
    const picked = pickNewPosts(rows, { p1: { postedAt: 1 } }, 0);
    expect(picked).toHaveLength(CHANNEL_PER_RUN);
    expect(picked[0].id).toBe('p2');
  });

  it('geriye dönük kuyruk en yeniden başlar, fiyatsız (fiyat için yazın) modeller de dahildir', () => {
    const rows = [row({ id: 'a', createdAt: 1 }), row({ id: 'b', createdAt: 9, priceMin: 0, priceMax: 0 }), row({ id: 'c', createdAt: 5 })];
    expect(pickBacklog(rows, { c: { postedAt: 1 } }, 5).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('buildQueue yenileri önce koyar, tekrar etmez ve sınırı aşmaz', () => {
    const rows = [row({ id: 'eski', createdAt: 100 }), row({ id: 'yeni', createdAt: 5000 }), row({ id: 'orta', createdAt: 300 })];
    const q = buildQueue(rows, {}, 1000, 2);
    expect(q.map((r) => r.id)).toEqual(['yeni', 'orta']);
  });
});

describe('pickNewBlog', () => {
  const post = (id: string, publishedAt: number, over = {}) => ({ id, publishedAt, hasCover: true, published: true, ...over });
  it('başlangıçtan sonra yayınlanan, kapaklı ve gönderilmemiş yazıları seçer', () => {
    const posts = [post('a', 500), post('b', 3000), post('c', 2000), post('d', 2500, { hasCover: false }), post('e', 2600, { published: false }), post('f', 2700)];
    expect(pickNewBlog(posts, { [blogKey('f')]: { postedAt: 1 } }, 1000).map((p) => p.id)).toEqual(['c', 'b']);
  });
});

describe('pickChannelUpdates', () => {
  it('pasife alınan ve fiyatı değişen modeli seçer, değişmeyeni atlar', () => {
    const rows = [row({ id: 'a', active: false }), row({ id: 'b', priceMin: 180 }), row({ id: 'c' }), row({ id: 'd', priceMax: 400 })];
    const posted = {
      a: { postedAt: 1, messageId: 9, priceMin: 150, priceMax: 300 },
      b: { postedAt: 1, messageId: 10, priceMin: 150, priceMax: 300 },
      c: { postedAt: 1, messageId: 11, priceMin: 150, priceMax: 300 },
      d: { postedAt: 1, messageId: 12, priceMin: 150, priceMax: 300 },
    };
    expect(pickChannelUpdates(rows, posted, 10)).toEqual([
      { id: 'a', reason: 'closed' },
      { id: 'b', reason: 'price' },
      { id: 'd', reason: 'price' },
    ]);
  });

  it('kapatılmış, mesajsız, silinmiş ve blog kayıtları atlanır; sınır uygulanır', () => {
    expect(pickChannelUpdates([row({ id: 'a', active: false })], { a: { postedAt: 1, messageId: 9, closed: true } }, 10)).toEqual([]);
    expect(pickChannelUpdates([row({ id: 'a', active: false })], { a: { postedAt: 1, error: 'x' } }, 10)).toEqual([]);
    expect(pickChannelUpdates([], { a: { postedAt: 1, messageId: 9 } }, 10)).toEqual([]);
    expect(pickChannelUpdates([row({ id: 'x', active: false })], { [blogKey('x')]: { postedAt: 1, messageId: 3 } }, 10)).toEqual([]);
    expect(pickChannelUpdates([row({ id: 'a', priceMin: 5 })], { a: { postedAt: 1, messageId: 9 } }, 10)).toEqual([]);
    const rows = [row({ id: 'a', active: false }), row({ id: 'b', active: false })];
    const posted = { a: { postedAt: 1, messageId: 1 }, b: { postedAt: 1, messageId: 2 } };
    expect(pickChannelUpdates(rows, posted, 1)).toHaveLength(1);
  });
});

describe('hashtag', () => {
  it('toHashtag boşluk ve noktalamayı atar', () => {
    expect(toHashtag('Büyük Kupa')).toBe('#büyükkupa');
    expect(toHashtag('!!')).toBe('');
  });
  it('socialHashtags tekrarsızdır ve sınırı uygular', () => {
    const tags = socialHashtags('Sihirli Kupa', ['#kartabaski', 'hediye']);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toContain('#sihirlikupa');
    expect(socialHashtags('Sihirli Kupa', [], 2)).toHaveLength(2);
    expect(socialHashtags('Bilinmeyen Tür')).toContain('#bilinmeyentür');
  });
});

describe('channelCaption / blogCaption', () => {
  const base = { title: 'Latte <Fincan> & Tabak', priceText: '150₺ – 350₺', category: 'Latte Fincanı', deliveryDays: 3, url: 'https://x.test/urun/a?b=1&c=2', whatsappUrl: 'https://wa.me/90?text=a&b' };
  it('HTML kaçışı yapar, fiyat, WhatsApp ve hashtag içerir', () => {
    const c = channelCaption(base);
    expect(c).toContain('Latte &lt;Fincan&gt; &amp; Tabak');
    expect(c).toContain('150₺ – 350₺');
    expect(c).toContain('href="https://wa.me/90?text=a&amp;b"');
    expect(c).toContain('#kartabaski');
    expect(c).toContain('3 iş günü');
  });
  it('pasife alınmış model "satışta değil" der, fiyat ve sipariş çağrısı içermez', () => {
    const c = channelCaption({ ...base, closed: true });
    expect(c).toContain('satışta değil');
    expect(c).not.toContain('WhatsApp ile sipariş');
    expect(c).not.toContain('SATILDI');
  });
  it('sınırı aşmaz', () => {
    expect(channelCaption({ ...base, title: 'A'.repeat(3000) }).length).toBeLessThanOrEqual(CAPTION_MAX);
    expect(blogCaption({ title: 'T', excerpt: 'B'.repeat(3000), url: 'https://x.test/blog/a' }).length).toBeLessThanOrEqual(CAPTION_MAX);
  });
  it('blog gönderisi başlık, özet ve bağlantı içerir', () => {
    const c = blogCaption({ title: 'Kupa nasıl seçilir', excerpt: 'Kısa özet', url: 'https://x.test/blog/kupa' });
    expect(c).toContain('Kupa nasıl seçilir');
    expect(c).toContain('Kısa özet');
    expect(c).toContain('https://x.test/blog/kupa');
  });
});

describe('channelPostLink', () => {
  it('@kanal ve -100 kimliklerini çözer', () => {
    expect(channelPostLink('@kartabaski', 12)).toBe('https://t.me/kartabaski/12');
    expect(channelPostLink('-1001234567', 5)).toBe('https://t.me/c/1234567/5');
    expect(channelPostLink('-12345', 5)).toBeUndefined();
    expect(channelPostLink(null, 5)).toBeUndefined();
    expect(channelPostLink('@k', undefined)).toBeUndefined();
  });
});

describe('channelGate / manualGate', () => {
  const day = '2026-11-25';
  const at = (h: number) => trTime(day, h);
  it('saat penceresi dışında reddeder, içinde kabul eder', () => {
    expect(channelGate(day, 0, at(9)).ok).toBe(false);
    expect(channelGate(day, 0, at(21)).ok).toBe(false);
    expect(channelGate(day, 0, at(11)).ok).toBe(true);
    expect(channelGate(day, 0, at(20)).ok).toBe(true);
  });
  it('günlük kota dolunca reddeder; yeni günde sıfırlanır', () => {
    expect(channelGate(day, CHANNEL_DAILY_LIMIT, at(15)).ok).toBe(false);
    expect(channelGate('2026-11-24', CHANNEL_DAILY_LIMIT, at(15)).ok).toBe(true);
    expect(channelTodayCount('2026-11-24', 7, at(15))).toBe(0);
  });
  it('manualGate saati yok sayar, kotayı sayar', () => {
    expect(manualGate(day, 0, at(3)).ok).toBe(true);
    expect(manualGate(day, CHANNEL_DAILY_LIMIT, at(3)).ok).toBe(false);
  });
});

describe('ayarlı kota ve saat penceresi', () => {
  const day = '2026-11-25';
  const cfg = { dailyLimit: 2, windowStart: 9, windowEnd: 12 };
  it('verilen ayara göre karar verir', () => {
    expect(channelGate(day, 0, trTime(day, 9), cfg).ok).toBe(true);
    expect(channelGate(day, 0, trTime(day, 12), cfg).ok).toBe(false);
    expect(channelGate(day, 2, trTime(day, 10), cfg).ok).toBe(false);
    expect(manualGate(day, 1, trTime(day, 3), cfg).ok).toBe(true);
    expect(manualGate(day, 2, trTime(day, 3), cfg).ok).toBe(false);
  });
});
