# KAR-TA BASKI — Proje Bağlamı & Mimari Rehberi

> Bu dosya, projeyi hiç görmemiş bir insanın veya yapay zeka agentin projeyi hızlıca, derinlemesine kavraması için yazılmıştır.
> Sadece "ne var" değil, "neden öyle" ve "nasıl genişletilir" sorularına da cevap verir.

---

## 1. Bu Proje Ne?

**KAR-TA BASKI**, Türkiye genelinde hizmet veren bir kişiye özel kupa baskı markasının dijital kataloğu ve sipariş sitesidir.

İş modeli:
- Sihirli kupalar, konik kupalar, seramik nescafe fincanları gibi ürünler web sitesinde listelenir.
- Müşteriler WhatsApp üzerinden iletişime geçer, tasarım gönderir ve sipariş verir.
- Tasarım ücretsiz yapılır, kargo Türkiye geneline 3 iş gününde gönderilir.

**Önemli:** Bu site bir e-ticaret değil. Sepet, ödeme, checkout yok. Tüm satış süreci WhatsApp üzerinden gidiyor. Site, vitrin + iletişim köprüsü işlevi görüyor.

---

## 2. Kimlere Hitap Ediyor?

### Müşteriler (ziyaretçiler)
- Ürünleri gözetler, filtreler, arar.
- İlgilerini çeken ürünü WhatsApp'tan sorar.
- Ürün sayfasından da WhatsApp'a yönlendirilir.
- "Nasıl Sipariş Verilir?" sayfasından süreci öğrenebilir.

