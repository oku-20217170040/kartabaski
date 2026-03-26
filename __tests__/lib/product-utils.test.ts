/**
 * product-utils.ts testleri
 *
 * Bu fonksiyonlar Firestore'dan gelen farklı alan adı varyantlarını
 * (title/baslik, priceTRY/price/fiyat vb.) normalleştirir.
 * Alias mantığının doğru çalıştığını garanti ederler.
 */

// cloudinaryThumb'u mock'luyoruz — gerçek Cloudinary çağrısı yapmasın
jest.mock('@/lib/products', () => ({
  cloudinaryThumb: (id: string) => `https://res.cloudinary.com/test/image/upload/${id}`,
}));

import {
  getTitle,
  getPrice,
  getCategory,
  getCondition,
  getInStock,
  getTags,
  getSlug,
  getImageSrc,
  getFeatured,
  getHasDelivery,
  getCreatedAt,
  getShortDesc,
  getDescription,
  getFirstImageId,
  getSpecs,
} from '@/lib/product-utils';
import { Product } from '@/types';

// Test için minimal geçerli ürün
const base: Product = {
  id: 'test-id',
  title: '',
  priceTRY: 0,
  category: '',
  condition: '',
  inStock: true,
  images: [],
};

// ── getTitle ────────────────────────────────────────────────────────────────

describe('getTitle', () => {
  it('title alanını okur', () => {
    expect(getTitle({ ...base, title: 'Koltuk Takımı' })).toBe('Koltuk Takımı');
  });

  it('baslik alias\'ını okur', () => {
    expect(getTitle({ ...base, title: '', baslik: 'Yatak Odası' } as any)).toBe('Yatak Odası');
  });

  it('hiçbir alan yoksa — döner', () => {
    expect(getTitle({ ...base, title: '' })).toBe('—');
  });
});

// ── getPrice ────────────────────────────────────────────────────────────────

describe('getPrice', () => {
  it('priceTRY alanını okur', () => {
    expect(getPrice({ ...base, priceTRY: 1500 })).toBe(1500);
  });

  it('price alias\'ını okur (priceTRY yoksa)', () => {
    expect(getPrice({ ...base, priceTRY: undefined, price: 2500 } as any)).toBe(2500);
  });

  it('fiyat alias\'ını okur (priceTRY yoksa)', () => {
    expect(getPrice({ ...base, priceTRY: undefined, fiyat: 3000 } as any)).toBe(3000);
  });

  it('hiçbir alan yoksa 0 döner', () => {
    expect(getPrice({ ...base, priceTRY: 0 })).toBe(0);
  });
});

// ── getCategory ─────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('category alanını okur', () => {
    expect(getCategory({ ...base, category: 'Mobilya' })).toBe('Mobilya');
  });

  it('kategori alias\'ını okur', () => {
    expect(getCategory({ ...base, category: '', kategori: 'Beyaz Eşya' } as any)).toBe('Beyaz Eşya');
  });

  it('alan yoksa boş string döner', () => {
    expect(getCategory({ ...base, category: '' })).toBe('');
  });
});

// ── getCondition ─────────────────────────────────────────────────────────────

describe('getCondition', () => {
  it('condition alanını okur', () => {
    expect(getCondition({ ...base, condition: 'Sıfır' })).toBe('Sıfır');
  });

  it('durum alias\'ını okur', () => {
    expect(getCondition({ ...base, condition: '', durum: '2. El' } as any)).toBe('2. El');
  });

  it('alan yoksa boş string döner', () => {
    expect(getCondition({ ...base, condition: '' })).toBe('');
  });
});

// ── getInStock ───────────────────────────────────────────────────────────────

describe('getInStock', () => {
  it('inStock true döner', () => {
    expect(getInStock({ ...base, inStock: true })).toBe(true);
  });

  it('inStock false döner', () => {
    expect(getInStock({ ...base, inStock: false })).toBe(false);
  });

  it('stok alias\'ını okur', () => {
    expect(getInStock({ ...base, inStock: undefined, stok: false } as any)).toBe(false);
  });

  it('alan yoksa varsayılan true döner', () => {
    expect(getInStock({ ...base, inStock: undefined } as any)).toBe(true);
  });
});

// ── getTags ──────────────────────────────────────────────────────────────────

