'use client';

import Link from 'next/link';
import type { MoodId, MoodWithCount } from '@/lib/catalog-moods-types';

export interface CuratedMoodsProps {
  moods: MoodWithCount[];
  activeMood: MoodId | null;
  totalActiveCount: number;
  onSelectMood: (mood: MoodId | null) => void;
}

/** Katalog başlığı ve koleksiyon sekmeleri. */
export function CuratedMoods({
  moods,
  activeMood,
  totalActiveCount,
  onSelectMood,
}: CuratedMoodsProps) {
  return (
    <>
      <div className="catalog-head">
        <h2 id="urunler-baslik" className="h2">Hangi kupaya basalım?</h2>
        <Link href="/kategoriler" className="text-link">Kategorilere göre bakın</Link>
      </div>

      <div className="mood-tabs" role="group" aria-label="Koleksiyonlar">
        <button type="button" className="mood-tab" aria-pressed={activeMood === null} onClick={() => onSelectMood(null)}>
          Hepsi <sup>{totalActiveCount}</sup>
        </button>
        {moods.filter((m) => m.count > 0).map((m) => (
          <button
            type="button"
            key={m.id}
            className="mood-tab"
            aria-pressed={activeMood === m.id}
            onClick={() => onSelectMood(activeMood === m.id ? null : m.id)}
          >
            {m.title} <sup>{m.count}</sup>
          </button>
        ))}
      </div>
    </>
  );
}

export default CuratedMoods;
