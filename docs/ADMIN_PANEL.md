# Yönetim paneli ve otomasyonlar (Kasım 2026)

Ümit Spot panelinin mimarisi KAR-TA BASKI'ya uyarlandı. Menü: `lib/admin-nav.ts`.

| Rota | Modül | Ana dosyalar |
|---|---|---|
| `/admin` | Genel Bakış | `app/admin/page.tsx` (tüm modüllerin özet action'ları) |
| `/admin/istatistik` | Site analitiği + Search Console | `lib/analytics-*`, `app/api/track`, `components/SiteTracker.tsx` |
| `/admin/muhasebe` | Satış defteri, giderler, tekrarlayan giderler | `lib/finance*`, `lib/expenses.ts`, `lib/recurring.ts` |
| `/admin/makine` | Üretim hattı: yeni → tasarım → baskı → paketleme → kargoda → teslim | `lib/orders*`, `lib/machine*` |
| `/admin/studio` | AI Stüdyo (Photoroom) | `lib/studio*`, `lib/photoroom.ts` |
| `/admin/sepet-talepleri` | Sepetten WhatsApp'a gelen talepler, "Makineye aktar" | `lib/cart*`, `app/sepet` |
| `/admin/yorumlar` | Davet bağlantılı müşteri yorumları | `lib/reviews*`, `app/yorum/[token]` |
| `/admin/sosyal-medya` + 6 platform | Instagram, Facebook, Threads, Telegram, Pinterest, TikTok | `lib/social-run.ts`, `lib/*-auto.ts` |
| `/admin/blog` | Blog + otomatik taslak/yayın | `lib/posts.ts`, `lib/blog-*` |
| `/admin/seo` | Varsayılan meta, anahtar kelimeler, doğrulama kodları | `lib/seo-*` |

## Otomasyon
- Tek kapı: `GET /api/cron/main` (blog → makine → 6 sosyal platform). `CRON_SECRET` zorunlu (`Authorization: Bearer …`), yoksa 401.
- Tetikleyici: `.github/workflows/otomasyon-cron.yml` (30 dakikada bir, TSİ 07:00–00:30). GitHub'a `CRON_SECRET` secret'ı eklenmeli.
- Sosyal platformlar varsayılan **kapalı**; token girildikten sonra Merkez'den açılır.

## Ortam değişkenleri (sunucu `.env`)
Hepsi isteğe bağlı; eksik olan modül "bağlı değil" gösterip atlanır.
- Genel: `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (yönetici bildirimleri)
- Blog: `GEMINI_API_KEY` (yoksa şablonla üretir), `GEMINI_MODEL`, `BLOG_AUTO_GENERATE=0`, `BLOG_AUTO_PUBLISH=0`
- AI Stüdyo: `PHOTOROOM_LIVE_API_KEY`, `PHOTOROOM_SANDBOX_API_KEY`
- Instagram: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`
- Facebook: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`
- Threads: `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`
- Telegram kanalı: `TELEGRAM_CHANNEL_ID`
- Pinterest: `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` (OAuth: `/api/pinterest/connect`)
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` (OAuth: `/api/tiktok/connect`)
- Search Console: mevcut `FIREBASE_ADMIN_*` hizmet hesabı Search Console'a kullanıcı olarak eklenmeli.

Kurulum ayrıntıları: `docs/SOSYAL_MEDYA_KURULUM.md` (Meta), `docs/SOSYAL_MEDYA_KURULUM_2.md` (Telegram/Pinterest/TikTok).

## Firestore
Yeni koleksiyonların hepsi yalnızca Admin SDK ile erişilir; `firestore.rules` varsayılan "deny" ile kapalı kalır, kural eklemeye gerek yok.
