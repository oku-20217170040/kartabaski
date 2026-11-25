# Sosyal medya otomasyonu kurulumu: Meta tarafı (Instagram, Facebook, Threads)

KAR-TA BASKI için Instagram (@kartabaskii), Facebook sayfası ve Threads paylaşımları panelden yönetilir:
**Admin → Sosyal Medya** (Merkez) ve **Instagram / Facebook / Threads** sayfaları.
Altyapı hazırdır. Jetonlar tanımlanana kadar her platform kartında **Bağlı değil** görünür ve otomasyon o platformu sessizce atlar.
Jetonları girdikten sonra kod değişikliği gerekmez.

> Şifre ve jetonlar sohbete, koda ya da Git'e yazılmaz. Yalnızca sunucudaki ortam dosyasına (veya Instagram için panele) girilir.

## Ne paylaşılır?

| İçerik | Instagram | Facebook | Threads |
|---|---|---|---|
| Ürün (kupa modeli) fotoğrafları | Karusel gönderi (en fazla 10 fotoğraf) | Çok fotoğraflı sayfa gönderisi | Karusel; açıklama yanıt zinciriyle |
| Hikâye | Evet (ürün adı + fiyat bandı) | Hayır | Hayır |
| Yeni blog yazısı | Kapak görselli gönderi | Bağlantılı gönderi | Bağlantılı gönderi |
| Özel gün kampanyası | İlk karusel kampanya gönderisi olur | Çok modelli gönderi | Metin gönderisi |

- Özel günler: Sevgililer, Kadınlar, Anneler, Babalar, Dünya Kahve Günü, Öğretmenler, Kara Cuma, Yılbaşı. Her özel gün için kampanya, başlamadan 4-14 gün önce açılır ve bir platformda en fazla 3 günde bir paylaşılır.
- Metinler Türkçe şablonlardan üretilir; hashtag havuzu `#kişiyeözelkupa #kupabaskı #baskılıkupa #hediyelikkupa #kartabaski` + kategoriye özel etiketlerdir. Her gönderide fiyat aralığı, teslimat süresi, WhatsApp numarası ve ürün bağlantısı bulunur.
- Kupa ürünleri modeldir: "stokta/satıldı" yoktur. Bir model **pasife alınırsa** Instagram taslağı yayın anında iptal edilir, Facebook gönderisinin başına "şu an sipariş almıyor" notu yazılır (yeniden aktif edilince kalkar).
- Otomasyon başlamadan önce yazılmış blog yazıları toplu paylaşılmaz; yalnızca otomasyon başladıktan sonra yayınlananlar gider.

## Panel ayarları (jeton gerektirmez)

Her platform sayfasındaki **Kota ve saat aralığı** bölümünden:

- Açık/kapalı anahtarı (Firestore `social_settings/{platform}.enabled`)
- Günlük gönderi kotası (varsayılan Instagram 2 + 3 hikâye, Facebook 3, Threads 3; en çok 10)
- Saat aralığı (varsayılan 10:00–21:00 TSİ). Otomasyon bu aralığın dışında paylaşım yapmaz.

Varsayılan olarak her platform **kapalı** gelir; jetonu girdikten sonra anahtarı açın.

## 1. Instagram

Facebook Sayfası gerekmez: "Instagram API with Instagram Login" kullanılır.

1. Instagram uygulamasında: Ayarlar → Hesap türü ve araçlar → **Profesyonel hesaba geç** (Business veya Creator). Zaten öyleyse atlayın.
2. https://developers.facebook.com adresinde Meta hesabınızla girin → **My Apps → Create App**. Tür olarak **Other / Business** seçin, bir ad verin (ör. "KartaBaski Paylasim").
3. Uygulama panelinde **Add product → Instagram** ekleyin → **API setup with Instagram business login**.
4. **Add account** ile @kartabaskii hesabını ekleyin (izinler: `instagram_business_basic`, `instagram_business_content_publish`).
5. Hesabın yanındaki **Generate token** ile uzun değeri kopyalayın (60 gün geçerli; sistem kendiliğinden yeniler). Aynı sayfadaki sayısal **Instagram hesap kimliği**ni de kopyalayın.
6. Girin (iki yoldan biri):
   - Sunucu ortam dosyasına: `INSTAGRAM_ACCESS_TOKEN=<token>` ve `INSTAGRAM_USER_ID=<hesap kimliği>`; ya da
   - **Admin → Instagram → Bağlantıyı düzenle** kutusuna token (+ isteğe bağlı kimlik) yazıp **Kaydet ve doğrula**. Token Firestore'da `instagram_settings/main` içinde (yalnız sunucu erişimi) saklanır ve orada yenilenir.
7. Sayfada bağlantı `@kullaniciadi` olarak görünmeli. **Otomatik paylaşım** anahtarını açın.

> Uygulama "Development" modunda kalabilir; kendi hesabınıza paylaşım için uygulama incelemesi gerekmez.

**Nasıl çalışır:** Her gün 06:00'dan sonra ayarlanan kotaya göre taslaklar hazırlanır (karusel + hikâye; kampanya yaklaşıyorsa kampanya gönderisi). Yeni blog yazısı için ayrıca bir taslak eklenir. Taslaklar en az 1 saat sonrasına zamanlanır; panelden fotoğraf sırası, açıklama ve saat değiştirilebilir, taslak silinebilir ya da **Hemen paylaş** denebilir. Zamanı gelen taslaklar yayınlanır; yayın anında model hâlâ aktif mi yeniden denetlenir. Aynı model 7 gün içinde tekrar seçilmez. Instagram API günde en fazla 100 paylaşıma izin verir; plan bunun çok altındadır.

