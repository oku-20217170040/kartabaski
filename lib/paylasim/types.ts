import type { SocialPlatform } from '../social-types';

export type PaylasimTur = 'karusel' | 'hikaye';
export type HedefDurum = 'bekliyor' | 'gonderiliyor' | 'tamam' | 'hata' | 'atlandi' | 'belirsiz';
export interface Hedef { status: HedefDurum; attempts: number; remoteId?: string; error?: string; at?: number }
export type PaylasimDurum = 'bekliyor' | 'yayinlandi' | 'kismi' | 'hata' | 'iptal';

export interface Paylasim {
  key: string;
  kind: PaylasimTur;
  productId: string;
  color: string; // '' = karışık karusel ya da hikâye
  imageIds: string[];
  at: number;
  status: PaylasimDurum;
  caption: string; // '' = yayın anında otomatik
  targets: Partial<Record<SocialPlatform, Hedef>>;
  createdAt: number;
}

export interface Kademe { label: string; price: string }
export interface UrunRenk { name: string; images: string[] }

/** Paylaşıma uygun ürün: aktif, görselli, fiyatı onaylı. */
export interface PaylasimUrun {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc: string;
  deliveryDays: number;
  createdAt: number;
  images: string[];
  colors: UrunRenk[];
  tiers: Kademe[];
}

export interface Ayar {
  mode: 'onizleme' | 'canli';
  paused: boolean;
  platforms: Record<SocialPlatform, boolean>;
  kinds: Record<PaylasimTur, boolean>; // içerik türü aç/kapat
  carouselTimes: string[];
  storyTimes: string[];
  covers: Record<string, string>; // grup anahtarı → görsel kimliği
}

export const VARSAYILAN_AYAR: Ayar = {
  mode: 'onizleme',
  paused: false,
  platforms: { instagram: true, facebook: true, threads: true, telegram: true, pinterest: true, tiktok: true },
  kinds: { karusel: true, hikaye: true },
  carouselTimes: ['11:00', '18:00'],
  storyTimes: ['09:00', '14:00', '20:00'],
  covers: {},
};

export const PLATFORMLAR: Record<PaylasimTur, SocialPlatform[]> = {
  karusel: ['instagram', 'facebook', 'threads', 'telegram', 'pinterest', 'tiktok'],
  hikaye: ['instagram', 'facebook', 'pinterest', 'tiktok'],
};

export const KARUSEL_MAX = 10;
export const MAX_DENEME = 3;
export const UFUK_GUN = 3;
export const MAX_KADEME = 7;
