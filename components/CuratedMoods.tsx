'use client';

import '@fontsource-variable/caveat';
import Link from 'next/link';
import { ArrowRightIcon } from './icons';
import type { MoodId, MoodWithCount } from '@/lib/catalog-moods-types';

export interface CuratedMoodsProps {
  moods: MoodWithCount[];
  activeMood: MoodId | null;
  totalActiveCount: number;
  onSelectMood: (mood: MoodId | null) => void;
}

/** Koleksiyon kartlarına özel el çizimi estetiğinde inline SVG illüstrasyonları. */
function MoodArtwork({ id }: { id: MoodId }) {
  const shared = {
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    focusable: 'false' as const,
  };

  switch (id) {
    case 'sihirli':
      return (
        <svg {...shared}>
          <path d="M6.5 13.5h13v8.5a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4v-8.5Z" />
          <path d="M19.5 15.5h2.5a2.5 2.5 0 0 1 0 5h-2.5" />
          <path d="M10.5 10c0-1.5 1.3-2 1.3-3.5" />
          <path d="M15 10c0-1.5 1.3-2 1.3-3.5" />
          <path d="M24.5 4.5v4M22.5 6.5h4" />
          <path d="M13 18v3M11.5 19.5h3" />
        </svg>
      );
    case 'kahve':
      return (
        <svg {...shared}>
          <path d="M7.5 12h13v5.5a6.5 6.5 0 0 1-13 0V12Z" />
          <path d="M20.5 13.5h2a2 2 0 0 1 0 4h-2" />
          <path d="M5 24.5c2.4 1.3 5.5 2 9 2s6.6-.7 9-2" />
          <path d="M11.5 8.5c0-1.3 1.1-1.7 1.1-3" />
          <path d="M15.8 8.5c0-1.3 1.1-1.7 1.1-3" />
        </svg>
      );
    case 'hediye':
      return (
        <svg {...shared}>
          <path d="M6.5 12.5h13v9.5a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4v-9.5Z" />
          <path d="M19.5 15h2.5a2.5 2.5 0 0 1 0 5h-2.5" />
          <path d="M13 10c-1.8-2.3-4.2-1.8-3.8-.2.3 1.2 2.2 1 3.8.2Zm0 0c1.8-2.3 4.2-1.8 3.8-.2-.3 1.2-2.2 1-3.8.2Z" />
          <path d="M13 10v2.5" />
          <path d="M13 21.8s-3.2-2-3.2-4.1a1.8 1.8 0 0 1 3.2-1.1 1.8 1.8 0 0 1 3.2 1.1c0 2.1-3.2 4.1-3.2 4.1Z" />
        </svg>
      );
    case 'kurumsal':
      return (
        <svg {...shared}>
          <path d="M7 10h13v12.5a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V10Z" />
          <path d="M20 13h2.5a2.5 2.5 0 0 1 0 5H20" />
          <path d="M13.5 13.8l3.2 1.9v3.6l-3.2 1.9-3.2-1.9v-3.6l3.2-1.9Z" />
          <circle cx="13.5" cy="17.5" r="1.2" />
          <path d="M5.5 28h16" />
        </svg>
      );
  }
}

export function CuratedMoods({
  moods,
  activeMood,
  totalActiveCount,
  onSelectMood,
}: CuratedMoodsProps) {
  return (
    <>
      <div className="showcase-intro">
        <div className="showcase-copy">
          <p className="showcase-kicker">
            <span className="showcase-dot" aria-hidden="true" /> Atölye Koleksiyonu · {totalActiveCount} özgün model
          </p>
          <h2 id="urunler-baslik" className="showcase-title">
            Ruh halinize göre <span className="showcase-hand font-hand">kupanızı seçin.</span>
          </h2>
        </div>

        <div className="showcase-links">
          <Link href="/konfigurator" className="showcase-pill-link">
            Kendin eşleştir <ArrowRightIcon size={16} />
          </Link>
          <Link href="/kategoriler" className="text-link">
            Tüm kategoriler
          </Link>
        </div>
      </div>

      <div className="mood-grid" role="group" aria-label="Koleksiyon kürasyonu">
        {moods.map((m) => (
          <button
            type="button"
            key={m.id}
            className="mood-card"
            aria-pressed={activeMood === m.id}
            onClick={() => onSelectMood(activeMood === m.id ? null : m.id)}
          >
            <div className="mood-card-top">
              <span className="mood-art" aria-hidden="true">
                <MoodArtwork id={m.id} />
              </span>
              <span className="mood-count">
                {m.count > 0 ? `${m.count} model` : 'Keşfet'}
              </span>
            </div>
            <span className="mood-eyebrow">{m.eyebrow}</span>
            <strong className="mood-title">{m.title}</strong>
            <span className="mood-caption">{m.caption}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default CuratedMoods;
