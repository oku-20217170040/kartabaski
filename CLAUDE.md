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

## Kurallar

- **Commit mesajları her zaman Türkçe yazılmalıdır.** Örnek: `git commit -m "Ürün detay sayfasına zoom özelliği eklendi"`

## Architecture

**KAR-TA BASKI** is an online mug printing (kupa baskı) catalog and order site (Next.js 14 App Router + Firebase + Cloudinary).
No cart or checkout — all sales happen via WhatsApp.

### Data Flow

- `app/page.tsx` (Server Component) calls `lib/products.ts` → Firestore, wrapped with `unstable_cache` (tags: `['products']`)
- When a product is created/updated/deleted, `revalidateTag('products')` is called via Server Actions in `lib/actions.ts`
- Product images are hosted on Cloudinary; use `cloudinaryUrl()` and `cloudinaryThumb()` helpers from `lib/products.ts`
- WhatsApp order links are generated via `whatsappLink()` in `lib/products.ts`
- Client-side filtering/sorting/pagination (12 items/page) is handled in `app/ProductsClient.tsx`

### Data Validation

- All Firestore documents are validated at runtime using **Zod** schemas defined in `lib/schemas.ts`
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

### Firestore Security Rules

Rules are defined in `firestore.rules`. The `isAdmin()` helper checks `users/{uid}.role == 'admin'`.
These rules must be deployed via Firebase Console (Firestore → Rules tab).

### Styling

- Hybrid approach: **CSS custom properties** (defined in `app/globals.css`) + **Tailwind CSS** classes
- Dark gold theme; use CSS vars like `--accent` (`#C9A84C` — gold), `--accent2` (`#ffffff`), `--surface` (`#111111`)
- Tailwind color tokens map to these CSS vars
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

Valid categories: `Sihirli Kupa`, `Klasik Kupa`, `Porselen Kupa`, `Nescafe & Latte Fincanı`, `Türk Kahvesi Fincanı`, `Fincan Seti`, `Kurumsal Sipariş`, `Özel Tasarım`, `Pro Kupa`, `Lüks Kupa`

### Price Helpers

- `formatPriceRange(priceMin, priceMax)` — "150₺'den başlayan" veya "150₺ – 350₺" formatında döndürür
- `getPriceMin(p)` / `getPriceMax(p)` — alias-tolerant helpers from `lib/product-utils.ts`

### WhatsApp

- `whatsappLink(productTitle?)` — ürüne özel veya genel sipariş mesajı linki oluşturur
- `DEFAULT_WA_TEXT` ve `PHONE` constants `lib/constants.ts`'de tanımlı
- Telefon: `905050874726`

### Constants

Phone number and WhatsApp base URL live in `lib/constants.ts` (reads from `NEXT_PUBLIC_PHONE` env var).
Never hardcode `905050874726` anywhere in the codebase.

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `NEXT_PUBLIC_PHONE` — Contact phone number (`905050874726`)
- `NEXT_PUBLIC_PHONE_DISPLAY` — Human-readable display (`0505 087 47 26`)
- `NEXT_PUBLIC_SITE_NAME` — Site name (`KAR-TA BASKI`)
- `NEXT_PUBLIC_SITE_URL` — Production URL (`https://kartabaski.com`)
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

`app/sitemap.ts` and `app/robots.ts` auto-generate SEO sitemap and robots.txt.

### Admin Panel

| Route | Purpose |
|---|---|
| `/admin` | Dashboard with stats |
| `/admin/products` | Product list & management |
| `/admin/products/new` | Add new product |
| `/admin/products/[id]` | Edit existing product |
| `/admin/login` | Admin login |

### Image Optimization

`next.config.js` allows remote images from `res.cloudinary.com/${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`.
Cloudinary cloud name is read from env variable, with fallback to `dwulzfmlu`.

### Deployment

| Platform | Purpose |
|---|---|
| **Vercel** | Primary production hosting (`kartabaski.com`) |
| **Railway** | Alternative deployment option |
| **Firebase** | Auth + Firestore database (project: `kartabaski-fcf0e`) |
| **Cloudinary** | Image hosting & optimization (cloud: `dwulzfmlu`) |
| **Porkbun** | Domain registrar (`kartabaski.com`) |
| **GitHub** | Source code (`oku-20217170040/kartabaski`) |
