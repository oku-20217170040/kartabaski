# CLAUDE.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Commands

```bash
npm run dev           # Start development server (localhost:3000)
npm run build         # Production build
npm run lint          # Run ESLint
npm run start         # Start production server
npm test              # Run Jest unit tests
npm run test:watch    # Jest in watch mode
npm run test:coverage # Jest with coverage report
```

## Güncel durum ve devir (ÖNCE OKU)

- Yarım kalan iş ve sıradaki adımlar: `docs/DEVAM_NOTLARI.md`
- Admin paneli modülleri, otomasyon (`/api/cron/main`) ve env listesi: `docs/ADMIN_PANEL.md`
- Canlıya alma (Oracle Docker): `docs/YAYIN.md` ve `docs/DEVAM_NOTLARI.md` bölüm 5

## Kurallar

- **Commit mesajları her zaman Türkçe yazılmalıdır.** Örnek: `git commit -m "Ürün detay sayfasına zoom özelliği eklendi"`

## Architecture

**KAR-TA BASKI** is an online mug printing (kupa baskı) catalog and order site (Next.js 14 App Router + Firebase + Cloudinary).
No cart or checkout — all sales happen via WhatsApp.

### Data Flow

- `app/page.tsx` (Server Component) calls `lib/products.ts` → Firestore, wrapped with `unstable_cache` (tags: `['products']`)
- When a product is created/updated/deleted, `revalidateTag('products')` is called via Server Actions in `lib/actions.ts`
- Product images are hosted on Cloudinary; use `cloudinaryUrl()` and `cloudinaryThumb()` helpers from `lib/products.ts`
- Pure helpers (`cloudinaryUrl`, `cloudinaryThumb`, `formatPriceRange`, `whatsappLink`) live in `lib/format.ts` (re-exported from `lib/products.ts`); site URL in `lib/site.ts` (`SITE_URL`)
- Sitemap uses `getProductsServer()` (Admin SDK) because Firestore rules deny public reads
- Client-side filtering/sorting/pagination (12 items/page) is handled in `app/ProductsClient.tsx`

### Data Validation

- All Firestore documents are validated at runtime using **Zod** schemas defined in `lib/schemas.ts`
- Legacy category names (`Seramik Nescafe Fincanı`, `Nescafe Fincanı`) are mapped to the new ones; unknown categories fall back to `Özel Tasarım` with a `console.warn`
- `ProductSchema` uses `.passthrough()` to allow alias fields and `.catch()/.default()` to tolerate missing/invalid values
- `safeParse()` is used throughout — invalid documents are logged with `console.warn` and skipped
- Never use `as any` to read product fields — use the typed helpers from `lib/product-utils.ts`

### Auth & Admin

- `lib/auth-context.tsx` provides `AuthProvider` + `useAuth()` hook — wraps the entire app in `app/layout.tsx`
- On login, Firebase ID token is stored in an HttpOnly cookie via `POST /api/auth/session`
- `middleware.ts` protects all `/admin/*` routes server-side (redirects to `/admin/login` if no `__session` cookie)
- Admin role is stored in Firestore `users/{uid}` collection — `role: 'admin'`
- Admin routes live under `app/admin/`

### Server Actions

- All product mutations go through `lib/actions.ts` (`'use server'`)
- Each action calls the underlying Firebase function then `revalidateTag('products')`
- Available actions: `createProductAction`, `updateProductAction`, `deleteProductAction`, `toggleFeaturedAction`

### Image Uploads & Deletion

- File uploads go through `POST /api/upload` (server-side, signed Cloudinary upload)
- Image deletion goes through `POST /api/cloudinary-delete` (server-side)
- Images are stored in Cloudinary folder: `karta-baski/urunler/`
- `lib/products-admin.ts` (`'server-only'`) contains admin-specific Firestore operations

### Error Handling

