# Ümit Spot — Proje Bağlamı & Mimari Rehberi

> Bu dosya, projeyi hiç görmemiş bir insanın veya yapay zeka agentin projeyi hızlıca, derinlemesine kavraması için yazılmıştır.
> Sadece "ne var" değil, "neden öyle" ve "nasıl genişletilir" sorularına da cevap verir.

---

## 1. Bu Proje Ne?

**Ümit Spot**, İstanbul Esenyurt'ta faaliyet gösteren gerçek bir ikinci el & sıfır spot eşya mağazasının dijital kataloğudur.

Mağaza türkiye'de yaygın olan "spotçu" modeliyle çalışır:
- Mobilya, beyaz eşya, elektronik, ofis eşyaları alınır ve satılır.
- Ürünler web sitesinde listelenir; müşteriler WhatsApp üzerinden iletişime geçer ve anlaşma yapılır.
- Teslimat aynı gün yapılır (Esenyurt, Beylikdüzü, Avcılar, Büyükçekmece, Bahçeşehir, Başakşehir).
- Fiyat pazarlığı standarttır.

**Önemli:** Bu site bir e-ticaret değil. Sepet, ödeme, checkout yok. Tüm satış süreci WhatsApp üzerinden gidiyor. Site, vitrin + iletişim köprüsü işlevi görüyor.

---

## 2. Kimlere Hitap Ediyor?

### Müşteriler (ziyaretçiler)
- Ürünleri gözetler, filtreler, arar.
- İlgilerini çeken ürünü WhatsApp'tan sorar.
- Ürün sayfasından da WhatsApp'a yönlendirilir.
- "Ürünüm var, satmak istiyorum" formu doldurabilir (`/urun-sat`).

