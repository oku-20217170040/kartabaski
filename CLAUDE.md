# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start development server (localhost:3000)
npm run build         # Production build
npm run lint          # Run ESLint
npm run start         # Start production server
npm test              # Run Jest unit tests
npm run test:watch    # Jest in watch mode
npm run test:coverage # Jest with coverage report
npm test -- --testPathPattern=product-utils  # Run a single test file
```

## Architecture

**Ümit Spot** is a second-hand electronics marketplace (Next.js 14 App Router + Firebase + Cloudinary).

### Data Flow

- `app/page.tsx` (Server Component) calls `lib/products.ts` → Firestore, wrapped with `unstable_cache` (tags: `['products']`) for serverless-safe caching
- When a product is created/updated/deleted, `revalidateTag('products')` is called via Server Actions in `lib/actions.ts` — cache invalidates instantly
- Product images are hosted on Cloudinary; use `cloudinaryUrl()` and `cloudinaryThumb()` helpers from `lib/products.ts`
- WhatsApp inquiry links are generated via `whatsappLink()` in `lib/products.ts`
- Client-side filtering/sorting/pagination (12 items/page) is handled in `app/ProductsClient.tsx`

### Data Validation

- All Firestore documents are validated at runtime using **Zod** schemas defined in `lib/schemas.ts`
- `ProductSchema` uses `.passthrough()` to allow alias fields (baslik, fiyat, etc.) and `.catch()/.default()` to tolerate missing/invalid values
- `safeParse()` is used throughout — invalid documents are logged with `console.warn` and skipped, never crash the app
- Never use `as any` to read product fields — use the typed helpers from `lib/product-utils.ts` (`getTitle`, `getPrice`, `getCategory`, etc.)

### Auth & Admin

- `lib/auth-context.tsx` provides `AuthProvider` + `useAuth()` hook — wraps the entire app in `app/layout.tsx`
- On login, Firebase ID token is stored in an HttpOnly cookie via `POST /api/auth/session`; cleared on logout via `DELETE /api/auth/session`
- `middleware.ts` protects all `/admin/*` routes server-side — checks for `__session` cookie before rendering, redirects to `/admin/login` if missing
- Admin role is stored in Firestore `users/{uid}` collection (not Firebase Custom Claims)
- Admin routes live under `app/admin/` — check `useAuth().isAdmin` for access control
- Login is email/password via Firebase Auth

### Server Actions

- All product/satış talebi mutations go through `lib/actions.ts` (`'use server'`)
- Each action calls the underlying Firebase function then `revalidateTag('products')` or `revalidateTag('satis-talepleri')`
- Admin client components import and call these actions directly — never call Firebase mutation functions directly from client code
- Available actions: `createProductAction`, `updateProductAction`, `deleteProductAction`, `toggleFeaturedAction`, `deleteSatisTalebiAction`, `updateSatisTalebiStatusAction`

### Image Uploads & Deletion

- File uploads go through `POST /api/upload` (server-side) — never upload directly from the client
- Image deletion goes through `POST /api/cloudinary-delete` (server-side) — never call Cloudinary delete API from the client
- The API route validates file type (image only) and size (max 10 MB), then signs the request with `CLOUDINARY_API_SECRET` before forwarding to Cloudinary
- Never add `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — preset is handled server-side only
- `lib/products-admin.ts` (`'server-only'`) contains admin-specific Firestore operations that also handle Cloudinary image cleanup on product deletion

### Error Handling

- `components/ErrorBoundary.tsx` — React class component, wraps the app in `app/layout.tsx`
- `app/error.tsx` — Next.js global error page, reports to Sentry via `captureException`
- `app/not-found.tsx` — Custom 404 page with navigation options
- Sentry is configured in `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

### Firestore Collections

| Collection | Purpose |
|---|---|
| `products` | All product listings |
| `users` | Admin role assignments |
| `satis_talepleri` | Customer sell requests |
| `seo_settings` | Single document `main` — editable SEO config (service areas, keywords, etc.) managed via `lib/seo-settings.ts` |

### Styling

- Hybrid approach: **CSS custom properties** (defined in `app/globals.css`) + **Tailwind CSS** classes
- Tailwind's `preflight` is disabled — existing CSS is not reset
- Dark industrial theme; use CSS vars like `--accent` (`#25D366`), `--accent2` (`#2f81f7`), `--surface` (`#101824`)
- Tailwind color tokens map to these CSS vars (e.g., `bg-accent`, `text-surface`)
- Use `cn()` from `lib/utils.ts` for conditional class merging

### Product Data Fields

Products support multilingual/alias fields: `title` or `baslik`, `priceTRY`/`price`/`fiyat`, `category`/`kategori`, `condition`/`durum`, `inStock`/`stok`.

Valid categories: `Mobilya`, `Beyaz Eşya`, `Elektronik`, `Ofis`, `Yatak`, `Dekorasyon`, `Aydınlatma`, `Bahçe`, `Ev Eşyaları`, `Diğer`.

Zod schemas in `lib/schemas.ts` handle normalization at the data layer. Typed helpers in `lib/product-utils.ts` handle alias resolution at the UI layer.

### Constants

Phone number and WhatsApp base URL live in `lib/constants.ts` (reads from `NEXT_PUBLIC_PHONE` env var). Never hardcode `905426447296` anywhere in the codebase.

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `NEXT_PUBLIC_PHONE` — Contact phone number (e.g. `905426447296`)
- `NEXT_PUBLIC_PHONE_DISPLAY` — Human-readable display (e.g. `0542 644 72 96`)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name
- `CLOUDINARY_API_KEY` — Cloudinary API key (server-side)
- `CLOUDINARY_API_SECRET` — Cloudinary API secret (server-side, required for signed uploads)
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry DSN for error tracking
- `SENTRY_ORG` / `SENTRY_PROJECT` — Sentry organization and project slugs

### Public Pages

| Route | Purpose |
|---|---|
| `/` | Home — product listing with filters/pagination |
| `/urun/[slug]` | Product detail page (SSR, slug is Firestore doc ID) |
| `/urun-sat` | Customer sell request form (writes to `satis_talepleri`) |
| `/kategoriler` | Category index page |
| `/hakkimizda` | About page |

`app/sitemap.ts` and `app/robots.ts` auto-generate SEO sitemap and robots.txt.

### Image Optimization

`next.config.js` allows remote images only from `res.cloudinary.com/dshbqbtpb/**`.

### Testing

- Jest + React Testing Library configured in `jest.config.ts`
- Unit tests live in `__tests__/` mirroring the `lib/` structure
- `__tests__/lib/product-utils.test.ts` — 40 tests, 100% statement coverage for all typed helpers
- Run `npm test` before pushing changes that touch `lib/product-utils.ts` or `lib/schemas.ts`
