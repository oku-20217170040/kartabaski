// Ürün fotoğrafı üretimi: sağlayıcıdan bağımsız sözleşme (istemci + sunucu ortak, server-only YOK).
// Yeni bir API eklemek = bu arayüzü uygulayan tek bir adaptör dosyası + registry'ye bir satır.

export type ImageProviderId = 'cloudflare' | 'huggingface' | 'gemini' | 'fal' | 'openai' | 'replicate' | 'mock';

/** Bir üretim isteği: 1+ referans ürün fotoğrafı → stüdyo ortamında yeni çekim. */
export interface GenerateRequest {
  /** Referans görsellerin herkese açık URL'leri (Cloudinary). İlki ana referans. */
  referenceUrls: string[];
  /** Tam prompt (sahne + "ürünü değiştirme" kuralları buildPrompt ile birleşmiş halde). */
  prompt: string;
  /** Çıktı en-boy oranı. */
  aspectRatio: '1:1' | '4:5' | '3:4' | '16:9';
  /** Sağlayıcıya özel model kimliği (boşsa adaptörün varsayılanı). */
  model?: string;
  /** Tekrarlanabilirlik için (destekleyen sağlayıcılarda). */
  seed?: number;
}

/** Üretim sonucu: ya ham bayt ya da indirilebilir URL (adaptör hangisini veriyorsa). */
export interface GeneratedImage {
  data?: Uint8Array; // PNG/JPEG/WebP baytları
  url?: string; // geçici indirme adresi
  mimeType?: string;
}

export interface GenerateResult {
  images: GeneratedImage[];
  model: string; // gerçekten kullanılan model
  costUsd?: number; // biliniyorsa tahmini maliyet
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string; // panelde görünen ad
  /** Gerekli env değişkenleri tanımlı mı (anahtar değerini ASLA döndürme). */
  configured(): boolean;
  /** Eksik env adları (panelde "şunu ekle" diye gösterilir). */
  missingEnv(): string[];
  defaultModel: string;
  /** Ücretsiz katmanı var mı (panelde rozet). */
  free?: boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

/** Hata sınıfı: kullanıcıya gösterilebilir Türkçe mesaj + yeniden denenebilir mi. */
export class ImageGenError extends Error {
  constructor(message: string, public retryable = false, public status?: number) {
    super(message);
    this.name = 'ImageGenError';
  }
}
