# Yönetim paneli ve otomasyonlar (Kasım 2026)

Ümit Spot panelinin mimarisi KAR-TA BASKI'ya uyarlandı. Menü: `lib/admin-nav.ts`.

| Rota | Modül | Ana dosyalar |
|---|---|---|
| `/admin` | Genel Bakış | `app/admin/page.tsx` (tüm modüllerin özet action'ları) |
| `/admin/istatistik` | Site analitiği + Search Console | `lib/analytics-*`, `app/api/track`, `components/SiteTracker.tsx` |
| `/admin/muhasebe` | Satış defteri, giderler, tekrarlayan giderler | `lib/finance*`, `lib/expenses.ts`, `lib/recurring.ts` |
| `/admin/makine` | Üretim hattı: yeni → tasarım → baskı → paketleme → kargoda → teslim | `lib/orders*`, `lib/machine*` |
| `/admin/studio` | Ürün Fotoğrafları: ürün eklenince 1+ fotoğraftan stüdyo çekimleri üretir (onaylı veya doğrudan ekleme) | `lib/photo-auto*`, `lib/image-gen/**` (sağlayıcı adaptörleri) |
| `/admin/sepet-talepleri` | Sepetten WhatsApp'a gelen talepler, "Makineye aktar" | `lib/cart*`, `app/sepet` |
| `/admin/yorumlar` | Davet bağlantılı müşteri yorumları | `lib/reviews*`, `app/yorum/[token]` |
| `/admin/sosyal-medya` + 6 platform | Instagram, Facebook, Threads, Telegram, Pinterest, TikTok | `lib/social-run.ts`, `lib/*-auto.ts` |
| `/admin/sosyal-medya/paylas` | Hızlı Paylaşım & Gönderi Havuzu: fotoğraf yükleyip (müşteri siparişi, ürün, atölye, kampanya) otomatik metinle bağlı tüm platformlarda anında veya sırayla yayınlama (+ isteğe bağlı ücretsiz stüdyo arka planı) | `lib/social-broadcast*`, `lib/actions-social-broadcast.ts` |
| `/admin/blog` | Blog + otomatik taslak/yayın | `lib/posts.ts`, `lib/blog-*` |
| `/admin/seo` | Varsayılan meta, anahtar kelimeler, doğrulama kodları | `lib/seo-*` |

## Otomasyon
- Tek kapı: `GET /api/cron/main` (blog → makine → ürün fotoğrafları → 6 sosyal platform). `CRON_SECRET` zorunlu (`Authorization: Bearer …`), yoksa 401.
- Tetikleyici: sunucu crontab'ı (`tools/sunucu/zamanlayici.sh`, 30 dakikada bir, TSİ 07:00–00:30). GitHub iş akışı yalnız elle çalıştırma içindir.
- Yönetim botu: `docs/TELEGRAM_BOTU.md`.
- Sosyal platformlar varsayılan **kapalı**; token girildikten sonra Merkez'den açılır.

## Ortam değişkenleri (sunucu `.env`)
Hepsi isteğe bağlı; eksik olan modül "bağlı değil" gösterip atlanır.
- Genel: `CRON_SECRET`, `TELEGRAM_BOT_TOKEN` (yönetim botu; hedef grup `/kur` ile bağlanır, `TELEGRAM_CHAT_ID` yalnız yedek hedef)
- Blog: `GEMINI_API_KEY` (yoksa şablonla üretir), `GEMINI_MODEL`, `BLOG_AUTO_GENERATE=0`, `BLOG_AUTO_PUBLISH=0`
- Ürün Fotoğrafları (biri yeter; panelden seçilir):
  - **Ücretsiz / kredi kartsız:** `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Cloudflare Workers AI günlük 10.000 ücretsiz neuron, varsayılan `@cf/black-forest-labs/flux-2-klein-4b`, isteğe bağlı `CLOUDFLARE_IMAGE_MODEL`), `HF_TOKEN` veya anahtarsız `HF_FREE_ANON=1` (Hugging Face ZeroGPU Space, varsayılan `black-forest-labs/FLUX.1-Kontext-Dev`, isteğe bağlı `HF_IMAGE_SPACE`).
  - **Ücretli / faturalandırmalı:** `GEMINI_API_KEY` (`GEMINI_IMAGE_MODEL`), `FAL_KEY` (Seedream/Flux, `FAL_IMAGE_MODEL`), `OPENAI_API_KEY` (`OPENAI_IMAGE_MODEL`), `REPLICATE_API_TOKEN` (`REPLICATE_IMAGE_MODEL`).
  - Yeni API eklemek: `lib/image-gen/providers/` altına bir adaptör + `registry.ts`'e bir satır.
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

## Siparişler (`/admin/siparisler`)

- Akış: "Tasarla ve sepete ekle" → `/tasarla/[slug]` → `/sepet` (ad, telefon, KVKK onayı) → fotoğraflar yüklenir → `/siparis/<anahtar>` → WhatsApp'a yalnız bağlantı.
- Sipariş `yeni` olunca rozet çıkar, Telegram yapılandırılmışsa bildirim gider. "Üretime aktar" Makine'de iş açar.
- Bağlantıya oturumu açık yönetici tıklarsa panele gider; müşteri görünümü için `?musteri=1`.
- Görseller Cloudinary `karta-baski/siparisler` içinde kapalı (`authenticated`) tutulur, yalnız `/api/siparis/<anahtar>/gorsel` üzerinden açılır.
- Cron (`orders` adımı): yarım yüklemeler 1 gün, tamamlanan/iptal siparişlerin fotoğrafları 30 gün sonra silinir.
- Takip: müşteri sayfasındaki çizelge üretim hattındaki aşamadan gelir (aşama sipariş ayrıntısından da ilerletilir). Baskı önizlemesi "Onaya gönder" ile eklenir; müşteri onaylar ya da düzeltme ister, rozet çıkar. Kargo firması / takip no / isteğe bağlı https bağlantı.
- Cron (`orderSync`): üretim hattında teslim/iptal olan siparişler kapanır; 30 günlük saklama süresi buradan başlar.
- Kod: `lib/siparis*.ts`, `lib/actions-siparis.ts`, `lib/cloudinary-private.ts`, `app/api/siparis/**`. Tasarım: `docs/superpowers/specs/2026-11-26-tek-sepet-design.md`.
