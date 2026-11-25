// Kendi (first-party) ziyaretçi istatistikleri — istemci ve sunucu ortak tipleri.
// Kişisel veri tutulmaz: ham IP saklanmaz, yalnızca günlük toplam sayaçlar yazılır.

export type Counts = Record<string, number>;

/** Bir günün özet sayaçları (Firestore'da birkaç parçaya bölünür, okurken toplanır). */
export interface DailyStats {
  day: string; // YYYY-MM-DD (Europe/Istanbul)
  pv: number;     // sayfa görüntüleme
  uv: number;     // o gün ilk kez görülen benzersiz ziyaretçi (cihaz)
  newV: number;   // hiç görülmemiş (yeni) ziyaretçi
  sess: number;   // oturum
  multi: number;  // 2+ sayfa gezen oturum (hemen çıkma = 1 - multi/sess)
  dur: number;    // toplam saniye (ekranda görünür süre)
  durN: number;   // süre ölçülen sayfa sayısı
  hr: Counts;      // saat (0-23) → sayfa görüntüleme
  dev: Counts;     // cihaz: mobil/tablet/masaüstü (oturum)
  br: Counts;      // tarayıcı (oturum)
  os: Counts;      // işletim sistemi (oturum)
  ref: Counts;     // trafik kaynağı (oturum)
  utm: Counts;     // utm_source (oturum)
  country: Counts; // ülke kodu (oturum)
  city: Counts;    // şehir (oturum)
  page: Counts;    // genel sayfalar (› ile ayrılmış yol)
  prod: Counts;    // ürün id/slug → görüntüleme (her sayfa açılışı)
  prodU: Counts;   // ürün → tekil görüntüleme (aynı cihaz aynı gün bir kez)
  prodDur: Counts; // ürün → toplam saniye
  prodDurN: Counts;
  cat: Counts;     // kategori sayfası → görüntüleme
  blog: Counts;    // blog yazısı slug → okuma (sayfa açılışı)
  ev: Counts;      // etkinlikler: whatsapp, cart_add, cart_send, blog_read, search, filter
  wasrc: Counts;   // WhatsApp tıklaması hangi butondan (hero/float/urun/sepet)
  pwa: Counts;     // ürün → WhatsApp tıklaması
  pcart: Counts;   // ürün → sepete ekleme
  q: Counts;       // sitede yapılan aramalar
  qz: Counts;      // sonuç bulamayan aramalar
  flt: Counts;     // kullanılan filtre/sıralama değerleri
}

export const COUNT_MAPS = [
  'hr', 'dev', 'br', 'os', 'ref', 'utm', 'country', 'city', 'page',
  'prod', 'prodU', 'prodDur', 'prodDurN', 'cat', 'blog', 'ev', 'wasrc', 'pwa', 'pcart', 'q', 'qz', 'flt',
] as const;

export const NUM_FIELDS = ['pv', 'uv', 'newV', 'sess', 'multi', 'dur', 'durN'] as const;

/** Sitenin gönderdiği olay türleri. (Sayfa/ürün görüntüleme `pv` ile otomatik gelir.) */
export const EVENT_NAMES = ['whatsapp', 'cart_add', 'cart_send', 'blog_read', 'search', 'filter'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** İstemcinin /api/track'e gönderdiği gövde. */
export interface TrackPayload {
  t: 'pv' | 'leave' | 'ev';
  path?: string;
  vid: string;
  n?: number;        // oturumdaki kaçıncı sayfa görüntüleme
  nv?: boolean;      // yeni ziyaretçi (cihazda kimlik yoktu)
  nd?: boolean;      // bugün ilk kez görüldü
  ref?: string;
  utm?: { s?: string; m?: string; c?: string };
  dur?: number;      // saniye
  fl?: boolean;      // bu sayfa için ilk süre bildirimi
  pu?: boolean;      // bu ürün bu cihazda bugün ilk kez açıldı
  ev?: string;       // EVENT_NAMES'ten biri (bilinmeyenler sunucuda yok sayılır)
  slug?: string;     // ürün id/slug veya blog slug
  src?: string;      // WhatsApp düğmesi vb.
  q?: string;        // arama metni / filtre değeri
  zero?: boolean;    // arama sonuç bulamadı
}
