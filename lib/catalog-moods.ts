import type { CatalogMood, MoodId, MoodWithCount } from './catalog-moods-types';
import { getActive, getCategory, getShortDesc, getTitle } from './product-utils';
import type { Product } from '@/types';

export const CATALOG_MOODS: readonly CatalogMood[] = [
  {
    id: 'sihirli',
    eyebrow: 'Isıyla beliren sürpriz',
    title: 'Sihirli Kupalar',
    caption: 'Sıcak içecekle ortaya çıkan gizli fotoğraf ve mesajlar.',
    categories: ['Sihirli Kupa'],
    keywords: ['sihirli', 'ısıyla'],
  },
  {
    id: 'kahve',
    eyebrow: 'Keyif saatleri',
    title: 'Kahve & Latte Ritüeli',
    caption: 'Türk kahvesi, filtre kahve ve latte için zarif fincanlar.',
    categories: ['Seramik Kahve Fincanı', 'Kahve Fincanı', 'Latte Fincanı'],
    keywords: ['fincan', 'latte', 'espresso', 'tabaklı'],
  },
  {
    id: 'hediye',
    eyebrow: 'Tek adet özel üretim',
    title: 'Fotoğraflı & İsimli Hediye',
    caption: 'Sevdiklerinize isim, tarih veya anı fotoğrafıyla kalıcı hediye.',
    categories: ['Lüks Kupa', 'Özel Tasarım', 'Büyük Kupa'],
    keywords: ['hediye', 'özel', 'lüks', 'renkli', 'kalp', 'motto'],
  },
  {
    id: 'kurumsal',
    eyebrow: '45+ adette özel fiyat',
    title: 'Ofis & Kurumsal',
    caption: 'Şirket logonuzla ekip masaları, lansman ve müşteri hediyeleri.',
    categories: ['Kurumsal', 'Pro Kupa'],
    keywords: ['kurumsal', 'logo', 'pro kupa', 'ofis', 'toplu'],
  },
];

const MOOD_MAP: ReadonlyMap<MoodId, CatalogMood> = new Map(
  CATALOG_MOODS.map((mood) => [mood.id, mood]),
);

/** Verilen değerin geçerli bir koleksiyon (mood) kimliği olup olmadığını doğrular. */
export function isValidMoodId(value: unknown): value is MoodId {
  return typeof value === 'string' && MOOD_MAP.has(value as MoodId);
}

/** Ürünün kategori veya başlık/kısa açıklama anahtar kelimeleriyle ilgili mood'a uyup uymadığını kontrol eder. */
export function matchesMood(product: Product, moodId: MoodId): boolean {
  const mood = MOOD_MAP.get(moodId);
  if (!mood) return false;

  const category = getCategory(product);
  if ((mood.categories as readonly string[]).includes(category)) {
    return true;
  }

  const titleLower = getTitle(product).toLocaleLowerCase('tr-TR');
  const shortDescLower = getShortDesc(product).toLocaleLowerCase('tr-TR');

  return mood.keywords.some((keyword) => {
    const kw = keyword.toLocaleLowerCase('tr-TR');
    return titleLower.includes(kw) || shortDescLower.includes(kw);
  });
}

/** Yalnızca aktif ürünleri sayarak her koleksiyon için ürün adediyle zenginleştirilmiş liste üretir. */
export function buildMoodsWithCounts(products: Product[]): MoodWithCount[] {
  const activeProducts = products.filter((product) => getActive(product));

  return CATALOG_MOODS.map((mood) => {
    let count = 0;
    for (const product of activeProducts) {
      if (matchesMood(product, mood.id)) {
        count += 1;
      }
    }
    return {
      ...mood,
      count,
    };
  });
}
