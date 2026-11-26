/** Çift slug'lı eski kayıtlar: düzenleme kilitlenmemeli, sayfa aktif ürünü göstermeli. */
jest.mock('server-only', () => ({}));

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

jest.mock('@/lib/firebase-admin', () => {
  const snap = (id: string) => ({ id, exists: store.has(id), data: () => store.get(id) });
  const query = (slug: string, max = Infinity) => ({
    limit: (n: number) => query(slug, n),
    get: async () => {
      const docs = Array.from(store.keys()).filter((id) => store.get(id)!.slug === slug).sort().slice(0, max).map(snap);
      return { docs, empty: docs.length === 0 };
    },
  });
  return {
    adminDb: {
      collection: () => ({
        where: (_f: string, _op: string, slug: string) => query(slug),
        doc: (id: string) => ({
          get: async () => snap(id),
          update: async (patch: Doc) => { store.set(id, { ...store.get(id), ...patch }); },
        }),
      }),
    },
  };
});

import { updateProduct } from '@/lib/products-admin';
import { getProductBySlugServer } from '@/lib/products-server';

const product = (slug: string, active: boolean) => ({
  title: 'Tabaklı Fincan', slug, active, category: 'Kahve Fincanı', priceMin: 300, priceMax: 300, images: [],
});

beforeEach(() => {
  store.clear();
  store.set('a-kopya', product('tabakli', false));
  store.set('b-asil', product('tabakli', true));
  store.set('c-diger', product('latte', true));
});

describe('updateProduct', () => {
  it('slug değişmiyorsa çift kayıt düzenlemeyi engellemez', async () => {
    await updateProduct('b-asil', { slug: 'tabakli', category: 'Sihirli Kupa' });
    expect(store.get('b-asil')!.category).toBe('Sihirli Kupa');
  });

  it('slug başka ürününkine değiştirilemez', async () => {
    await expect(updateProduct('b-asil', { slug: 'latte' })).rejects.toThrow('slug başka bir üründe');
    expect(store.get('b-asil')!.slug).toBe('tabakli');
  });

  it('boştaki slug verilebilir', async () => {
    await updateProduct('a-kopya', { slug: 'tabakli-eski' });
    expect(store.get('a-kopya')!.slug).toBe('tabakli-eski');
  });
});

describe('getProductBySlugServer', () => {
  it('aynı slug iki üründeyse aktif olanı verir', async () => {
    expect((await getProductBySlugServer('tabakli'))?.id).toBe('b-asil');
  });

  it('aktif olan yoksa ilk kaydı, hiç yoksa null döner', async () => {
    store.set('b-asil', product('tabakli', false));
    expect((await getProductBySlugServer('tabakli'))?.id).toBe('a-kopya');
    expect(await getProductBySlugServer('yok')).toBeNull();
  });
});
