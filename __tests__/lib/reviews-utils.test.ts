import {
  ReviewInputSchema, ReviewReplySchema, hasLink, displayName, summarize, inviteState, inviteAccess,
  TOKEN_RE, stars, INVITE_TTL_MS, waPhone, inviteMessage, waLink, isAllowedReviewImage,
} from '@/lib/reviews-utils';

const ok = { name: 'Ayşe Yılmaz', rating: 5, text: 'Baskı çok net çıktı, teslimat hızlıydı.' };

describe('ReviewInputSchema', () => {
  it('geçerli girdiyi kabul eder ve boşlukları kırpar', () => {
    const r = ReviewInputSchema.safeParse({ ...ok, name: '  Ayşe  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Ayşe');
  });
  it('kısa yorumu, geçersiz puanı ve çok uzun metni reddeder', () => {
    expect(ReviewInputSchema.safeParse({ ...ok, text: 'iyi' }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, rating: 0 }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, rating: 6 }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, rating: 4.5 }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, text: 'x'.repeat(601) }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, name: 'A' }).success).toBe(false);
  });
});

describe('ReviewInputSchema fotoğraflar', () => {
  it('fotoğraf yoksa boş dizi olur', () => {
    const r = ReviewInputSchema.safeParse(ok);
    expect(r.success && r.data.images).toEqual([]);
  });
  it('yalnızca yorum klasöründeki kimlikleri kabul eder', () => {
    expect(ReviewInputSchema.safeParse({ ...ok, images: ['karta-baski/yorumlar/abc123def'] }).success).toBe(true);
    expect(ReviewInputSchema.safeParse({ ...ok, images: ['karta-baski/urunler/abc123def'] }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, images: ['karta-baski/yorumlar/../x'] }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...ok, images: ['https://evil.com/x.jpg'] }).success).toBe(false);
  });
  it('en fazla 3 fotoğraf', () => {
    const three = ['karta-baski/yorumlar/aaaaa1', 'karta-baski/yorumlar/aaaaa2', 'karta-baski/yorumlar/aaaaa3'];
    expect(ReviewInputSchema.safeParse({ ...ok, images: three }).success).toBe(true);
    expect(ReviewInputSchema.safeParse({ ...ok, images: [...three, 'karta-baski/yorumlar/aaaaa4'] }).success).toBe(false);
  });
});

describe('ReviewReplySchema', () => {
  it('boşluğu kırpar, 600 karakteri aşanı reddeder', () => {
    const r = ReviewReplySchema.safeParse('  Teşekkürler  ');
    expect(r.success && r.data).toBe('Teşekkürler');
    expect(ReviewReplySchema.safeParse('y'.repeat(601)).success).toBe(false);
  });
});

describe('hasLink', () => {
  it('bağlantı ve alan adlarını yakalar', () => {
    expect(hasLink('bkz https://spam.com/x')).toBe(true);
    expect(hasLink('www.reklam.net ziyaret edin')).toBe(true);
    expect(hasLink('bana shop.xyz den ulaşın')).toBe(true);
  });
  it('normal yorumu geçirir', () => {
    expect(hasLink('Kupa baskısı çok canlı, 3. gün elime ulaştı.')).toBe(false);
  });
});

describe('displayName', () => {
  it('soyadı baş harfe indirir', () => {
    expect(displayName('Ayşe Yılmaz')).toBe('Ayşe Y.');
    expect(displayName('  mehmet   ali   öztürk ')).toBe('mehmet A. Ö.');
    expect(displayName('İbrahim')).toBe('İbrahim');
    expect(displayName('   ')).toBe('Müşteri');
  });
});

