import type { Product } from '@/types';
import {
  toSocialRow, isShareable, hashtagsFor, hashtagCount, buildProductCaption, withPassiveNote, PASSIVE_NOTE, nthWeekday,
  activeCampaign, campaignCaption, campaignDue, pickCampaignProducts, pickBlogToShare, blogCaption, pickQueue, newArrivals,
  retryableFailures, clip, imageUrls, DAY_MS, type SocialProductRow, type BlogLite,
} from '@/lib/social-content-utils';

const row = (over: Partial<SocialProductRow> & { id: string }): SocialProductRow => ({
  title: 'Sihirli Kupa Kalp', slug: 'sihirli-kupa-kalp', category: 'Sihirli Kupa', priceMin: 150, priceMax: 250,
  shortDesc: 'Isınınca tasarım ortaya çıkar.', description: '', deliveryDays: 3, imageIds: ['karta-baski/urunler/a'],
  active: true, createdAt: 100, updatedAt: 100, ...over,
});

// 2026-11-25 12:00 TSİ
const NOW = Date.UTC(2026, 10, 25, 9, 0);

describe('toSocialRow', () => {
  it('ürünü normalleştirir, http görsellerini dışlar', () => {
    const p = {
      id: 'p1', title: 'LATTE FİNCANI — Kişiye Özel Baskı', slug: 'latte', priceMin: 120, priceMax: 0, category: 'Latte Fincanı',
      active: true, shortDesc: 'x', description: 'y', images: ['karta-baski/urunler/a', 'https://x.com/b.jpg'], deliveryDays: 4, createdAt: 5, updatedAt: 6,
    } as unknown as Product;
    const r = toSocialRow(p);
    expect(r.imageIds).toEqual(['karta-baski/urunler/a']);
    expect(r.title).toBe('Latte Fincanı');
    expect(r.priceMin).toBe(120);
    expect(isShareable(r)).toBe(true);
  });
  it('pasif ya da görselsiz ürün paylaşılamaz', () => {
    expect(isShareable(row({ id: 'a', active: false }))).toBe(false);
    expect(isShareable(row({ id: 'b', imageIds: [] }))).toBe(false);
  });
});

describe('hashtagsFor', () => {
  it('çekirdek etiketleri içerir ve sınırı aşmaz', () => {
    const t = hashtagsFor('Sihirli Kupa', 8);
    expect(t).toEqual(expect.arrayContaining(['#kişiyeözelkupa', '#kupabaskı', '#baskılıkupa', '#hediyelikkupa', '#kartabaski', '#sihirlikupa']));
    expect(t.length).toBeLessThanOrEqual(8);
    expect(new Set(t).size).toBe(t.length);
  });
  it('bilinmeyen kategoride yalnız çekirdek etiketler döner', () => {
    expect(hashtagsFor('Bilinmeyen')).toHaveLength(5);
  });
  it('hashtagCount Türkçe karakterleri sayar', () => {
    expect(hashtagCount('x #kişiyeözelkupa #kupabaskı')).toBe(2);
  });
});

describe('buildProductCaption', () => {
  const r = row({ id: 'p1' });
  it('Instagram: fiyat, teslimat, WhatsApp ve etiketler içerir; satıldı/stok izi yok', () => {
    const c = buildProductCaption(r, 'instagram', 'https://www.kartabaski.com');
    expect(c).toContain('150₺ – 250₺');
    expect(c).toContain('3 iş günü');
    expect(c).toContain('0545 826 65 08');
    expect(c).toContain('www.kartabaski.com/urun/sihirli-kupa-kalp');
    expect(c).toContain('#kartabaski');
    expect(c).not.toMatch(/stok|satıldı|ikinci el|Ümit/i);
  });
  it('Facebook: tıklanabilir tam adres', () => {
    expect(buildProductCaption(r, 'facebook', 'https://www.kartabaski.com')).toContain('https://www.kartabaski.com/urun/sihirli-kupa-kalp');
  });
  it('Threads: 500 karakteri aşmaz', () => {
    const long = row({ id: 'p2', title: 'A'.repeat(300), shortDesc: 'B'.repeat(900) });
    expect(buildProductCaption(long, 'threads').length).toBeLessThanOrEqual(500);
  });
  it('aynı ürün hep aynı açılışı alır', () => {
    expect(buildProductCaption(r, 'instagram')).toBe(buildProductCaption(r, 'instagram'));
  });
  it('fiyatsız üründe "Fiyat için yazın" der', () => {
    expect(buildProductCaption(row({ id: 'z', priceMin: 0, priceMax: 0 }), 'facebook')).toContain('Fiyat için yazın');
  });
});

