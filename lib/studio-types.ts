// AI Stüdyo ortak tipleri (istemci + sunucu). `@/types` içine EKLENMEZ; modül kendi tiplerini taşır.
import type { PhotoroomMode, PhotoroomEnv, PhotoroomSettings, PhotoroomKeyStatus } from './photoroom';

export type { PhotoroomMode, PhotoroomEnv, PhotoroomSettings, PhotoroomKeyStatus };

/** Fotoğraf düzeyinde stüdyo kaydı: publicId = sitedeki yeni görsel, originalId = geri dönülebilecek orijinal. */
export interface StudioPhoto {
  publicId: string;
  originalId: string;
  approvedAt: number;
  /** Orijinal Cloudinary'den silindiyse geri dönüş mümkün değildir. */
  originalPurged?: boolean;
}

export type DraftStatus = 'generating' | 'pending' | 'approved' | 'rejected' | 'failed' | 'reverted';

export interface StudioGenOptions {
  mode?: PhotoroomMode;
  prompt?: string;
  blurRadius?: number;
  environment?: PhotoroomEnv;
  /** Sahne önerisi kimliği (yalnızca geçmişte göstermek için). */
  sceneId?: string;
}

export interface StudioDraft {
  id: string;
  productId: string;
  productTitle: string;
  originalPublicId: string;
  draftPublicId?: string;
  mode: PhotoroomMode;
  prompt?: string;
  sceneId?: string;
  blurRadius?: number;
  environment: PhotoroomEnv;
  status: DraftStatus;
  error?: string;
  costUSD: number;
  createdAt: number;
  approvedAt?: number;
  rejectedAt?: number;
  revertedAt?: number;
}

export interface ApproveResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface StudioStats {
  generatedThisMonth: number;
  costThisMonthUSD: number;
  costTotalUSD: number;
  generatedTotal: number;
  failedTotal: number;
}

/** Ürün renk varyantı (Product.colors[]) — yalnızca stüdyonun ihtiyacı olan alanlar. */
export interface StudioColor {
  name: string;
  images: string[];
}

/** Arayüze giden sade ürün görünümü (istemciye tüm Firestore belgesi taşınmaz). */
export interface StudioProduct {
  id: string;
  title: string;
  active: boolean;
  /** Kapak/varsayılan görseller */
  images: string[];
  colors: StudioColor[];
  studioPhotos: StudioPhoto[];
  studioEnhanced: boolean;
}

export interface StudioOverviewData {
  products: StudioProduct[];
  drafts: StudioDraft[];
  settings: PhotoroomSettings;
  keys: PhotoroomKeyStatus;
  stats: StudioStats;
  /** Sessizce yutulmayan hatalar: arayüz bunları kullanıcıya gösterir. */
  warnings: string[];
}
