# Devir notları — nerede kaldık

## Güncel durum (27 Kasım 2026)
Ayrıntılı kayıt: `docs/CALISMA_GUNLUGU.md`.
- Canlıda ve `main`'de: adres formu, sipariş yönetimi, sipariş koduyla takip, 3D kupa, Telegram yönetim botu, teknik SEO (`llms.txt`, RSS, görsel haritası, IndexNow), 50 yeni blog yazısı.
- Blog planı: 28 Kasım – 27 Aralık arasında günde 2 yazı (60 yazı) sırada. Plan sürerken panelde “Şimdi taslak üret” düğmesine basılmamalı. İlk kendiliğinden yayın 28.11 10:00'dan sonra kontrol edilmeli.
- Google Search Console ve Bing Webmaster Tools kuruldu, site haritası gönderildi.
- Fiyatlar 27.11.2026 tarihli fiyat listesine göre güncel. Listede olup sitede ürünü olmayanlar: İkili Kaşıklı Fincan Seti, Halka Kulplu Kupa, Türk Kahvesi Fincanı, Türk Kahvesi Fincanı Set (fotoğraf ve kullanıcı onayı bekliyor).
- Bekleyen kullanıcı bilgisi: kupa baskı alanı ölçüleri, diğer sosyal hesaplar.
- Bekleyen kullanıcı adımı: diğer yöneticiler Telegram grubunda `/katil` yazacak; sosyal medya anahtarları girilmedi.
- Sosyal medya sırası (27.11.2026): Telegram, Instagram, Facebook, Threads bağlı ve otomatik. Pinterest: işletme hesabı ve geliştirici uygulaması ("KartaBaski Paylasim") tamam, Trial onayı Pinterest'ten bekleniyor; onay maili gelince gizli anahtar sunucuya yazılacak, `/admin/pinterest` ile bağlanacak. TikTok: uygulama "KartaBaski", kuruluş "KAR-TA BASKI", Kullanım Şartları yayında, alan adı doğrulandı, sunucuda sandbox anahtarı kayıtlı. Yarın: sandbox Target Users'a @kartabaski eklenecek (şu an boş, `non_sandbox_target` hatası), sandbox'a kapsamlar ve ürünler eklenecek, sonra demo kaydı. Ayrıntı: `docs/CALISMA_GUNLUGU.md` (28.11.2026). Ayrıntı: `docs/SOSYAL_MEDYA_KURULUM_2.md`, `docs/CALISMA_GUNLUGU.md`.
- Marka online mağaza olarak anlatılır; siteye adres eklenmez.
- Zamanlayıcı sunucudadır (`tools/sunucu/zamanlayici.sh`); aşağıdaki eski notta geçen GitHub zamanlaması geçersizdir.
- Canlıya alma sırası için günlüğün “Her sürümde izlenen yol” bölümüne bakın.

---

Aşağısı 25 Kasım 2026 tarihli eski nottur.

Bu dosya başka bir yapay zeka asistanının (Antigravity vb.) işi kaldığı yerden devralması içindir. Önce `CLAUDE.md`, sonra `docs/ADMIN_PANEL.md`, sonra bu dosyayı oku.

## 1. Proje özeti
- KAR-TA BASKI: kişiye özel kupa/fincan baskı sitesi. Next.js 14 App Router + Firebase (Firestore/Auth, proje `kartabaski-fcf0e`) + Cloudinary (`dwulzfmlu`). Satış WhatsApp üzerinden.
- Canlı: https://www.kartabaski.com — Oracle Cloud sunucusunda Docker (ayrıntı `docs/YAYIN.md`).
- GitHub: `oku-20217170040/kartabaski`, ana dal `main`. Commit mesajları **Türkçe**.
- Kullanıcı Türkçe konuşur; yanıtlar Türkçe olmalı.

