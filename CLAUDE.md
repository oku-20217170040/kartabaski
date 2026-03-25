# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

No test suite is configured.

## Architecture

**Ümit Spot** is a second-hand electronics marketplace (Next.js 14 App Router + Firebase + Cloudinary).

### Data Flow

- `app/page.tsx` (Server Component) calls `lib/products.ts` → Firestore, then passes data to `app/ProductsClient.tsx` (Client Component) for filtering/sorting
- `lib/products.ts` has an **in-memory cache** (60s TTL) to reduce Firestore reads — always use its exported functions, never query Firestore directly
- Product images are hosted on Cloudinary; use `cloudinaryUrl()` and `cloudinaryThumb()` helpers from `lib/products.ts`
- WhatsApp inquiry links are generated via `whatsappLink()` in `lib/products.ts`

### Auth & Admin

- `lib/auth-context.tsx` provides `AuthProvider` + `useAuth()` hook — wraps the entire app in `app/layout.tsx`
- Admin role is stored in Firestore `users/{uid}` collection (not Firebase Custom Claims)
- Admin routes live under `app/admin/` — check `useAuth().isAdmin` for access control
- Login is email/password via Firebase Auth

### Firestore Collections

| Collection | Purpose |
|---|---|
| `products` | All product listings |
| `users` | Admin role assignments |
| `satis_talepleri` | Customer sell requests |

### Styling

- Hybrid approach: **CSS custom properties** (defined in `app/globals.css`) + **Tailwind CSS** classes
- Tailwind's `preflight` is disabled — existing CSS is not reset
- Dark industrial theme; use CSS vars like `--accent` (`#25D366`), `--accent2` (`#2f81f7`), `--surface` (`#101824`)
- Tailwind color tokens map to these CSS vars (e.g., `bg-accent`, `text-surface`)
- Use `cn()` from `lib/utils.ts` for conditional class merging

### Product Data Fields

Products support multilingual/alias fields: `title` or `baslik`, `priceTRY`/`price`/`fiyat`, `category`/`kategori`, `condition`/`durum`, `inStock`/`stok`.

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web SDK config
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — Cloudinary uploads
- `CLOUDINARY_API_KEY` — Server-side Cloudinary operations

### Image Optimization

`next.config.js` allows remote images only from `res.cloudinary.com/dshbqbtpb/**`.
