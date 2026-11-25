// Ana sayfa yaratıcı vitrin kürasyonu (Mood / Hediye Seçici) — Ortak Sözleşme.
import type { Category, Product } from '@/types';

export type MoodId = 'sihirli' | 'kahve' | 'hediye' | 'kurumsal';

export interface CatalogMood {
  id: MoodId;
  eyebrow: string;
  title: string;
  caption: string;
  categories: readonly Category[];
  keywords: readonly string[];
}

export interface MoodWithCount extends CatalogMood {
  count: number;
}

export type MatchMoodFn = (product: Product, moodId: MoodId) => boolean;