- `components/ErrorBoundary.tsx` — React class component, wraps the app
- `app/error.tsx` — Next.js global error page
- `app/not-found.tsx` — Custom 404 page
- Sentry is configured in `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

### Firestore Collections

| Collection | Purpose |
|---|---|
| `products` | All product listings |
| `users` | Admin role assignments (`role: 'admin'`) |
| `siparis_talepleri` | Cart orders (Admin SDK only, `lib/siparis.ts`); images are Cloudinary `authenticated` |

### Firestore Security Rules

Rules are defined in `firestore.rules`. The `isAdmin()` helper checks `users/{uid}.role == 'admin'`.
These rules must be deployed via Firebase Console (Firestore → Rules tab).

### Styling

- Storefront design system ("Tabela") lives in `app/site.css` (plain CSS, loaded from `app/layout.tsx`): white background, near-black ink, flat colours taken from mug handles (`--brand` cobalt, `--sun`, `--red`, `--navy`, …). No gradients, paper textures, cream backgrounds, pill badges, mono "eyebrow" labels, 01/02/03 index numbers or italic accent words. Reuse its classes (`.btn`, `.section`, `.page-head`, `.product-grid`, `.pdp-*`, …) instead of inline styles; never add hardcoded hex colours in components (the hero palette lives in `lib/vitrin.ts`)
- One font family via fontsource: Archivo variable (`--sans`; `--serif` is a legacy alias). Hierarchy comes from the width axis: headings expanded (`font-stretch` 112–125%), prices and the phone number condensed (62–72%). Shantell Sans (`--hand`) only for the handwriting option in the hero
- Copy is plain, concrete Turkish addressing the visitor as "siz"; no invented workshop jargon ("kalıp", "atölye seçkisi", "prova")
- Homepage hero: real cut-out mug photos in `public/vitrin/` + canvas print preview (`components/MugPreview.tsx`); handle colour changes the whole hero colour. The visitor can drag / scale / rotate their photo (`lib/photo-layout.ts`) and remove its background in the browser (`lib/remove-background.ts`, U-2-Net `public/models/u2netp.onnx`; `public/ort/` is copied by `tools/copy-ort.mjs` before dev/build). Photos leave the browser only when the order is created on `/sepet`. The print-sample mosaic (`components/PrintWall.tsx`) uses the `b-*` images there
- 3D mug preview (`components/mug3d/`, specs in `lib/mug3d.ts`, three.js loaded lazily via `Mug3DLazy`), used in `/tasarla` and `/konfigurator`. All 11 catalogue shapes have a model measured from the product photo and matched by the start of the product title (`mugModelFor`); unknown titles fall back to the product photo. The flat print template (`lib/mug-print.ts`) is shared by 2D and 3D
- Two-sided printing: a cart line / order line keeps the front side in its own fields and the back side in `back` (absent = single side). Side ids and labels in `lib/design-sides.ts`; server rules (`lineSides`, `lineFiles`, `uploadsComplete`) in `lib/siparis-types.ts`; upload kinds are `photo` (front), `back`, `preview`; 8 photos per line across both sides
- Delivery address on `/sepet`: `components/address/` (searchable il / ilçe / mahalle pickers, manual entry fallback, postal code, other recipient, corporate invoice), rules in `lib/address.ts` and `contactShape` (`lib/siparis-types.ts`). The lists in `public/adres/` are generated by `tools/adres-verisi.mjs` from turkiye-api (MIT) data; never hand-edit them. Address parts, recipient and invoice are removed in `customerView`
- Admin order detail (`app/admin/siparisler/[token]/`): a "next step" card driven by the pure `nextStep()` (`lib/siparis-takip.ts`), then one `PrintCard` per line with large quantity, copyable text, photo downloads, optional 3D, and per side a 2400px print template drawn with `drawPrint` using the customer's placement (background removed when requested), downloadable as PNG, optionally mirrored
- Admin styles live in `app/admin/admin.css`, scoped under `.admin-layout` / `.adm-login`
- Admin on phones (`app/admin/mobile.css`, ≤860px): bottom tab bar (`.adm-tabbar`), fixed `.adm-savebar` on long forms (`.is-solo` / `.is-pair`), bottom-sheet modals, order detail tabs "Baskı / Süreç / Müşteri" and action bar (`.sip-tabs`, `.sip-bar`), statistics tables turn into cards via `td[data-label]`. New admin pages must not overflow at 360px and need 44px tap targets
- Icons: inline SVG components in `components/icons.tsx` (storefront) and `components/admin/icons.tsx` — no emoji in UI
- Product names are shown through `displayTitle()` (`lib/format.ts`), which strips the "— Kişiye Özel Baskı" suffix and fixes ALL-CAPS titles
- Mobile is a hard requirement: no horizontal overflow at 360px, tap targets ≥ 44px, inputs 16px
- Use `cn()` from `lib/utils.ts` for conditional class merging

### Product Data Fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Ürün adı |
| `slug` | string | URL slug |
| `priceMin` | number | Minimum fiyat (TL) |
| `priceMax` | number | Maksimum fiyat (TL) |
| `category` | Category | Kupa kategorisi |
| `active` | boolean | Sitede görünür mü? |
| `featured` | boolean? | Öne çıkan ürün |
| `shortDesc` | string | Kısa açıklama |
| `description` | string | Detaylı açıklama |
| `images` | string[] | Cloudinary public_id listesi |
| `deliveryDays` | number | Kargo süresi (iş günü, varsayılan: 3) |
| `seoTags` | string[]? | Gizli SEO etiketleri |

Valid categories (source of truth: `lib/schemas.ts`): `Seramik Kahve Fincanı`, `Lüks Kupa`, `Kahve Fincanı`, `Latte Fincanı`, `Pro Kupa`, `Büyük Kupa`, `Sihirli Kupa`, `Özel Tasarım`, `Kurumsal`

### Price Helpers

- `formatPriceRange(priceMin, priceMax)` — "150₺'den başlayan" veya "150₺ – 350₺" formatında döndürür
- `getPriceMin(p)` / `getPriceMax(p)` — alias-tolerant helpers from `lib/product-utils.ts`

### WhatsApp

- `whatsappLink(productTitle?)` — ürüne özel veya genel sipariş mesajı linki oluşturur
- `DEFAULT_WA_TEXT` ve `PHONE` constants `lib/constants.ts`'de tanımlı
- Telefon: `905458266508`

### Constants

Phone number and WhatsApp base URL live in `lib/constants.ts` (reads from `NEXT_PUBLIC_PHONE` env var).
Never hardcode `905458266508` anywhere (outside `lib/constants.ts` fallback) in the codebase.

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `NEXT_PUBLIC_PHONE` — Contact phone number (`905458266508`)
- `NEXT_PUBLIC_PHONE_DISPLAY` — Human-readable display (`0545 826 65 08`)
- `NEXT_PUBLIC_SITE_NAME` — Site name (`KAR-TA BASKI`)
- `NEXT_PUBLIC_SITE_URL` — Production URL (`https://www.kartabaski.com`)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name (`dwulzfmlu`)
- `CLOUDINARY_API_KEY` — Cloudinary API key (server-side)
- `CLOUDINARY_API_SECRET` — Cloudinary API secret (server-side)
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry DSN for error tracking (optional)

