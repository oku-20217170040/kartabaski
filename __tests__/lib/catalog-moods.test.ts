import {
  CATALOG_MOODS,
  buildMoodsWithCounts,
  isValidMoodId,
  matchesMood,
} from '@/lib/catalog-moods';
import type { MoodId } from '@/lib/catalog-moods-types';
import { CATEGORIES, type Product } from '@/types';

const baseProduct: Product = {
  id: 'prod-1',
  title: 'Standart Kupa',
  slug: 'standart-kupa',
  priceMin: 150,
  priceMax: 250,
  category: 'Özel Tasarım',
  active: true,
  shortDesc: 'Günlük kullanım için seramik baskılı kupa.',
  description: '',
  images: [],
  deliveryDays: 3,
  createdAt: 0,
  updatedAt: 0,
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return { ...baseProduct, ...overrides };
}

describe('CATALOG_MOODS', () => {
  it('4 yaratıcı hediye koleksiyonunu beklenen sıra ve içerikle tanımlar', () => {
    expect(CATALOG_MOODS.map((m) => m.id)).toEqual([
      'sihirli',
      'kahve',
      'hediye',
      'kurumsal',
    ]);

    expect(CATALOG_MOODS[0]).toEqual({
      id: 'sihirli',
      eyebrow: 'Isıyla beliren sürpriz',
      title: 'Sihirli Kupalar',
      caption: 'Sıcak içecekle ortaya çıkan gizli fotoğraf ve mesajlar.',
      categories: ['Sihirli Kupa'],
      keywords: ['sihirli', 'ısıyla'],
    });
    expect(CATALOG_MOODS[1]).toEqual({
      id: 'kahve',
      eyebrow: 'Keyif saatleri',
      title: 'Kahve & Latte Ritüeli',
      caption: 'Türk kahvesi, filtre kahve ve latte için zarif fincanlar.',
      categories: ['Seramik Kahve Fincanı', 'Kahve Fincanı', 'Latte Fincanı'],
      keywords: ['fincan', 'latte', 'espresso', 'tabaklı'],
    });
    expect(CATALOG_MOODS[2]).toEqual({
      id: 'hediye',
      eyebrow: 'Tek adet özel üretim',
      title: 'Fotoğraflı & İsimli Hediye',
      caption: 'Sevdiklerinize isim, tarih veya anı fotoğrafıyla kalıcı hediye.',
      categories: ['Lüks Kupa', 'Özel Tasarım', 'Büyük Kupa'],
      keywords: ['hediye', 'özel', 'lüks', 'renkli', 'kalp', 'motto'],
    });
    expect(CATALOG_MOODS[3]).toEqual({
      id: 'kurumsal',
      eyebrow: '45+ adette özel fiyat',
      title: 'Ofis & Kurumsal',
      caption: 'Şirket logonuzla ekip masaları, lansman ve müşteri hediyeleri.',
      categories: ['Kurumsal', 'Pro Kupa'],
      keywords: ['kurumsal', 'logo', 'pro kupa', 'ofis', 'toplu'],
    });
  });

  it('tanımlı tüm kategoriler geçerli Category listesindedir', () => {
    for (const mood of CATALOG_MOODS) {
      for (const cat of mood.categories) {
        expect(CATEGORIES).toContain(cat);
      }
    }
  });
});

describe('isValidMoodId', () => {
  it('geçerli MoodId değerleri için true döner', () => {
    expect(isValidMoodId('sihirli')).toBe(true);
    expect(isValidMoodId('kahve')).toBe(true);
    expect(isValidMoodId('hediye')).toBe(true);
    expect(isValidMoodId('kurumsal')).toBe(true);
  });

  it('geçersiz değerler için false döner', () => {
    expect(isValidMoodId('')).toBe(false);
    expect(isValidMoodId('yok')).toBe(false);
    expect(isValidMoodId('SIHIRLI')).toBe(false);
    expect(isValidMoodId('sihirli ')).toBe(false);
    expect(isValidMoodId(null)).toBe(false);
    expect(isValidMoodId(undefined)).toBe(false);
    expect(isValidMoodId(42)).toBe(false);
    expect(isValidMoodId({})).toBe(false);
  });
});