## 2. Facebook sayfası

1. Aynı Meta uygulamasında (veya yenisinde) **Facebook Login for Business / Pages** ürününü ekleyin.
2. Graph API Explorer'dan sayfa için `pages_manage_posts`, `pages_read_engagement` ve `pages_show_list` izinleriyle **Sayfa erişim token'ı** üretin; uzun ömürlü (kalıcı) sayfa token'ına çevirin.
3. Sayfa kimliğini sayfanın "Hakkında → Sayfa kimliği" bölümünden alın.
4. Sunucu ortam dosyasına: `FACEBOOK_PAGE_ID=<sayfa kimliği>` ve `FACEBOOK_PAGE_ACCESS_TOKEN=<sayfa token>`.
5. **Admin → Facebook** sayfasında sayfa adı görünmeli; anahtarı açın.

**Nasıl çalışır:** Yeni eklenen model hemen (kota dışı), diğerleri günlük kota ve saat aralığına göre en yeniden eskiye paylaşılır; gönderiler arası en az 45 dakika beklenir. Liste bitince 30 gündür paylaşılmayan modeller yeniden sıraya girer. Fotoğrafı sonradan düzeltilen hatalı ürünler kendiliğinden yeniden denenir (ya da panelde **Tekrar dene**).

## 3. Threads

1. Aynı Meta uygulamasında **Threads API** ürününü ekleyin; izinler `threads_basic`, `threads_content_publish` (ayrıntı yanıtları için `threads_manage_replies`).
2. Threads test kullanıcısı/hesabı olarak hesabınızı ekleyip **token** üretin (60 gün; sistem yeniler).
3. Sunucu ortam dosyasına: `THREADS_ACCESS_TOKEN=<token>`. `THREADS_USER_ID` isteğe bağlıdır (yoksa token ile otomatik bulunur).
4. **Admin → Threads** sayfasında `@kullaniciadi` görünmeli; anahtarı açın. İlk denemeyi **Şimdi 1 model paylaş** ile yapabilirsiniz.

**Nasıl çalışır:** Her model görsellerinden oluşan bir gönderi olur; Threads 500 karakter sınırı koyduğu için açıklama ve ayrıntılar gönderinin altına yanıt olarak eklenir. Threads gönderi düzenlemeyi desteklemediğinden pasif modeller için ek işlem yapılmaz.

## 4. Meta ürün kataloğu (isteğe bağlı)

Facebook/Instagram mağazası ve katalog reklamları için ürün akışı adresi: `https://www.kartabaski.com/meta-feed.xml`
(Commerce Manager → Katalog → Veri kaynakları → Zamanlanmış akış). Yalnızca aktif, fiyatlı ve fotoğraflı modeller girer; pasife alınan model akıştan kendiliğinden çıkar. Fiyat olarak başlangıç fiyatı (`priceMin`) yazılır.

## 5. Zamanlayıcı

Otomasyon turlarını çalıştıran cron rotası (`CRON_SECRET` ile korunur) sunucuda yarım saatte bir tetiklenmelidir; her tur Merkez'deki **Şimdi çalıştır** düğmesiyle aynı işi yapar. Tetikleme kurulumu için bkz. `docs/YAYIN.md`.

## Ortam değişkenleri özeti

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Hayır* | Instagram token (*panelden de girilebilir) |
| `INSTAGRAM_USER_ID` | Hayır | Instagram hesap kimliği (yoksa token ile bulunur) |
| `FACEBOOK_PAGE_ID` | Evet (Facebook için) | Sayfa kimliği |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Evet (Facebook için) | Sayfa erişim token'ı |
| `THREADS_ACCESS_TOKEN` | Evet (Threads için) | Threads token |
| `THREADS_USER_ID` | Hayır | Threads kullanıcı kimliği |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Evet | Görsel adresleri için (zaten tanımlı) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Hayır | Instagram plan özeti ve hata bildirimleri |

## Firestore koleksiyonları

| Koleksiyon | İçerik |
|---|---|
| `social_settings/{platform}` | Açık/kapalı, günlük kota, saat aralığı, son tur zamanı/notu |
| `social_meta/{platform}` | Otomasyon başlangıç zamanı, paylaşılan blog yazıları, kampanya zamanları |
| `social_log` | Merkez'deki canlı akış (tur başına paylaşım/hata kaydı) |
| `instagram_posts`, `instagram_plans` | Instagram taslakları ve günlük plan kilidi |
| `instagram_settings/main` | Instagram token, hesap kimliği, bitiş tarihi |
| `facebook_auto/main` | Facebook kota sayacı ve paylaşılan gönderiler |
| `threads_auto/state`, `threads_settings/main` | Threads durumu ve token |

Bu koleksiyonlara yalnızca Admin SDK (sunucu) erişir; `firestore.rules` içinde istemci erişimi açılmamalıdır.

## Sorun giderme

- Kartta **Bağlı değil**: ilgili ortam değişkeni tanımlı değil ya da sunucu yeniden başlatılmadı.
- "Hata: …" ve token mesajı: token süresi dolmuş/yanlış olabilir; yeni token üretip güncelleyin.
- Bir Instagram paylaşımı başarısız olursa taslak "Hata" durumunda kalır ve (Telegram tanımlıysa) bildirim gelir.
- Görsel hatası: ürünün Cloudinary fotoğrafı silinmiş olabilir; ürüne fotoğraf ekleyince Facebook/Threads yeniden dener.
