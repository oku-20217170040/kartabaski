// Sosyal medya modülleri arasındaki ortak sözleşme (Merkez sayfası + cron rotası bunları kullanır).

export type SocialPlatform = 'instagram' | 'facebook' | 'threads' | 'telegram' | 'pinterest' | 'tiktok';

/** Bir platform otomasyon turunun özeti. `skipped` doluysa tur çalışmadı (ör. token yok). */
export interface CycleResult {
  skipped?: string;
  posted: string[]; // paylaşılan ürün/yazı kimlikleri
  errors: string[];
  [extra: string]: unknown;
}

/** Merkez sayfası için platform durumu. */
export interface PlatformStatus {
  platform: SocialPlatform;
  configured: boolean; // gerekli env/token mevcut mu
  enabled: boolean; // panelden otomasyon açık mı
  lastRunAt?: number;
  lastPostAt?: number;
  queued?: number; // sıradaki taslak/plan sayısı
  detail?: string; // kısa açıklama veya son hata
}