describe('matchesMood', () => {
  it('kategori doğrudan eşleştiğinde true döner', () => {
    expect(matchesMood(makeProduct({ category: 'Sihirli Kupa' }), 'sihirli')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Seramik Kahve Fincanı' }), 'kahve')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Kahve Fincanı' }), 'kahve')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Latte Fincanı' }), 'kahve')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Lüks Kupa' }), 'hediye')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Özel Tasarım' }), 'hediye')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Büyük Kupa' }), 'hediye')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Kurumsal' }), 'kurumsal')).toBe(true);
    expect(matchesMood(makeProduct({ category: 'Pro Kupa' }), 'kurumsal')).toBe(true);
  });

  it('kategori eşleşmese de başlıkta Türkçe büyük/küçük harf duyarsız keyword varsa true döner', () => {
    const product = makeProduct({
      category: 'Özel Tasarım',
      title: 'ISIYLA Renk Değiştiren Mat Kupa',
      shortDesc: 'Sade tasarım',
    });
    expect(matchesMood(product, 'sihirli')).toBe(true);

    const corporate = makeProduct({
      category: 'Lüks Kupa',
      title: 'Şirket LOGOSU Baskılı PRO KUPA',
      shortDesc: '',
    });
    expect(matchesMood(corporate, 'kurumsal')).toBe(true);
  });

  it('kısa açıklamada keyword geçiyorsa true döner', () => {
    const product = makeProduct({
      category: 'Lüks Kupa',
      title: 'Klasik Seramik',
      shortDesc: 'Tabaklı sunuma uygun özel seri.',
    });
    expect(matchesMood(product, 'kahve')).toBe(true);
    expect(matchesMood(product, 'hediye')).toBe(true);
  });

  it('Firestore alias alanlarını (kategori, baslik, aciklama) destekler', () => {
    const aliased = {
      ...baseProduct,
      category: '',
      title: '',
      shortDesc: '',
      kategori: 'Latte Fincanı',
      baslik: 'İsimli Tasarım',
      aciklama: 'Ofis masaları için ideal.',
    } as unknown as Product;

    expect(matchesMood(aliased, 'kahve')).toBe(true);
    expect(matchesMood(aliased, 'kurumsal')).toBe(true);
  });

  it('kategori veya anahtar kelime eşleşmiyorsa false döner', () => {
    const product = makeProduct({
      category: 'Sihirli Kupa',
      title: 'Siyah Mat Kupa',
      shortDesc: 'Sade günlük kullanım.',
    });
    expect(matchesMood(product, 'kahve')).toBe(false);
    expect(matchesMood(product, 'hediye')).toBe(false);
    expect(matchesMood(product, 'kurumsal')).toBe(false);
  });

  it('başlık sonu ile kısa açıklama başı birleşiminden sahte keyword eşleşmesi üretmez', () => {
    const product = makeProduct({
      category: 'Sihirli Kupa',
      title: 'Isı',
      shortDesc: 'yla renk değiştirir',
    });
    expect(matchesMood(product, 'sihirli')).toBe(true);

    const falseCross = makeProduct({
      category: 'Kurumsal',
      title: 'Mat Isı',
      shortDesc: 'yla uyumlu',
    });
    expect(matchesMood(falseCross, 'sihirli')).toBe(false);
  });

  it('bilinmeyen moodId verildiğinde false döner', () => {
    expect(matchesMood(makeProduct(), 'bilinmeyen' as MoodId)).toBe(false);
  });
});

describe('buildMoodsWithCounts', () => {
  it('yalnızca aktif ürünleri sayar ve tüm mood metadata alanlarını korur', () => {
    const products: Product[] = [
      makeProduct({ id: '1', category: 'Sihirli Kupa', active: true }),
      makeProduct({ id: '2', category: 'Sihirli Kupa', active: false }),
      makeProduct({ id: '3', category: 'Latte Fincanı', title: 'Kalp Desenli', active: true }),
      makeProduct({ id: '4', category: 'Kurumsal', shortDesc: 'Toplu ofis siparişi', active: true }),
      { ...makeProduct({ id: '5', category: 'Pro Kupa' }), active: undefined as unknown as boolean, inStock: false } as unknown as Product,
    ];

    const result = buildMoodsWithCounts(products);

    expect(result).toHaveLength(4);
    expect(result.map((m) => ({ id: m.id, count: m.count }))).toEqual([
      { id: 'sihirli', count: 1 },
      { id: 'kahve', count: 1 },
      { id: 'hediye', count: 1 },
      { id: 'kurumsal', count: 1 },
    ]);

    expect(result[0].title).toBe('Sihirli Kupalar');
    expect(result[0].eyebrow).toBe('Isıyla beliren sürpriz');
  });

  it('boş ürün dizisinde tüm mood sayaçlarını 0 döndürür', () => {
    const result = buildMoodsWithCounts([]);
    expect(result.map((m) => m.count)).toEqual([0, 0, 0, 0]);
  });
});