## 2. TAMAMLANAN ve CANLIDA olan iş (PR #4, main'e birleşti, sunucuya yüklendi)
Ümit Spot (kardeş proje, `..\umit-spot`) admin panelinin mimarisi KAR-TA BASKI'ya uyarlandı. Modül listesi ve dosyalar: `docs/ADMIN_PANEL.md`.
- Gruplu admin menüsü: `lib/admin-nav.ts` + `app/admin/layout.tsx` (sepet talebi rozeti, menü arama, sosyal alt menü).
- Genel Bakış, İstatistikler, Muhasebe, Makine (üretim hattı), Sepet + Sepet Talepleri (WhatsApp'a yönlendirme), Yorumlar, Sosyal Medya (6 platform), Blog (+ otomasyon), SEO.
- Tek otomasyon kapısı `GET /api/cron/main` (`CRON_SECRET` zorunlu). GitHub Actions `.github/workflows/otomasyon-cron.yml` 30 dk'da bir çağırır (TSİ 07:00–00:30).
- `CRON_SECRET` sunucu `.env`'ine ve GitHub secret'ına eklendi; deneme çalıştırması HTTP 200 verdi.
- Sosyal medya platformları varsayılan KAPALI, tokenlar henüz girilmedi (kullanıcı ayrıca girecek; adımlar `docs/SOSYAL_MEDYA_KURULUM.md` ve `_2.md`).
- Kaldırılanlar (bilinçli): Sanal Depo, Satış Talepleri, Sanal Depo Yönlendirme, QR Etiketler.

## 3. TAMAMLANAN iş: "AI Stüdyo" → "Ürün Fotoğrafları" otomasyonu (25 Kasım 2026)
Kullanıcı isteği: Photoroom tabanlı eski AI Stüdyo kaldırıldı; yerine **sağlayıcıdan bağımsız** ve **0 TL / kredi kartsız** çalışabilen ürün fotoğraf otomasyonu kuruldu (ürün eklenince 1+ fotoğraftan, ürünün formunu/rengini/yüzeyini bozmadan stüdyo ortamında yeni fotoğraflar üretir).

Yapılanlar:
- SİLİNDİ: `app/admin/studio` eski sayfası, `lib/studio*.ts`, `lib/photoroom.ts`, `lib/actions-studio.ts`, ilgili testler.
- YENİ adaptör katmanı `lib/image-gen/`:
  - `types.ts` (sözleşme: `ImageProvider`, `GenerateRequest`, `GenerateResult`, `ImageGenError`)
  - **0 TL / kredi kartsız adaptörler (öncelikli sırada):**
    - `providers/cloudflare.ts` (`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`, varsayılan `@cf/black-forest-labs/flux-2-klein-4b` — günlük 10.000 ücretsiz neuron, kredi kartı gerekmez)
    - `providers/huggingface.ts` (`HF_TOKEN` veya anahtarsız `HF_FREE_ANON=1`, `HF_IMAGE_SPACE`, varsayılan `black-forest-labs/FLUX.1-Kontext-Dev` — ücretsiz ZeroGPU Gradio HTTP API)
  - **Ücretli / faturalandırmalı adaptörler (resmi API belgelerine göre doğrulandı):**
    - `providers/gemini.ts` (`GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, varsayılan `gemini-2.5-flash-image` — faturalandırma hesabı gerektirir, `free: false`)
    - `providers/fal.ts` (`FAL_KEY`, `FAL_IMAGE_MODEL`, varsayılan `fal-ai/bytedance/seedream/v4/edit`)
    - `providers/openai.ts` (`OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, varsayılan `gpt-image-1`)
    - `providers/replicate.ts` (`REPLICATE_API_TOKEN`, `REPLICATE_IMAGE_MODEL`, varsayılan `black-forest-labs/flux-kontext-pro`)
  - `providers/mock.ts` (`IMAGE_GEN_MOCK=1` iken referansı aynen döndürür; test için)
  - `registry.ts` (`pickProvider`, `listProviders`, `getProvider`), `prompts.ts` (9 stüdyo sahnesi, `PRESERVE_RULES`, `buildPrompt`, `DEFAULT_SCENE_IDS`), `fetch-utils.ts`
  - Yeni API eklemek = `providers/` altına bir dosya + `registry.ts`'e bir satır.
- YENİ iş hattı: `lib/photo-auto-utils.ts` (saf), `lib/photo-auto.ts` (server-only), `lib/actions-photo-auto.ts`.
  - Firestore: `photo_auto/settings`, `photo_auto/state` (günlük kota), `photo_jobs/{id}`.
  - Ayarlar: otomatik aç/kapa, sağlayıcı (auto/sabit), sahneler, ürün başına adet (1–8), referans sayısı (1–3), `autoApply` = `review` (onay bekler, varsayılan) | `append` (ürün görsellerinin sonuna ekler, kapak değişmez), günlük limit (20).
  - Üretilen görseller Cloudinary `karta-baski/studio` klasörüne yüklenir.
- YENİ panel: `app/admin/studio/page.tsx` (+ `layout.tsx` maxDuration 300, `studio.css` `.pf-` öneki). Menü adı "Ürün Fotoğrafları" (`lib/admin-nav.ts`).
- BAĞLANDI: `lib/actions.ts` → `createProductAction` sonrası `maybeEnqueueOnCreate(id)`; `app/api/cron/main/route.ts` → `['photos', () => runPhotoStep()]` (tur başına 1 iş).
- `docs/ADMIN_PANEL.md` güncellendi.

Doğrulama durumu:
- `npx next build` → 0 hata (42/42 sayfa).
- `npx jest` → 44 suite / 504 test geçti.
- `npx next lint` → 0 hata.
- Canlı deneme: `HF_FREE_ANON=1` ile `black-forest-labs/FLUX.1-Kontext-Dev` üzerinde gerçek Firestore ürünüyle 0 TL/anahtarsız stüdyo fotoğrafı üretildi ve ürün formunun/yüzeyinin korunduğu doğrulandı.
- **Sosyal Medya Hızlı Paylaşım & Gönderi Havuzu (`/admin/sosyal-medya/paylas`)**: Fotoğraf yüklendiği anda veya kuyrukla müşteri siparişi, ürün, atölye ve kampanya fotoğraflarını otomatik Türkçe metin/hashtag üreterek (+ isteğe bağlı ücretsiz stüdyo arka planı ekleyerek) 6 platforma (Instagram + Hikâye, Facebook, Threads, Telegram, Pinterest, TikTok taslağı) tek merkezden dağıtan sistem eklendi (`lib/social-broadcast*`, `lib/actions-social-broadcast.ts`, `/api/cron/main` `broadcast` adımı).

## 4. İSTEĞE BAĞLI SONRAKİ ADIMLAR
1. Ücretsiz yüksek kota için sunucu `.env` dosyasına `HF_TOKEN` (ücretsiz Hugging Face hesabı) veya `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (ücretsiz Cloudflare Workers AI, günlük 10.000 neuron) ya da anahtarsız deneme için `HF_FREE_ANON=1` eklenip `sudo docker compose up -d --force-recreate` çalıştırılabilir.
2. Sosyal medya platformlarının (Instagram, Facebook, Threads, Telegram, Pinterest, TikTok) tokenları girildikten sonra `/admin/sosyal-medya` üzerinden etkinleştirilebilir.

## 5. Canlıya alma (Oracle sunucusu)
```
git archive HEAD | ssh -i ~/.ssh/umit_spot_oracle ubuntu@132.145.224.255 'tar -x -C ~/kartabaski'
ssh -i ~/.ssh/umit_spot_oracle ubuntu@132.145.224.255 'cd ~/kartabaski && sudo docker compose up -d --build'
```
- `git archive HEAD` yalnız COMMIT edilmiş kodu gönderir → önce commit.
- `.env` sunucuda durur, git'te yok. Env değiştirince `--force-recreate` gerekir. `.env` düzenlemeden önce yedek al (`cp .env .env.bak-<tarih>`).
- Vercel artık kullanılmıyor (PR'daki kırmızı "Vercel" kontrolü önemsiz).

## 6. Kurallar / tuzaklar
- `CLAUDE.md` kuralları geçerli: UI'da emoji yok, hardcoded hex renk yok (CSS değişkenleri), mobil 360px taşma yok, dokunma ≥44px, input 16px, telefon numarası yalnız `lib/constants.ts`'te.
- Server action'larda `await requireAdmin()` (`lib/require-admin.ts`); route handler'da `getAdminSession()`. Sunucu Firestore: `adminDb` + `import 'server-only'`.
- Client bileşen `server-only` dosya import ederse build kırılır (bir kez yaşandı: `lib/seo-root.ts` ayrımı bu yüzden).
- Firestore Spark kotası: okumaları az tut (özet belge/önbellek deseni).
- Commit'e ekleme: `.claude/settings.local.json`, `.claude/launch.json`, `scripts/set-admin.mjs` (kullanıcının yerel dosyaları).
- Geri dönüşü olan dış eylemler (push, merge, canlıya alma, sunucu .env, GitHub secret) için kullanıcı onayı al.
