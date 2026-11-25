import {
  buildAuthUrl, tiktokTitle, tiktokDescription, buildPhotoDraftBody, isAllowedMediaId, mediaIdToPath, pathToMediaId, proxyPhotoUrl,
  parseMediaPath, pendingInWindow, pendingRoom, tiktokPhotoUrls, pickRandomBacklog, shuffleBy,
  TIKTOK_TITLE_MAX, TIKTOK_DESC_MAX, TIKTOK_PENDING_CAP, TIKTOK_MAX_PHOTOS,
} from '@/lib/tiktok-utils';
import type { ChannelRow } from '@/lib/telegram-channel-utils';

const ID = 'karta-baski/urunler/abc123_X';
const HOUR = 3600 * 1000;

describe('buildAuthUrl', () => {
  it('gerekli parametreleri içerir', () => {
    const u = new URL(buildAuthUrl({ clientKey: 'KEY', redirectUri: 'https://www.kartabaski.com/api/tiktok/callback', state: 's1' }));
    expect(u.searchParams.get('client_key')).toBe('KEY');
    expect(u.searchParams.get('scope')).toBe('user.info.basic,video.upload');
    expect(u.searchParams.get('redirect_uri')).toBe('https://www.kartabaski.com/api/tiktok/callback');
    expect(u.searchParams.get('state')).toBe('s1');
  });
});

describe('tiktokTitle / tiktokDescription', () => {
  it('başlık 90 karakteri geçmez, fiyatı korur', () => {
    const t = tiktokTitle('Çok uzun bir kupa adı '.repeat(10), '150₺ – 350₺');
    expect(t.length).toBeLessThanOrEqual(TIKTOK_TITLE_MAX);
    expect(t.endsWith('150₺ – 350₺')).toBe(true);
  });
  it('açıklama sınırı aşmaz, bağlantı ve WhatsApp çağrısı kalır', () => {
    const url = 'https://www.kartabaski.com/urun/x';
    const d = tiktokDescription({ priceText: '150₺', category: 'Sihirli Kupa', description: 'a'.repeat(9000), deliveryDays: 3, url, phoneDisplay: '0545 826 65 08' });
    expect(d.length).toBeLessThanOrEqual(TIKTOK_DESC_MAX);
    expect(d).toContain(url);
    expect(d).toContain('WhatsApp ile sipariş: 0545 826 65 08');
    expect(d).toContain('#sihirlikupa');
    expect(d).not.toMatch(/Ümit|Esenyurt|nakliye/i);
  });
});

describe('buildPhotoDraftBody', () => {
  it('fotoğrafı sınırlar ve MEDIA_UPLOAD kullanır', () => {
    const photos = Array.from({ length: 50 }, (_, i) => `https://x.test/${i}.jpg`);
    const b = buildPhotoDraftBody({ title: 't', description: 'd', photoUrls: photos });
    expect(b.post_mode).toBe('MEDIA_UPLOAD');
    expect(b.source_info.photo_images).toHaveLength(TIKTOK_MAX_PHOTOS);
  });
  it('fotoğraf yoksa hata fırlatır', () => {
    expect(() => buildPhotoDraftBody({ title: 't', description: 'd', photoUrls: [] })).toThrow();
  });
});

describe('medya kimliği ve ara adres', () => {
  it('yalnızca karta-baski/urunler kimliklerini kabul eder', () => {
    expect(isAllowedMediaId(ID)).toBe(true);
    expect(isAllowedMediaId('umit-spot/urunler/abc123')).toBe(false);
    expect(isAllowedMediaId('karta-baski/urunler/../x')).toBe(false);
    expect(isAllowedMediaId('karta-baski/urunler/a')).toBe(false);
    expect(isAllowedMediaId('https://evil.test/a.jpg')).toBe(false);
  });
  it('yol dönüşümü gidiş-dönüş çalışır', () => {
    expect(pathToMediaId(`${mediaIdToPath(ID)}.jpg`)).toBe(ID);
    expect(proxyPhotoUrl('https://www.kartabaski.com/', ID)).toBe('https://www.kartabaski.com/api/tiktok/media/karta-baski~urunler~abc123_X.jpg');
  });
  it('parseMediaPath geçerli yolu çözer, geçersizi reddeder', () => {
    expect(parseMediaPath(['karta-baski~urunler~abc123_X.jpg'])).toBe(ID);
    expect(parseMediaPath(['karta-baski', 'urunler', 'abc123_X.jpg'])).toBe(ID);
    expect(parseMediaPath(['baska~klasor~abc.jpg'])).toBeNull();
    expect(parseMediaPath([])).toBeNull();
  });
  it('tiktokPhotoUrls izinsiz kimlikleri eler ve sınırlar', () => {
    const ids = [ID, 'https://x.test/a.jpg', 5, 'karta-baski/urunler/second1'];
    expect(tiktokPhotoUrls('https://www.kartabaski.com', ids)).toHaveLength(2);
    expect(tiktokPhotoUrls('https://www.kartabaski.com', ids, 1)).toHaveLength(1);
    expect(tiktokPhotoUrls('https://www.kartabaski.com', ['x'])).toEqual([]);
  });
});

describe('bekleyen taslak sınırı', () => {
  const now = 100 * HOUR;
  const posted = {
    a: { postedAt: now - 1 * HOUR, publishId: 'p1' },
    b: { postedAt: now - 30 * HOUR, publishId: 'p2' },
    c: { postedAt: now - 2 * HOUR },
    d: { postedAt: now - 3 * HOUR, publishId: 'p3' },
  };
  it('son 24 saatteki publishId kayıtlarını sayar', () => {
    expect(pendingInWindow(posted, now)).toBe(2);
    expect(pendingRoom(posted, now)).toBe(TIKTOK_PENDING_CAP - 2);
    expect(pendingRoom({}, now)).toBe(TIKTOK_PENDING_CAP);
  });
  it('doluysa 0 döner', () => {
    const full = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`k${i}`, { postedAt: now, publishId: `p${i}` }]));
    expect(pendingRoom(full, now)).toBe(0);
  });
});

describe('pickRandomBacklog / shuffleBy', () => {
  const rows: ChannelRow[] = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, createdAt: i, active: i !== 3, priceMin: 100, priceMax: 200, hasImage: i !== 4 }));
  it('aynı tohum aynı sırayı verir', () => {
    const a = pickRandomBacklog(rows, {}, 5, '2026-11-25').map((r) => r.id);
    const b = pickRandomBacklog(rows, {}, 5, '2026-11-25').map((r) => r.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });
  it('pasif, fotoğrafsız ve gönderilmiş modelleri dışlar', () => {
    const ids = pickRandomBacklog(rows, { r0: { postedAt: 1 } }, 50, 'x').map((r) => r.id);
    expect(ids).not.toContain('r3');
    expect(ids).not.toContain('r4');
    expect(ids).not.toContain('r0');
    expect(ids).toHaveLength(9);
  });
  it('shuffleBy girdiyi değiştirmez', () => {
    const src = ['a', 'b', 'c', 'd'];
    const out = shuffleBy(src, 's', (x) => x);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
    expect([...out].sort()).toEqual(src);
  });
});