describe('withPassiveNote', () => {
  it('pasifken not ekler, tekrar çağrıldığında değişmez', () => {
    const once = withPassiveNote('Açıklama', false);
    expect(once.startsWith(PASSIVE_NOTE)).toBe(true);
    expect(withPassiveNote(once, false)).toBe(once);
  });
  it('yeniden aktifken notu kaldırır', () => {
    expect(withPassiveNote(withPassiveNote('Açıklama', false), true)).toBe('Açıklama');
    expect(withPassiveNote('Açıklama', true)).toBe('Açıklama');
  });
});

describe('kampanyalar', () => {
  it('nthWeekday doğru günü verir', () => {
    expect(nthWeekday(2026, 5, 0, 2)).toBe(10); // Anneler Günü 2026
    expect(nthWeekday(2027, 5, 0, 2)).toBe(9);
    expect(nthWeekday(2026, 6, 0, 3)).toBe(21); // Babalar Günü 2026
    expect(nthWeekday(2026, 11, 5, 4)).toBe(27); // Kara Cuma 2026
  });
  it('pencere içinde en yakın kampanyayı bulur', () => {
    const ac = activeCampaign(NOW); // 25 Kasım: Kara Cuma 2 gün sonra
    expect(ac?.campaign.id).toBe('kara-cuma');
    expect(ac?.daysLeft).toBe(2);
    expect(ac?.key).toBe('kara-cuma-2026');
  });
  it('özel günün kendisinde daysLeft 0, uzak tarihte kampanya yok', () => {
    expect(activeCampaign(Date.UTC(2026, 10, 24, 9, 0))?.campaign.id).toBe('ogretmenler');
    expect(activeCampaign(Date.UTC(2026, 10, 24, 9, 0))?.daysLeft).toBe(0);
    expect(activeCampaign(Date.UTC(2026, 6, 15, 9, 0))).toBeNull(); // Temmuz ortası
  });
  it('kampanya aralığı kontrolü', () => {
    expect(campaignDue(undefined, NOW)).toBe(true);
    expect(campaignDue(NOW - DAY_MS, NOW)).toBe(false);
    expect(campaignDue(NOW - 4 * DAY_MS, NOW)).toBe(true);
  });
  it('ürünleri önerilen kategori sırasına göre seçer', () => {
    const ac = activeCampaign(Date.UTC(2026, 4, 5, 9, 0))!; // Anneler Günü yaklaşıyor
    expect(ac.campaign.id).toBe('anneler');
    const rows = [row({ id: 'a', category: 'Pro Kupa' }), row({ id: 'b', category: 'Seramik Kahve Fincanı' }), row({ id: 'c', category: 'Lüks Kupa' })];
    expect(pickCampaignProducts(rows, ac.campaign, 2).map((r) => r.id)).toEqual(['b', 'c']);
  });
  it('caption özel günü, WhatsApp ve etiketi içerir; Threads 500 karakteri aşmaz', () => {
    const ac = activeCampaign(NOW)!;
    const ig = campaignCaption(ac, [row({ id: 'a' })], 'instagram');
    expect(ig).toContain('Kara Cuma');
    expect(ig).toContain('0545 826 65 08');
    expect(ig).toContain('#kartabaski');
    expect(campaignCaption(ac, [], 'threads').length).toBeLessThanOrEqual(500);
  });
});