### Public Pages

| Route | Purpose |
|---|---|
| `/` | Home — product listing with filters/pagination |
| `/urun/[slug]` | Product detail page (SSR, slug is Firestore doc ID) |
| `/kategoriler` | Category index page |
| `/nasil-siparis-verilir` | 3-step order guide page |
| `/hakkimizda` | About page |
| `/sepet` | Cart → creates the order |
| `/blog`, `/blog/[slug]` | Blog |
| `/yorum/[token]` | Customer review form (invite link) |
| `/tasarla/[slug]` | Design editor; adds a designed line to the cart (photos stay in IndexedDB) |
| `/siparis/[token]` | Order page; WhatsApp message carries only this link. A logged-in admin is redirected to `/admin/siparisler/[token]` (`?musteri=1` shows the customer view) |
| `/siparis-takip` | Order lookup by code (`KB` + 11 chars): status, cargo and item summary only — no name, phone, texts or photos (`publicOrder`). Photos and proof approval stay on `/siparis/[token]`; customers cannot delete orders themselves |
| `/gizlilik` | KVKK notice |

`app/sitemap.ts` and `app/robots.ts` auto-generate SEO sitemap and robots.txt.

### Admin Panel

| Route | Purpose |
|---|---|
| `/admin` | Dashboard with stats |
| `/admin/products` | Product list & management |
| `/admin/products/new` | Add new product |
| `/admin/products/[id]` | Edit existing product |
| `/admin/login` | Admin login |

Full module list (İstatistikler, Muhasebe, Makine, Ürün Fotoğrafları, Siparişler, Yorumlar, Sosyal Medya + 6 platform, Blog, SEO): see `docs/ADMIN_PANEL.md`. Menu config: `lib/admin-nav.ts`.

### Image Optimization

`next.config.js` allows remote images from `res.cloudinary.com/${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`.
Cloudinary cloud name is read from env variable, with fallback to `dwulzfmlu`.

### Deployment

| Platform | Purpose |
|---|---|
| **Oracle Cloud (Docker)** | Production hosting since Nov 2026 (`kartabaski.com`), see `docs/YAYIN.md` |
| **Vercel** | Former hosting (Hobby plan paused 11 Nov 2026) |
| **Railway** | Unused alternative (`railway.toml`) |
| **Firebase** | Auth + Firestore database (project: `kartabaski-fcf0e`) |
| **Cloudinary** | Image hosting & optimization (cloud: `dwulzfmlu`) |
| **Porkbun** | Domain registrar (`kartabaski.com`) |
| **GitHub** | Source code (`oku-20217170040/kartabaski`) |