describe('getTags', () => {
  it('tags dizisini döner', () => {
    expect(getTags({ ...base, tags: ['ikinci el', 'koltuk'] } as any)).toEqual(['ikinci el', 'koltuk']);
  });

  it('etiketler alias\'ını okur', () => {
    expect(getTags({ ...base, etiketler: ['mobilya'] } as any)).toEqual(['mobilya']);
  });

  it('alan yoksa boş dizi döner', () => {
    expect(getTags(base)).toEqual([]);
  });
});

// ── getSlug ──────────────────────────────────────────────────────────────────

describe('getSlug', () => {
  it('slug alanını döner', () => {
    expect(getSlug({ ...base, slug: 'koltuk-takimi' } as any)).toBe('koltuk-takimi');
  });

  it('slug yoksa id\'yi döner', () => {
    expect(getSlug({ ...base, id: 'abc123' })).toBe('abc123');
  });
});

// ── getFeatured ──────────────────────────────────────────────────────────────

describe('getFeatured', () => {
  it('featured true döner', () => {
    expect(getFeatured({ ...base, featured: true } as any)).toBe(true);
  });

  it('featured yoksa false döner', () => {
    expect(getFeatured(base)).toBe(false);
  });
});

// ── getHasDelivery ───────────────────────────────────────────────────────────

describe('getHasDelivery', () => {
  it('nakliye true döner', () => {
    expect(getHasDelivery({ ...base, nakliye: true } as any)).toBe(true);
  });

  it('delivery alias\'ını okur', () => {
    expect(getHasDelivery({ ...base, delivery: true } as any)).toBe(true);
  });

  it('alan yoksa false döner', () => {
    expect(getHasDelivery(base)).toBe(false);
  });
});

// ── getCreatedAt ─────────────────────────────────────────────────────────────

describe('getCreatedAt', () => {
  it('createdAt değerini döner', () => {
    expect(getCreatedAt({ ...base, createdAt: 1700000000000 })).toBe(1700000000000);
  });

  it('alan yoksa 0 döner', () => {
    expect(getCreatedAt(base)).toBe(0);
  });
});

// ── getImageSrc ──────────────────────────────────────────────────────────────

describe('getImageSrc', () => {
  it('images dizisinin ilk elemanını Cloudinary URL\'ine çevirir', () => {
    const src = getImageSrc({ ...base, images: ['folder/image123'] });
    expect(src).toContain('image123');
    expect(src).toContain('cloudinary');
  });

  it('images boşsa null döner', () => {
    expect(getImageSrc({ ...base, images: [] })).toBeNull();
  });

  it('http ile başlayan URL\'i olduğu gibi döner', () => {
    const url = 'https://example.com/photo.jpg';
    expect(getImageSrc({ ...base, images: [url] })).toBe(url);
  });
});

// ── getFirstImageId ──────────────────────────────────────────────────────────

describe('getFirstImageId', () => {
  it('images[0] döner', () => {
    expect(getFirstImageId({ ...base, images: ['img-abc'] })).toBe('img-abc');
  });

  it('images boşsa null döner', () => {
    expect(getFirstImageId({ ...base, images: [] })).toBeNull();
  });
});

// ── getSpecs ─────────────────────────────────────────────────────────────────

describe('getSpecs', () => {
  it('specs objesini döner', () => {
    const specs = { renk: 'Siyah', marka: 'Samsung' };
    expect(getSpecs({ ...base, specs } as any)).toEqual(specs);
  });

  it('alan yoksa boş obje döner', () => {
    expect(getSpecs(base)).toEqual({});
  });
});

// ── getShortDesc / getDescription ────────────────────────────────────────────

describe('getShortDesc', () => {
  it('shortDesc alanını döner', () => {
    expect(getShortDesc({ ...base, shortDesc: 'Kısa açıklama' } as any)).toBe('Kısa açıklama');
  });

  it('alan yoksa boş string döner', () => {
    expect(getShortDesc(base)).toBe('');
  });
});

describe('getDescription', () => {
  it('description alanını döner', () => {
    expect(getDescription({ ...base, description: 'Uzun açıklama' } as any)).toBe('Uzun açıklama');
  });

  it('alan yoksa boş string döner', () => {
    expect(getDescription(base)).toBe('');
  });
});