describe('summarize', () => {
  it('ortalamayı tek ondalıkla verir, boşta 0 döner', () => {
    expect(summarize([])).toEqual({ count: 0, average: 0 });
    expect(summarize([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ count: 3, average: 4.3 });
  });
});

describe('inviteState', () => {
  const now = 1_000_000;
  it('durumları ayırır', () => {
    expect(inviteState(null, now)).toBe('missing');
    expect(inviteState({ used: true, expiresAt: now + 10 }, now)).toBe('used');
    expect(inviteState({ used: false, expiresAt: now - 1 }, now)).toBe('expired');
    expect(inviteState({ used: false }, now)).toBe('expired');
    expect(inviteState({ used: false, expiresAt: now + INVITE_TTL_MS }, now)).toBe('ok');
  });
});

it('TOKEN_RE yalnızca 32 küçük harf hex kabul eder', () => {
  expect(TOKEN_RE.test('a'.repeat(32))).toBe(true);
  expect(TOKEN_RE.test('A'.repeat(32))).toBe(false);
  expect(TOKEN_RE.test('../etc/passwd')).toBe(false);
  expect(TOKEN_RE.test('a'.repeat(31))).toBe(false);
});

it('stars', () => expect(stars(4)).toBe('★★★★☆'));

describe('inviteAccess (tek cihaz kilidi)', () => {
  const now = 1_000_000;
  const base = { used: false, expiresAt: now + 1000 };
  it('sahiplenilmemiş bağlantı', () => expect(inviteAccess(base, null, now)).toBe('unclaimed'));
  it('aynı cihaz açabilir', () => expect(inviteAccess({ ...base, deviceHash: 'h1' }, 'h1', now)).toBe('ok'));
  it('başka cihaz veya çerezsiz tarayıcı kilitli', () => {
    expect(inviteAccess({ ...base, deviceHash: 'h1' }, 'h2', now)).toBe('locked');
    expect(inviteAccess({ ...base, deviceHash: 'h1' }, null, now)).toBe('locked');
  });
  it('kullanılmış/süresi dolmuş durumu önce gelir', () => {
    expect(inviteAccess({ ...base, used: true, deviceHash: 'h1' }, 'h1', now)).toBe('used');
    expect(inviteAccess({ used: false, expiresAt: now - 1 }, null, now)).toBe('expired');
    expect(inviteAccess(null, null, now)).toBe('missing');
  });
});

describe('waPhone', () => {
  it('Türkiye cep numaralarını normalize eder', () => {
    expect(waPhone('0532 123 45 67')).toBe('905321234567');
    expect(waPhone('+90 (532) 123-45-67')).toBe('905321234567');
    expect(waPhone('5321234567')).toBe('905321234567');
  });
  it('geçersiz numarada null', () => {
    expect(waPhone('')).toBeNull();
    expect(waPhone('0212 123 45 67')).toBeNull();
    expect(waPhone('12345')).toBeNull();
  });
});

describe('davet mesajı', () => {
  it('ürün adını ve bağlantıyı içerir; genel yorumda ürün adı olmaz', () => {
    const msg = inviteMessage('Sihirli Kupa', 'https://x.com/yorum/abc');
    expect(msg).toContain('"Sihirli Kupa" için');
    expect(msg).toContain('https://x.com/yorum/abc');
    const general = inviteMessage('', 'https://x.com/yorum/abc');
    expect(general).toContain('siparişiniz için');
    expect(general).not.toContain('""');
  });
  it('WhatsApp bağlantısı kodlanır', () => {
    expect(waLink('a b', '905321234567')).toBe('https://wa.me/905321234567?text=a%20b');
    expect(waLink('a b')).toBe('https://wa.me/?text=a%20b');
  });
});

describe('isAllowedReviewImage (magic bytes)', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = new Uint8Array([...Array.from(Buffer.from('RIFF')), 0, 0, 0, 0, ...Array.from(Buffer.from('WEBP'))]);
  it('JPEG, PNG ve WebP kabul edilir', () => {
    expect(isAllowedReviewImage(jpeg)).toBe(true);
    expect(isAllowedReviewImage(png)).toBe(true);
    expect(isAllowedReviewImage(webp)).toBe(true);
  });
  it('metin veya GIF/kısa dosya reddedilir', () => {
    expect(isAllowedReviewImage(Buffer.from('<script>alert(1)</script>'))).toBe(false);
    expect(isAllowedReviewImage(Buffer.from('GIF89a..........'))).toBe(false);
    expect(isAllowedReviewImage(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});
