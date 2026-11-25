# Sosyal medya kurulumu 2: Telegram kanalı, Pinterest, TikTok

Altyapı hazır; anahtarlar yokken her platform panelde "bağlı değil" gösterir ve otomasyon turunu zararsızca atlar.
Anahtarları girdikten sonra sunucuyu yeniden başlatın (env okunur), sonra Sosyal Medya Merkezi'nden ilgili platformu **açın** (varsayılan kapalı).

Ortak davranış:
- İçerik: kupa modelleri + yeni blog yazıları (Telegram ve Pinterest; TikTok yalnızca modeller).
- Önce otomasyon açıldıktan sonra eklenen modeller ve yeni çıkan yazılar gider; geçmiş katalog sonra, en yeni önce sıralanır. Geçmiş blog yazıları toplu basılmaz.
- Günlük kota ve saat aralığı `social_settings/{platform}` belgesinden (Sosyal Medya Merkezi) gelir.
- Elle test: ilgili sayfadaki "Şimdi 1 ... paylaş" düğmesi saat aralığını yok sayar, günlük kotayı sayar.
- Pasife alınan model: Telegram gönderisi "şu an satışta değil" olarak güncellenir, fiyat aralığı değişirse yeni fiyatla düzenlenir. Pinterest ve TikTok içeriği sonradan değiştirilemez.
- Bir gönderi hata verirse tekrar denenmez; panelde "Kuyruğa al" ile yeniden denenir.

## 1. Telegram kanalı

Sayfa: `/admin/telegram`. (Yönetici botu ve webhook bu işin dışındadır.)

1. Telegram'da bir **kanal** açın (herkese açık olacaksa kullanıcı adı verin, örn. `@kartabaski`).
2. @BotFather ile bot oluşturun (zaten yönetici botu varsa aynı bot kullanılabilir) ve token'ı alın.
3. Botu kanala **yönetici** olarak ekleyin: "Mesaj gönder" ve "Mesajları düzenle" izinleri açık olmalı.
4. Ortam değişkenleri (`.env.local` / sunucu):
   - `TELEGRAM_BOT_TOKEN`: BotFather token'ı.
   - `TELEGRAM_CHANNEL_ID`: herkese açık kanal için `@kanal_adi`; özel kanal için `-100…` sayısal kimlik.
5. Sayfadaki "Şimdi 1 gönderi paylaş" ile deneyin. Gönderi bağlantıları yalnızca `@kanal_adi` ya da `-100…` kimliğinden üretilebilir.

Durum: Firestore `telegram_channel/state`.

## 2. Pinterest

Sayfa: `/admin/pinterest`. Pinler kupa kategorisine göre panolara gider (Seramik Kahve Fincanı, Lüks Kupa, Kahve Fincanı, Latte Fincanı, Pro Kupa, Büyük Kupa, Sihirli Kupa, Özel Tasarım, Kurumsal); blog yazıları **Kupa Rehberi** panosuna gider. Hesapta olmayan pano ilk ihtiyaçta kendiliğinden oluşturulur (aynı ad varsa "… - KAR-TA BASKI" adıyla).

1. https://developers.pinterest.com/apps/ adresinden uygulama oluşturun (işletme hesabıyla).
2. Yönlendirme (redirect) adresi: `https://www.kartabaski.com/api/pinterest/callback`
3. Kapsamlar: `boards:read, boards:write, pins:read, pins:write, user_accounts:read`.
4. Ortam değişkenleri:
   - `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`: uygulama kimliği ve gizli anahtarı.
   - İsteğe bağlı: `PINTEREST_ACCESS_TOKEN` (elle token; OAuth yerine), `PINTEREST_REFRESH_TOKEN` (otomatik yenileme), `PINTEREST_API_BASE` (Trial/sandbox için `https://api-sandbox.pinterest.com/v5`).
5. `/admin/pinterest` → **Pinterest'e bağlan**. Token ve yenileme anahtarı Firestore `pinterest_settings/main` içinde saklanır, süresi azalınca kendiliğinden yenilenir.
6. Not: Trial erişimde atılan pinler yalnızca hesap sahibine görünür; herkese açık için Standard erişim başvurusu gerekir (uygulama amacı: işletme sahibinin kendi kupa kataloğunu kendi panolarına pinlemesi; demo videosunda bağlanma, 1 pin paylaşma ve pinden ürün sayfasına geçiş gösterilir).

Durum: Firestore `pinterest_auto/state`.

## 3. TikTok

Sayfa: `/admin/tiktok`. Modeller fotoğraf karuseli **taslağı** olarak TikTok gelen kutusuna gider; yayınlamayı TikTok uygulamasında siz yaparsınız. TikTok 24 saatte en fazla 5 bekleyen taslağa izin verir; sınır dolunca tur atlanır.

1. https://developers.tiktok.com adresinde uygulama oluşturun; ürünler: **Login Kit** ve **Content Posting API**.
2. Yönlendirme (redirect URI): `https://www.kartabaski.com/api/tiktok/callback`
3. Kapsamlar: `user.info.basic`, `video.upload` (doğrudan yayın kullanılmaz).
4. **Doğrulanmış URL öneki** (Content Posting, URL prefix): `https://www.kartabaski.com/api/tiktok/media/`. TikTok fotoğrafları bu önekten çeker; adres yalnızca `karta-baski/urunler/` klasöründeki Cloudinary görsellerini JPEG olarak aktarır. (Doğrulama için TikTok'un verdiği dosya/ meta etiketi gerekirse alan adı kökünde istenir.)
5. Ortam değişkenleri: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
6. `/admin/tiktok` → **TikTok'a bağlan**. Token'lar Firestore `tiktok_settings/main` içinde saklanır, süresi azalınca yenilenir. "Bağlantıyı test et" hesap adını gösterir; "Son taslakların durumu" TikTok'taki gerçek teslim durumunu sorgular.
7. Production incelemesi için gerekli metinler (İngilizce): uygulama kupa baskı mağazasının sahibinin kendi TikTok hesabına kendi ürün fotoğraflarını (fiyat, kategori, ürün sayfası bağlantısı) taslak olarak göndermesi içindir; tek kullanıcı vardır, herkese açık kayıt yoktur; sahibi her taslağı TikTok içinde elle onaylayıp yayınlar; token'lar yalnızca sunucuda saklanır, bağlantı panelden kaldırılınca silinir. Site, Gizlilik ve Kullanım Şartları adresleri `https://www.kartabaski.com` altında olmalıdır (sayfalar yoksa başvurudan önce eklenmeli).

Durum: Firestore `tiktok_auto/state`.

## Firestore koleksiyonları

| Koleksiyon / belge | İçerik |
|---|---|
| `telegram_channel/state` | başlangıç zamanı, günlük sayaç, gönderilen model ve yazılar (`blog:<id>`) |
| `pinterest_auto/state`, `pinterest_settings/main` | gönderilen pinler; OAuth token'ları |
| `tiktok_auto/state`, `tiktok_settings/main` | gönderilen taslaklar; OAuth token'ları |
| `social_settings/{platform}` | otomasyon açık/kapalı, günlük kota, saat aralığı (Merkez sayfası yönetir) |

Hepsine yalnızca sunucu (Admin SDK) erişir; `firestore.rules` içinde istemci erişimi açılmamalıdır.

## Blog bağlantıları

Blog yazısı paylaşımları `https://www.kartabaski.com/blog/<slug>` adresine bağlanır (`SITE_URL` + `/blog/`). Blog rotası farklıysa `lib/telegram-channel.ts` ve `lib/pinterest-auto.ts` içindeki `/blog/` yolunu güncelleyin.
