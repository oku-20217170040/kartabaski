import type { CatalogMood, MoodId, MoodWithCount } from './catalog-moods-types';
import { getActive, getCategory, getShortDesc, getTitle } from './product-utils';
import type { Product } from '@/types';

export const CATALOG_MOODS: readonly CatalogMood[] = [
  {
    id: 'sihirli',
    eyebrow: 'Isıya duyarlı siyah sır',
    title: 'Sihirli Kupalar',
    caption: 'Sıcak çay veya kahve döküldüğünde mat kaplama açılır, alttaki fotoğraf görünür.',
    categories: ['Sihirli Kupa'],
    keywords: ['sihirli', 'ısıyla'],
  },
  {
    id: 'kahve',
    eyebrow: 'Türk kahvesi & espresso',
    title: 'Kahve & Latte Fincanları',
    caption: 'Tabaklı porselen, konik latte ve günlük kahve servisi için seramik fincan kalıpları.',
    categories: ['Seramik Kahve Fincanı', 'Kahve Fincanı', 'Latte Fincanı'],
    keywords: ['fincan', 'latte', 'espresso', 'tabaklı'],
  },
  {
    id: 'hediye',
    eyebrow: '1 adetten başlayan baskı',
    title: 'İsimli & Fotoğraflı Kupalar',
    caption: 'İçi ve kulpu renkli lüks kupalar; tarih, isim veya telefon fotoğrafıyla çift yön baskı.',
    categories: ['Lüks Kupa', 'Özel Tasarım', 'Büyük Kupa'],
    keywords: ['hediye', 'özel', 'lüks', 'renkli', 'kalp', 'motto'],
  },
  {
    id: 'kurumsal',
    eyebrow: '45+ adette kademeli fiyat',
    title: 'Kurumsal & Ofis Serisi',
    caption: 'Şirket logosuyla toplantı odaları, ekip karşılama kitleri ve etkinlik gönderimleri.',
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