### Mağaza Sahibi / Admin
- `/admin` panelinden ürün ekler, düzenler, siler.
- Fotoğraf yükler (Cloudinary'e direkt).
- Ürünü "Öne Çıkan" yapabilir.
- Satış taleplerini görüntüler ve durum günceller.

---

## 3. Teknik Stack — Neden Bu Seçimler?

| Teknoloji | Neden |
|---|---|
| **Next.js 14 App Router** | SSR ile SEO-hazır HTML, ISR ile 60sn'de otomatik güncelleme |
| **Firebase Firestore** | Realtime DB kurulum gerektirmiyor, küçük ölçek için maliyet-etkin |
| **Firebase Auth** | Email/password ile tek kişilik admin için yeterli |
| **Cloudinary** | Görsel optimizasyon (format dönüşümü, boyut), CDN dahil |
| **Tailwind CSS** | Mevcut CSS üzerine eklendi (preflight kapalı), ikisi birlikte çalışıyor |
| **framer-motion** | Hover efektleri, skeleton animasyonu — native CSS'ten daha ifadeli |
| **Vercel** | Next.js native deploy, env var yönetimi kolay |

---

## 4. Proje Mimarisi — Büyük Resim

```
Kullanıcı Ziyareti
       │
       ▼
  Next.js Server
  app/page.tsx  ──────────────── getProducts() ──── Firestore (cache: 60s)
       │                              │
       │ initialProducts prop         │ In-memory cache
       ▼                              │ (sayfa yenilenene kadar kalır)
  ProductsClient.tsx (Client)         │
       │                              │
  [useMemo filtrele & sırala]         │
       │                              │
  ProductCard × N ──── /urun/[slug] ──┘
       │
  WhatsApp Linki
       │
  ✅ Satış gerçekleşir (site dışında)
```

### Server / Client Sınırı

```
Server Components:
  app/page.tsx            → ürünleri Firestore'dan çeker, HTML üretir
  app/urun/[slug]/page.tsx → metadata, product schema, SSR
  app/layout.tsx          → global meta, JSON-LD schema'lar

Client Components ('use client'):
  app/ProductsClient.tsx       → filtreleme state'i, sıralama
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
  title: string;           // "İkinci El Koltuk Takımı"
  slug: string;            // "ikinci-el-koltuk-takimi" — URL'de kullanılır
  priceTRY: number;        // 4500
  category: Category;      // 'Mobilya' | 'Beyaz Eşya' | 'Elektronik' | ...
  condition: 'Sıfır' | '2. El';
  inStock: boolean;        // false olunca "Satıldı" overlay çıkar
  featured?: boolean;      // Öne Çıkan badge + sıralamada üste
  tags: string[];          // ["koltuk", "3+2+1", "gri"] — arama & filtre
  shortDesc: string;       // Kart altında kısa açıklama
  description: string;     // Detay sayfasında uzun açıklama (HTML olabilir)
  images: string[];        // Cloudinary public_id'leri: ["umit-spot/urunler/abc123"]
  specs: Record<string, string>; // { "Renk": "Gri", "Ölçü": "250x90" }
  createdAt: number;       // Date.now() — sıralama için
  updatedAt: number;
}
```

**Önemli:** Kod içinde `as any` kullanılarak eski field adlarına da bakılır:
- `title` → fallback: `baslik`, `isim`, `name`
- `priceTRY` → fallback: `price`, `fiyat`
- `category` → fallback: `kategori`
- `condition` → fallback: `durum`
- `inStock` → fallback: `stok`, `stock`
Bu sayede Firestore'daki eski veri formatları bozulmadan çalışmaya devam eder.

### SatisTalebi (Firestore: `satis_talepleri`)

```typescript
{
  id?: string;
  name: string;       // "Ahmet Yılmaz"
  phone: string;      // "0532 xxx xx xx"
  category: string;   // Hangi tür eşya
  itemName: string;   // "Koltuk takımı"
  condition: string;  // "İyi durumda"
  price?: string;     // İstenen fiyat (opsiyonel)
  description?: string;
  createdAt: number;
  status: 'yeni' | 'incelendi' | 'reddedildi';
}
```

### AdminUser (Firestore: `users/{uid}`)

```typescript
{
  role: 'admin';
  email: string;
}
```

Admin rolü Firebase Custom Claims değil, Firestore'da `users/{uid}.role === 'admin'` kontrolü ile yapılıyor. Bu hem basit hem de admin panelinde dinamik olarak kontrol edilebilir.

---

## 6. Cache Sistemi

`lib/products.ts` içinde basit ama önemli bir in-memory cache var:

```
İlk istek → Firestore → _cache'e yaz + _cacheTime = now
Sonraki istekler (60s içinde) → Firestore'a gitme, _cache'den dön
Admin CRUD işlemi → invalidateCache() → _cache = null
60s sonra → bir sonraki getProducts() yeniden Firestore'a gider
```

**Dikkat:** Bu cache, Next.js Server Component revalidation (ISR) ile **ayrı ve iç içe** çalışır:
- `app/page.tsx`'de `export const revalidate = 60;` var → Next.js 60s'de sayfayı yeniden render eder.
- Render sırasında `getProducts()` çağrılır → eğer in-memory cache hâlâ tazelese, Firestore'a gitmez.
- Admin ürün güncellerse `invalidateCache()` çağrılır → bir sonraki sayfa render'ı Firestore'dan taze veri alır.

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
       │
       └─ Çıkış yaptıysa → isAdmin = false
```

Admin koruması şu an `useAuth()` hook'u ile component seviyesinde yapılıyor. Route-level middleware yok. Yani `/admin` URL'sine direkt giren biri sayfa içeriğini görebilir ama Firestore write'larını yapamaz (security rules engeller).

**Geliştirme notu:** İleriye yönelik olarak `middleware.ts` eklenip `/admin` prefix'i token kontrolüyle korunabilir.

---

## 8. Görsel Sistemi (Cloudinary)

Görseller Cloudinary'de `umit-spot/urunler/` klasöründe saklanır.

İki helper fonksiyon:
```typescript
cloudinaryUrl(publicId, 'f_auto,q_auto,w_900,h_700,c_fill')
// → https://res.cloudinary.com/dshbqbtpb/image/upload/f_auto,q_auto,w_900,h_700,c_fill/umit-spot/urunler/abc

cloudinaryThumb(publicId)
// → 600x500 kırpılmış versiyon (kart görselleri için)
```

`f_auto` → tarayıcıya göre WebP/AVIF seçer.
`q_auto` → Cloudinary kalite optimize eder.
`c_fill` → aspect ratio bozmadan kırpar.

Görsel URL'si `http` ile başlıyorsa doğrudan kullanılır (harici URL desteği).

---

## 9. SEO Mimarisi

Bu proje SEO'ya özellikle önem veriyor. Üç katmanlı bir yapı var:

### Katman 1: Next.js Metadata API
`app/layout.tsx` → Tüm site için temel meta, OpenGraph, Twitter Card, canonical URL.
`app/urun/[slug]/page.tsx` → Her ürün için dinamik meta (başlık, fiyat, görsel).

### Katman 2: JSON-LD Schema (Structured Data)
`app/layout.tsx` içinde:
- `FurnitureStore` schema → Google'a işletme bilgisi (adres, telefon, çalışma saatleri, hizmet bölgeleri)
- `FAQPage` schema → "Esenyurt'ta ikinci el mobilya nereden alınır?" gibi soru-cevaplar

`app/urun/[slug]/page.tsx` içinde:
- `Product` schema → her ürün için fiyat, stok durumu, koşul (yeni/kullanılmış)

### Katman 3: sitemap.ts & robots.ts
`app/sitemap.ts` → Tüm ürünleri dinamik olarak sitemap'e ekler.
`app/robots.ts` → Crawl yönetimi.

**AI Agentler için not:** Yeni bir sayfa eklerken `generateMetadata` ve ilgili JSON-LD schema'yı da eklemeyi unutma.

---

## 10. Tasarım Sistemi

### Renk Paleti
```css
--bg: #0b0f14          /* Ana arka plan — derin lacivert-siyah */
--surface: #101824      /* Kart/panel arka planı */
--card: #101824         /* ProductCard arka planı */
--border: rgba(255,255,255,0.07)  /* Çok ince kenarlıklar */
--text: #e6edf3         /* Ana metin — kırık beyaz */
--muted: #7d8590        /* İkincil metin — gri */
--accent: #25D366       /* WhatsApp yeşili — CTA rengi */
--accent2: #2f81f7      /* Mavi — tag rengi, hover efektleri */
--danger: #f85149       /* Hata/silme */
```

### Yazı Tipleri
- `Outfit` (display/başlık) → `var(--font-display)` veya `font-family: 'Outfit'`
- `Inter` (body) → varsayılan

### CSS Yaklaşımı — Hibrit Model
İki stil sistemi paralel çalışıyor:

1. **Global CSS sınıfları** (`app/globals.css`):
   `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
   `.card`, `.container`, `.products-grid`, `.badge`
   `.admin-*` prefix'li admin panel sınıfları

2. **Tailwind utility sınıfları**:
   `bg-accent`, `text-surface`, `rounded-lg` vb.
   Tailwind renkleri CSS değişkenlerine bağlı: `bg-accent` = `var(--accent)`

3. **Component-scoped `<style>` blokları**:
   Her büyük component kendi CSS'ini `<style>` tag'i içinde taşıyor.
   Örnek: `ProductCard.tsx` → `.pro-card`, `.pro-badge`, `.pro-card-img-wrap` vb.

**Kural:** Yeni stil eklerken hangi katman uygunsa onu kullan. Global tekrar kullanılacak şeyler → `globals.css`. Tek komponente özel → `<style>` bloğu. Hızlı utility → Tailwind.

### Animasyonlar
- `framer-motion`: `ProductCard` hover (y: -5, spring), `ProductDetailClient` lightbox, skeleton loading
- CSS: `@keyframes shimmer` (skeleton), `@keyframes dot-blink` (WhatsApp dot), `float` (hero)

---

## 11. Sayfa Akışları

### Ana Sayfa (`/`)
```
Server: getProducts() → ISR 60s
  → HeroSection (ürün sayısını gösterir)
  → ProductsClient (filtreleme/sıralama, tüm mantık client-side)
    → FilterBar (arama, kategori, durum, stok, fiyat aralığı)
    → products-grid (.products-grid CSS class)
      → ProductCard × N
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
    → Fiyat, durum, stok badge
    → Teknik özellikler tablosu (specs)
    → WhatsApp butonu (whatsappLink() ile ürüne özel mesaj)
    → Benzer ürünler (varsa)
```

### Admin Paneli (`/admin/*`)
```
AuthProvider → useAuth() → isAdmin kontrolü

/admin            → Dashboard (stats: toplam/stokta/sıfır/2.el)
/admin/products   → Ürün listesi (düzenle/sil/öne çıkar/stok toggle)
/admin/products/new → ProductForm (yeni ürün)
/admin/products/[id] → ProductForm (düzenleme modu)
/admin/satis-talepleri → Müşteri satış talepleri listesi + durum güncelleme
/admin/login      → signInWithEmailAndPassword
```

### Ürün Sat (`/urun-sat`)
```
Müşteri formu → saveSatisTalebi() → Firestore satis_talepleri koleksiyonu
Admin → /admin/satis-talepleri'den görür → updateSatisTalebiStatus()
```

---

## 12. Yeni Özellik Eklerken

### Yeni Ürün Alanı Eklemek
1. `types/index.ts` → `Product` interface'ine ekle
2. `components/ProductForm.tsx` → form field ekle
3. `components/ProductCard.tsx` → gösterim mantığına ekle (fallback ile)
4. `app/urun/[slug]/ProductDetailClient.tsx` → detay sayfasına ekle
5. Filter'a da girmesini istiyorsan → `types/index.ts` `FilterState`'i güncelle, `app/ProductsClient.tsx` filter mantığına ekle, `components/FilterBar.tsx` UI ekle

### Yeni Kategori Eklemek
`types/index.ts` → `Category` union type + `CATEGORIES` array → her yerde otomatik yansır.

### Yeni Admin Sayfası Eklemek
`app/admin/[yeni-sayfa]/page.tsx` → `useAuth()` ile isAdmin kontrolü yap, admin layout (`app/admin/layout.tsx`) otomatik uygulanır.

### WhatsApp Numarasını Değiştirmek
`lib/products.ts` → `whatsappLink()` fonksiyonunda `905426447296`
`app/page.tsx` → contact section'daki href'te `905426447296`
`components/WhatsAppFloat.tsx` → sabit WhatsApp butonu href'inde
`app/layout.tsx` → `localBusinessSchema.telephone`

---

## 13. Kritik Davranışlar & Tuzaklar

### Hydration Mismatch
`lib/auth-context.tsx`'de `mounted` state var. Server'da auth state belirsiz olduğundan, ilk render'da `loading: true` döner. Bu `suppressHydrationWarning` ile birlikte çalışır. Auth state'ini erken okuyan componentler `loading` kontrolü yapmalı.

### Cache Invalidation
Admin panel CRUD işlemi sonrası `invalidateCache()` çağrılıyor. Ama Next.js ISR cache ayrı — `revalidatePath('/')` henüz eklenmemiş. Bu şu anlama gelir: admin ürün güncellediğinde:
- Client-side görünüm anında güncellenir (invalidateCache sayesinde)
- Ama başka bir kullanıcının tarayıcısında `/` sayfası 60 saniye sonra güncellenir (ISR)

### Resim Fallback
`ProductCard.tsx`'de `imgError` state var. Resim yüklenemezse emoji fallback (🛋️) gösterilir.

### Slug vs ID
Ürün detay sayfası hem slug'a hem ID'ye göre çalışır (önce slug dener, başarısız olursa ID ile dener). Bu, eski linklerin çalışmaya devam etmesini sağlar.

### TypeScript `as any` Kullanımı
Bilinçli bir karar. Firestore'dan gelen veride alan adı tutarsızlıkları olduğundan, `as any` ile tüm olası alan adlarına bakılıyor. Yeni alan eklendiğinde bu pattern'e uymak lazım.

---

## 14. Deployment

```
GitHub → Vercel (otomatik deploy)
   │
   ├── main branch push → production deploy
   └── .env.local değişkenleri → Vercel dashboard'a elle girilmeli
```

Environment variables Vercel'de:
- `NEXT_PUBLIC_*` prefix'liler → browser'da da erişilebilir (Firebase web config, Cloudinary)
- `CLOUDINARY_API_KEY` → sadece server-side

Google Analytics opsiyonel: `NEXT_PUBLIC_GA_ID` env var'ı varsa `gtag.js` otomatik yüklenir.

---

## 15. Mağaza Bilgileri (Hardcoded değerler)

Bu bilgiler kod içinde çeşitli yerlerde geçiyor, bir yerden değiştirilmesi **hepsini** güncellemiyor:

| Bilgi | Değer |
|---|---|
| Telefon | 0542 644 72 96 → `+905426447296` |
| Adres | Mehmet Akif Ersoy Mah. 1824 Sk. 11A, Esenyurt/İstanbul |
| Site URL | `https://umit-spot.vercel.app` |
| Çalışma saatleri | Her gün 09:00 – 00:00 |
| Cloudinary cloud | `dshbqbtpb` |
| Cloudinary preset | `spot_urun` |

Bunları değiştirirken grep ile tüm dosyalarda ara:
- Telefon: `905426447296`
- Site URL: `umit-spot.vercel.app`
- Cloudinary: `dshbqbtpb`