describe('blog paylaşımı', () => {
  const post = (over: Partial<BlogLite> & { id: string }): BlogLite => ({
    slug: `s-${over.id}`, title: 'Kupa seçerken dikkat edilecekler', excerpt: 'Kısa özet', published: true, publishedAt: 1000, ...over,
  });
  it('başlangıçtan sonra yayınlanan, paylaşılmamış en eski yazıyı seçer', () => {
    const posts = [post({ id: 'old', publishedAt: 50 }), post({ id: 'a', publishedAt: 300 }), post({ id: 'b', publishedAt: 200 }), post({ id: 'd', published: false, publishedAt: 150 })];
    expect(pickBlogToShare(posts, {}, 100)?.id).toBe('b');
    expect(pickBlogToShare(posts, { b: 1 }, 100)?.id).toBe('a');
    expect(pickBlogToShare(posts, { b: 1, a: 1 }, 100)).toBeUndefined();
  });
  it('caption bağlantıyı içerir', () => {
    expect(blogCaption(post({ id: 'x', slug: 'kupa-rehberi' }), 'facebook', 'https://www.kartabaski.com')).toContain('https://www.kartabaski.com/blog/kupa-rehberi');
    expect(blogCaption(post({ id: 'x', excerpt: 'E'.repeat(900) }), 'threads').length).toBeLessThanOrEqual(500);
  });
});

describe('kuyruk', () => {
  const rows = [row({ id: 'a', createdAt: 1 }), row({ id: 'b', createdAt: 3 }), row({ id: 'c', createdAt: 2, active: false }), row({ id: 'd', createdAt: 2, imageIds: [] })];
  it('önce paylaşılmamış aktif ve görselli ürünler, en yeni önce', () => {
    expect(pickQueue(rows, {}, NOW).map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('30 gündür paylaşılmayanlar yeniden sıraya girer, yakın zamanda paylaşılanlar girmez', () => {
    const posted = { a: { postedAt: NOW - 40 * DAY_MS, postId: 'x' }, b: { postedAt: NOW - 5 * DAY_MS, postId: 'y' } };
    expect(pickQueue(rows, posted, NOW).map((r) => r.id)).toEqual(['a']);
  });
  it('hatalı kayıtlar kuyruğa girmez', () => {
    expect(pickQueue(rows, { a: { postedAt: 1, error: 'hata' }, b: { postedAt: 1, error: 'hata' } }, NOW)).toEqual([]);
  });
  it('newArrivals yalnızca başlangıçtan sonra eklenenleri döndürür', () => {
    expect(newArrivals(rows, {}, 1).map((r) => r.id)).toEqual(['b']);
    expect(newArrivals(rows, { b: {} }, 1)).toEqual([]);
  });
  it('retryableFailures sonradan düzenlenmiş hatalı kayıtları döndürür', () => {
    const rs = [row({ id: 'a', updatedAt: 500 }), row({ id: 'b', updatedAt: 50 })];
    const posted = { a: { postedAt: 100, error: 'e' }, b: { postedAt: 100, error: 'e' } };
    expect(retryableFailures(rs, posted).map((r) => r.id)).toEqual(['a']);
  });
});

describe('yardımcılar', () => {
  it('clip uzun metni kısaltır', () => {
    expect(clip('abcdef', 4)).toBe('abc…');
    expect(clip('abc', 4)).toBe('abc');
  });
  it('imageUrls JPG Cloudinary adresleri üretir', () => {
    const u = imageUrls({ imageIds: ['a', 'b', 'c'] }, 2);
    expect(u).toHaveLength(2);
    expect(u[0]).toContain('f_jpg');
    expect(u[0]).toContain('/a');
  });
});