### Mağaza Sahibi / Admin
- `/admin` panelinden ürün ekler, düzenler, siler.
- Fotoğraf yükler (Cloudinary'e direkt).
- Ürünü "Öne Çıkan" yapabilir.

---

## 3. Teknik Stack — Neden Bu Seçimler?

| Teknoloji | Neden |
|---|---|
| **Next.js 14 App Router** | SSR ile SEO-hazır HTML, ISR ile otomatik güncelleme |
| **Firebase Firestore** | Realtime DB kurulum gerektirmiyor, küçük ölçek için maliyet-etkin |
| **Firebase Auth** | Email/password ile tek kişilik admin için yeterli |
| **Cloudinary** | Görsel optimizasyon (format dönüşümü, boyut), CDN dahil |
| **Tailwind CSS** | Mevcut CSS üzerine eklendi (preflight kapalı), ikisi birlikte çalışıyor |
| **framer-motion** | Hover efektleri, skeleton animasyonu — native CSS'ten daha ifadeli |
| **Vercel** | Next.js native deploy, env var yönetimi kolay |
| **Railway** | Alternatif deploy seçeneği |

---

## 4. Proje Mimarisi — Büyük Resim

```
Kullanıcı Ziyareti
       │
       ▼
  Next.js Server
  app/page.tsx  ──────────────── getProducts() ──── Firestore (unstable_cache)
       │                              │
       │ initialProducts prop         │ Tag-based cache
       ▼                              │ (revalidateTag('products'))
  ProductsClient.tsx (Client)         │
       │                              │
  [useMemo filtrele & sırala]         │
       │                              │
  ProductCard × N ──── /urun/[slug] ──┘
       │
  WhatsApp Linki
       │
  ✅ Sipariş verilir (site dışında)
```

### Server / Client Sınırı

```
Server Components:
  app/page.tsx            → ürünleri Firestore'dan çeker, HTML üretir
  app/urun/[slug]/page.tsx → metadata, product schema, SSR
  app/layout.tsx          → global meta, JSON-LD schema'lar

Client Components ('use client'):
  app/ProductsClient.tsx       → filtreleme state'i, sıralama, sayfalama
  app/urun/[slug]/ProductDetailClient.tsx → lightbox, zoom, interaktivite
  components/ProductCard.tsx   → hover animasyonları (framer-motion)
  components/FilterBar.tsx     → kullanıcı etkileşimi
  components/Navbar.tsx        → mobil menü state
  lib/auth-context.tsx         → Firebase Auth dinleyicisi
  app/admin/**                 → tüm admin paneli client-side
```

**Kural:** Server component'lar state tutamaz, event handler alamaz.
Client component'lar SSR'dan faydalanmaz. Sınırı doğru çizmek performans için kritik.

---

## 5. Veri Modeli

### Product (Firestore: `products` koleksiyonu)

```typescript
{
  id: string;              // Firestore auto-ID
  title: string;           // "Sihirli Mat Kupa - Kişiye Özel"
  slug: string;            // "sihirli-mat-kupa" — URL'de kullanılır
  priceMin: number;        // 150
  priceMax: number;        // 250
  category: Category;      // 'Sihirli Mat Kupa' | 'Sihirli Konik Kupa' | ...
  active: boolean;         // false olunca sitede görünmez
  featured?: boolean;      // Öne Çıkan badge + sıralamada üste
  shortDesc: string;       // Kart altında kısa açıklama
  description: string;     // Detay sayfasında uzun açıklama
  images: string[];        // Cloudinary public_id'leri: ["karta-baski/urunler/abc123"]
  deliveryDays: number;    // Kargo süresi (iş günü, varsayılan: 3)
  seoTags?: string[];      // Gizli SEO etiketleri
  createdAt: number;       // Date.now() — sıralama için
  updatedAt: number;
}
```

### AdminUser (Firestore: `users/{uid}`)

```typescript
{
  role: 'admin';
  email: string;
}
```

Admin rolü Firestore'da `users/{uid}.role === 'admin'` kontrolü ile yapılıyor.

---

## 6. Cache Sistemi

`lib/products.ts` içinde Next.js `unstable_cache` ile tag-based cache kullanılıyor:

```
İlk istek → Firestore → cache'e yaz (tag: 'products')
Sonraki istekler → cache'den dön
Admin CRUD işlemi → revalidateTag('products') → cache temizlenir
Sonraki istek → Firestore'dan taze veri alır
```

Server Actions (`lib/actions.ts`) her CRUD işleminden sonra `revalidateTag('products')` çağırır.

---

## 7. Authentication Akışı

```
AuthProvider mount edilir (app/layout.tsx)
  │
  ├─ mounted = false → SSR'da hiçbir auth state yok (hydration mismatch önlenir)
  │
  └─ useEffect (mounted olunca)
       │
       onAuthStateChanged dinlemeye başlar
       │
       ├─ Kullanıcı giriş yaptıysa → Firestore'dan users/{uid} çek → role === 'admin' mi?
       │     isAdmin = true/false
       │     ID token → POST /api/auth/session → HttpOnly cookie (__session)
       │
       └─ Çıkış yaptıysa → DELETE /api/auth/session → cookie silinir
```

Middleware (`middleware.ts`) `/admin/*` rotalarını sunucu tarafında `__session` cookie kontrolüyle koruyor.
Admin layout (`app/admin/layout.tsx`) istemci tarafında `isAdmin` kontrolü yapıyor.

---

## 8. Görsel Sistemi (Cloudinary)

Görseller Cloudinary'de `karta-baski/urunler/` klasöründe saklanır.

Cloud name çevre değişkeninden okunur: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (varsayılan: `dwulzfmlu`)

İki helper fonksiyon:
```typescript
cloudinaryUrl(publicId, 'f_auto,q_auto,w_1200,c_limit')
// → https://res.cloudinary.com/dwulzfmlu/image/upload/f_auto,q_auto,w_1200,c_limit/karta-baski/urunler/abc

cloudinaryThumb(publicId)
// → 600 genişlikte kırpılmış versiyon (kart görselleri için)
```

`f_auto` → tarayıcıya göre WebP/AVIF seçer.
`q_auto` → Cloudinary kalite optimize eder.
`c_limit` → aspect ratio bozmadan boyutlandırır.

Görsel yükleme: `POST /api/upload` (server-side, signed upload)
Görsel silme: `POST /api/cloudinary-delete` (server-side)

---

## 9. SEO Mimarisi

### Katman 1: Next.js Metadata API
`app/layout.tsx` → Tüm site için temel meta, OpenGraph, Twitter Card, canonical URL.
`app/urun/[slug]/page.tsx` → Her ürün için dinamik meta (başlık, fiyat, görsel).

### Katman 2: JSON-LD Schema (Structured Data)
`app/layout.tsx` içinde:
- İşletme schema → Google'a işletme bilgisi

`app/urun/[slug]/page.tsx` içinde:
- `Product` schema → her ürün için fiyat, stok durumu

### Katman 3: sitemap.ts & robots.ts
`app/sitemap.ts` → Tüm ürünleri dinamik olarak sitemap'e ekler.
`app/robots.ts` → Crawl yönetimi (admin & api engellenir).

**Not:** Yeni bir sayfa eklerken `generateMetadata` ve ilgili JSON-LD schema'yı da eklemeyi unutma.

---

## 10. Tasarım Sistemi

### Renk Paleti
```css
--bg: #f5f0e8          /* Ana arka plan — krem */
--surface: #111111      /* Kart/panel arka planı (admin) */
--card: #ffffff         /* ProductCard arka planı */
--border: rgba(0,0,0,0.08)  /* İnce kenarlıklar */
--text: #1a1a1a         /* Ana metin — koyu */
--muted: #7d8590        /* İkincil metin — gri */
--accent: #C9A84C       /* Altın sarısı — CTA rengi */
--accent2: #ffffff      /* Beyaz */
```

### Yazı Tipleri
- `Outfit` (display/başlık) → `var(--font-display)` veya `font-family: 'Outfit'`
- `Inter` (body) → varsayılan

### CSS Yaklaşımı — Hibrit Model
1. **Global CSS sınıfları** (`app/globals.css`):
   `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
   `.card`, `.container`, `.products-grid`, `.badge`
   `.admin-*` prefix'li admin panel sınıfları

2. **Tailwind utility sınıfları**:
   Tailwind renkleri CSS değişkenlerine bağlı: `bg-accent` = `var(--accent)`

3. **Component-scoped `<style>` blokları**:
   Her büyük component kendi CSS'ini `<style>` tag'i içinde taşıyor.

### Animasyonlar
- `framer-motion`: `ProductCard` hover (y: -5, spring), lightbox, skeleton loading
- CSS: `@keyframes shimmer` (skeleton), float (hero)

---

## 11. Sayfa Akışları

### Ana Sayfa (`/`)
```
Server: getProducts() → unstable_cache (tag: 'products')
  → HeroSection (slogan, sipariş butonları)
  → ProductsClient (filtreleme/sıralama/sayfalama, tüm mantık client-side)
    → FilterBar (arama, kategori, sıralama, fiyat aralığı)
    → products-grid
      → ProductCard × N (12 ürün/sayfa)
  → Contact Section (WhatsApp CTA)
  → Footer
```

### Ürün Detay (`/urun/[slug]`)
```
Server: slug ile getProductBySlug() → başarısız olursa getProductById()
  → generateMetadata() → dynamic meta tags
  → Product JSON-LD schema inject
  → ProductDetailClient (client, full interaktivite)
    → Resim galerisi + lightbox (zoom/pan)
    → Fiyat aralığı, kargo süresi
    → WhatsApp butonu (whatsappLink() ile ürüne özel mesaj)
```

### Admin Paneli (`/admin/*`)
```
middleware.ts → __session cookie kontrolü
AuthProvider → useAuth() → isAdmin kontrolü

/admin            → Dashboard (stats: toplam/aktif/pasif/kategori)
/admin/products   → Ürün listesi (düzenle/sil/öne çıkar)
/admin/products/new → ProductForm (yeni ürün)
/admin/products/[id] → ProductForm (düzenleme modu)
/admin/login      → signInWithEmailAndPassword
```

---

## 12. Yeni Özellik Eklerken

### Yeni Ürün Alanı Eklemek
1. `types/index.ts` → `Product` interface'ine ekle
2. `lib/schemas.ts` → Zod schema'ya ekle
3. `components/ProductForm.tsx` → form field ekle
4. `components/ProductCard.tsx` → gösterim mantığına ekle
5. `app/urun/[slug]/ProductDetailClient.tsx` → detay sayfasına ekle
6. Filter'a da girmesini istiyorsan → `types/index.ts` `FilterState`'i güncelle, `app/ProductsClient.tsx` filter mantığına ekle, `components/FilterBar.tsx` UI ekle

### Yeni Kategori Eklemek
`types/index.ts` → `Category` union type + `CATEGORIES` array → her yerde otomatik yansır.

### Yeni Admin Sayfası Eklemek
`app/admin/[yeni-sayfa]/page.tsx` → `useAuth()` ile isAdmin kontrolü yap, admin layout (`app/admin/layout.tsx`) otomatik uygulanır.

### WhatsApp Numarasını Değiştirmek
`lib/constants.ts` → `PHONE` env var'dan okunur. Sadece `.env.local` ve Vercel env var'ını güncelle.

---

## 13. Kritik Davranışlar & Tuzaklar

### Hydration Mismatch
`lib/auth-context.tsx`'de `mounted` state var. Server'da auth state belirsiz olduğundan, ilk render'da `loading: true` döner. Auth state'ini erken okuyan componentler `loading` kontrolü yapmalı.

### Cache Invalidation
Server Actions (`lib/actions.ts`) her CRUD işleminden sonra `revalidateTag('products')` çağırır. Bu, Next.js cache'ini temizler ve sonraki istek Firestore'dan taze veri alır.

### Firestore Security Rules
`firestore.rules` dosyasında tanımlı. `isAdmin()` fonksiyonu `users/{uid}.role == 'admin'` kontrol eder. Bu kurallar Firebase Console'dan ayrıca deploy edilmelidir.

### Resim Fallback
`ProductCard.tsx`'de `imgError` state var. Resim yüklenemezse fallback gösterilir.

### Slug vs ID
Ürün detay sayfası hem slug'a hem ID'ye göre çalışır (önce slug dener, başarısız olursa ID ile dener).

---

## 14. Deployment

### Vercel (Birincil)
```
GitHub push → Vercel otomatik deploy
   │
   ├── main branch push → production deploy
   └── .env.local değişkenleri → Vercel dashboard'a elle girilmeli
```

### Railway (Alternatif)
`railway.toml` dosyasında yapılandırma var. Nixpacks builder kullanır.

### Firebase
- Proje: `kartabaski-fcf0e`
- Auth: Email/Password
- Firestore: `products` ve `users` koleksiyonları
- Kurallar: Firebase Console → Firestore → Rules sekmesinden güncellenir

### Environment variables (Vercel'de):
- `NEXT_PUBLIC_*` prefix'liler → browser'da da erişilebilir (Firebase web config, Cloudinary)
- `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` → sadece server-side

---

## 15. İşletme Bilgileri

| Bilgi | Değer |
|---|---|
| İşletme Adı | KAR-TA BASKI |
| Slogan | Hayal Et, Biz Basalım |
| Telefon | 0505 087 47 26 → `+905050874726` |
| Site URL | `https://kartabaski.com` |
| Cloudinary cloud | `dwulzfmlu` |
| Firebase project | `kartabaski-fcf0e` |
| GitHub repo | `oku-20217170040/kartabaski` |
| Vercel | `kartabaski.vercel.app` |

Telefon numarası `lib/constants.ts`'den env var ile yönetilir. Sadece `.env.local`'ı ve Vercel env var'ını güncelle.
