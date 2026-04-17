/**
 * product-utils.ts testleri — KAR-TA BASKI
 *
 * Bu fonksiyonlar Firestore'dan gelen farklı alan adı varyantlarını normalleştirir.
 */

// cloudinaryThumb'u mock'luyoruz
jest.mock('@/lib/products', () => ({
  cloudinaryThumb: (id: string) => `https://res.cloudinary.com/test/image/upload/${id}`,
}));

import {
  getTitle,
  getPrice,
  getPriceMin,
  getPriceMax,
  getCategory,
  getActive,
  getInStock,
  getDeliveryDays,
  getSlug,
  getImageSrc,
  getFeatured,
  getCreatedAt,
  getShortDesc,
  getDescription,
  getFirstImageId,
} from '@/lib/product-utils';
import { Product } from '@/types';

// Test için minimal geçerli ürün
const base: Product = {
  id: 'test-id',
  title: '',
  slug: '',
  priceMin: 0,
  priceMax: 0,
  category: 'Sihirli Kupa',
  active: true,
  shortDesc: '',
  description: '',
  images: [],
  deliveryDays: 3,
  createdAt: 0,
  updatedAt: 0,
};

// ── getTitle ────────────────────────────────────────────────────────────────

describe('getTitle', () => {
  it('title alanını okur', () => {
    expect(getTitle({ ...base, title: 'Sihirli Mat Kupa' })).toBe('Sihirli Mat Kupa');
  });

  it('baslik alias\'ını okur', () => {
    expect(getTitle({ ...base, title: '', baslik: 'Kupa' } as unknown as Product)).toBe('Kupa');
  });

  it('hiçbir alan yoksa — döner', () => {
    expect(getTitle({ ...base, title: '' })).toBe('—');
  });
});

// ── getPriceMin / getPriceMax ────────────────────────────────────────────────

describe('getPriceMin', () => {
  it('priceMin alanını okur', () => {
    expect(getPriceMin({ ...base, priceMin: 150 })).toBe(150);
  });

  it('priceTRY alias\'ını okur (priceMin yoksa)', () => {
    expect(getPriceMin({ ...base, priceMin: 0, priceTRY: 200 } as unknown as Product)).toBe(200);
  });

  it('hiçbir alan yoksa 0 döner', () => {
    expect(getPriceMin({ ...base, priceMin: 0 })).toBe(0);
  });
});

describe('getPriceMax', () => {
  it('priceMax alanını okur', () => {
    expect(getPriceMax({ ...base, priceMax: 350 })).toBe(350);
  });

  it('priceMax yoksa priceMin döner', () => {
    expect(getPriceMax({ ...base, priceMin: 200, priceMax: 0 })).toBe(200);
  });
});

// getPrice (alias for getPriceMin)
describe('getPrice', () => {
  it('priceMin değerini döner', () => {
    expect(getPrice({ ...base, priceMin: 150 })).toBe(150);
  });
});

// ── getCategory ─────────────────────────────────────────────────────────────

describe('getCategory', () => {
  it('category alanını okur', () => {
    expect(getCategory({ ...base, category: 'Sihirli Kupa' })).toBe('Sihirli Mat Kupa');
  });

  it('kategori alias\'ını okur', () => {
    expect(getCategory({ ...base, category: 'Sihirli Kupa', kategori: 'Özel Tasarım' } as unknown as Product)).toBe('Sihirli Mat Kupa');
  });
});

// ── getActive / getInStock ───────────────────────────────────────────────────

describe('getActive', () => {
  it('active true döner', () => {
    expect(getActive({ ...base, active: true })).toBe(true);
  });

  it('active false döner', () => {
    expect(getActive({ ...base, active: false })).toBe(false);
  });

  it('inStock alias\'ını okur', () => {
    expect(getActive({ ...base, active: undefined, inStock: false } as unknown as Product)).toBe(false);
  });

  it('alan yoksa varsayılan true döner', () => {
    expect(getActive({ ...base, active: undefined } as unknown as Product)).toBe(true);
  });
});

describe('getInStock', () => {
  it('getActive ile aynı sonucu döner', () => {
    expect(getInStock({ ...base, active: true })).toBe(true);
    expect(getInStock({ ...base, active: false })).toBe(false);
  });
});

// ── getDeliveryDays ──────────────────────────────────────────────────────────

describe('getDeliveryDays', () => {
  it('deliveryDays alanını okur', () => {
    expect(getDeliveryDays({ ...base, deliveryDays: 5 })).toBe(5);
  });

  it('alan yoksa 3 döner', () => {
    expect(getDeliveryDays({ ...base, deliveryDays: undefined } as unknown as Product)).toBe(3);
  });
});

// ── getSlug ──────────────────────────────────────────────────────────────────

describe('getSlug', () => {
  it('slug alanını döner', () => {
    expect(getSlug({ ...base, slug: 'sihirli-mat-kupa' })).toBe('sihirli-mat-kupa');
  });

  it('slug yoksa id\'yi döner', () => {
    expect(getSlug({ ...base, id: 'abc123', slug: '' })).toBe('abc123');
  });
});

// ── getFeatured ──────────────────────────────────────────────────────────────

describe('getFeatured', () => {
  it('featured true döner', () => {
    expect(getFeatured({ ...base, featured: true })).toBe(true);
  });

  it('featured yoksa false döner', () => {
    expect(getFeatured(base)).toBe(false);
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

// ── getShortDesc / getDescription ────────────────────────────────────────────

describe('getShortDesc', () => {
  it('shortDesc alanını döner', () => {
    expect(getShortDesc({ ...base, shortDesc: 'Kısa açıklama' })).toBe('Kısa açıklama');
  });

  it('alan yoksa boş string döner', () => {
    expect(getShortDesc(base)).toBe('');
  });
});

describe('getDescription', () => {
  it('description alanını döner', () => {
    expect(getDescription({ ...base, description: 'Uzun açıklama' })).toBe('Uzun açıklama');
  });

  it('alan yoksa boş string döner', () => {
    expect(getDescription(base)).toBe('');
  });
});
