# Paylaşım sistemi — tasarım (28.11.2026)

Durum: onaylandı. Aşama 1 uygulandı (28.11.2026); sistem önizleme modunda.

## Amaç

Sosyal medya paylaşımları tek panelden yönetilen, kendiliğinden yürüyen ve istenen an müdahale edilebilen bir sisteme toplanır. Platform başına ayrı çalışan ürün/model otomasyonlarının yerini alır. Blog paylaşımları aynen kalır.

## İçerik türleri

| Kod | İçerik | Sıklık | Tekrar |
|---|---|---|---|
| A | Ürün karuseli | günde 2 | her paylaşım bir kez |
| B | Fiyatlı ürün hikâyesi | günde 3 | döngüsel |
| C | Müşteri paylaşımı (üretim sırasında ya da baskı bittikten sonra) | elle, anında | bir kez |
| D | Sipariş rehberi (6 görsel) | ilk seri günde 1, sonra haftada 1 | döngüsel |
| E | Tek tek ürün fotoğrafı (yalnız Pinterest) | günde 15 | her fotoğraf bir kez |

Varsayılan saatler (Türkiye saati, panelden değişir): karusel 11:00 ve 18:00; hikâye 09:00, 14:00 ve 20:00.

## Platformlar

| İçerik | Instagram | Facebook | Threads | Telegram | Pinterest | TikTok |
|---|---|---|---|---|---|---|
| A | karusel | çoklu fotoğraf | karusel | albüm | karusel pin | taslak |
| B | hikâye | hikâye | – | – | dikey pin | elle |
| C | gönderi + hikâye | gönderi + hikâye | gönderi | gönderi | pin | taslak |
| D | gönderi | gönderi | gönderi | gönderi | pin | taslak |
| E | – | – | – | – | pin | – |

Görsel sınırları: Instagram 2–10 (tek görselse tekli gönderi), Telegram albümü en fazla 10, Pinterest karusel pin en fazla 5, TikTok taslağında 24 saatte en fazla 5 bekleyen.

TikTok:
- Karusel taslak olarak gider; yayınlamayı hesap sahibi TikTok uygulamasında yapar.
- İncelenen resmi API belgelerinde hikâye paylaşımı görünmüyor. Ürün hikâyesi saatinde yönetici Telegram grubuna hazır görselin **bağlantısı** gider (görsel eklenmez). Müşteri görselleri gruba hiç gitmez; panelden indirilir.

Bağlı olmayan platform atlanır, diğerleri etkilenmez. Pinterest'te herkese açık erişim onayı gelmeden toplu yükleme (E) başlamaz.

## A — Ürün karuseli

Sıra:
1. **Karışık tur:** her ürün için bir karusel; renkler sırayla dolaşılarak en fazla 10 fotoğraf. 11 ürün → 11 paylaşım.
2. **Renk turu:** her ürünün her rengi ayrı karusel; aynı ürün art arda gelmeyecek biçimde sıralanır. 77 renk → 77 paylaşım.

- Her paylaşımın kalıcı anahtarı vardır (`urun:<ürün>:karisik`, `urun:<ürün>:renk:<renk>`); yayınlanan anahtar bir daha üretilmez. Karışık turdaki bir fotoğraf renk karuselinde yeniden görünebilir.
- Yeni eklenen ürünün karışık karuseli sıranın başına geçer. Yeni eklenen renk, renk turuna girer.
- Pasife alınan ürünün bekleyen paylaşımları atlanır.
- Sıra tükenince karusel akışı durur ve yöneticilere Telegram bildirimi gider.
- Açıklama: ürün adı, kısa tanım, fiyat kademeleri, ürün bağlantısı, etiketler. Threads metni 500 karakteri geçmez.

### Kapak

Kapak temalı görsel olur. Küçük bir kopyanın kenar pikselleri ölçülür; kenarın büyük bölümü beyaza yakınsa görsel "düz zemin" sayılır. Sonuç görsel kimliğine göre saklanır. Panelde kapak elle değiştirilebilir; elle seçim her zaman geçerlidir. Sette temalı görsel yoksa ilk fotoğraf kullanılır ve panelde "temalı kapak yok" uyarısı çıkar.

## B — Ürün hikâyesi

- 1080×1920, tek fotoğraf; boşluklar aynı fotoğrafın bulanık kopyasıyla doldurulur. Ortada, okunacak bir zeminle: ürün adı, en fazla 7 fiyat kademesi, kartabaski.com.
- Ürünler sırayla döner; her seferinde ürünün en uzun süredir kullanılmamış rengi/fotoğrafı seçilir.
- Fiyatlar yayın anında okunur.
- Otomatik hikâyeye tıklanabilir bağlantı eklenmez.

## Fiyat kademeleri

- Üründe yeni alan: `priceTiers: { label: string; price: string }[]` ve `priceTiersSource: string` (onay anındaki açıklama fiyat satırlarının özeti; açıklama değişirse onay düşer). Etiket ve fiyat yazıldığı gibi gösterilir; sistem set ya da adet fiyatı hesaplamaz.
- İlk doldurma açıklama metnindeki satırlardan yapılır; satırlar ürünler arasında farklı biçimde yazıldığı için hiçbiri onaysız sayılmaz.
- Panelde ürün ürün kontrol edilip onaylanır. Onaysız ürünün A ve B paylaşımı yayınlanmaz, panelde "fiyat onayı bekliyor" görünür.
- Ürün formunda kademeler düzenlenince onay işareti yeniden istenir.

## C — Müşteri paylaşımı

### İzin
- Sepette, KVKK onayından ayrı, **işaretsiz** bir kutu: üretim fotoğrafının ve ilk adın sosyal medyada paylaşılmasına izin. İşaretlenince isteğe bağlı hitap seçimi görünür: Hanım / Bey / yalnız adım.
- Siparişe kaydedilir: onay, tarih, kaynak (`sepet` ya da `panel`), hitap.
- Sipariş detayından yönetici de işaretleyebilir (WhatsApp'tan alınan izin).
- Siparişsiz paylaşımda yönetici "izin aldım" kutusunu işaretlemek zorundadır.
- İzin yoksa yayınlama düğmesi kapalıdır; sunucu da reddeder.
- İzin geri alınırsa bekleyen hedefler iptal edilir; yayınlananlar "kaldırılacak" listesine düşer (platformdan elle silmek gerekebilir).

### Hitap
Sıra: müşterinin seçimi → yöneticinin daha önce o ad için yaptığı düzeltme → yerleşik ad listesi → hitapsız. İki cinsiyette kullanılan, listede olmayan ve firma adlarında Hanım/Bey yazılmaz. Listeden gelen sonuç panelde "tahmin" diye işaretlenir ve yayından önce değiştirilebilir. Hitapsız metinde ek, ünlü uyumuna göre yazılır.

### Akış
Fotoğraf (en fazla 10) yüklenir → metin hazır gelir ("Ayşe Hanım'ın kupaları basıldı, hayırlı olsun.") → önizleme → **Paylaş** → sıraya girmeden hemen yayınlanır. Hikâyede seçilen tek fotoğrafın ortasına aynı metin yazılır, fiyat yazılmaz. Yalnız ilk ad kullanılır; telefon, adres, soyad ve sipariş bağlantısı yer almaz. Fotoğraflar siparişin kapalı müşteri yüklemelerinden alınmaz; bu paylaşım için yeniden yüklenir. Video bu sürümde yok.

Müşteri yorum formu değişmez.

## D — Sipariş rehberi

Sitenin kendi tasarımıyla (Archivo, düz renkler, gerçek kupa fotoğrafları) 6 görsel: ürünü seçin; fotoğrafınızı ekleyip tasarlayın; sepette adresi girin; fiyatı WhatsApp'tan onaylayın; baskı önizlemesini onaylayın; baskı ve kargo (yaklaşık 3 iş günü). Görseller bir kez üretilip depoda tutulur; yönetici panelde onaylamadan yayınlanmaz.

## E — Pinterest fotoğrafları

Her rengin her fotoğrafı ayrı pin: ürün adı, renk, fiyat kademeleri, ürün bağlantısı, kategori panosu. Günde 15, gün içine yayılmış. Anahtar görsel kimliğidir.

## Tek panel (`/admin/paylasim`)

- **Sırada:** önümüzdeki günlerin önizlemesi; ertele, metni ve görselleri düzenle, kapak seç, iptal, hemen paylaş.
- **Müşteri paylaşımı:** yükleme, izin durumu, hitap, önizleme, Paylaş.
- **Yayınlanan:** platform başına sonuç, hata ve yeniden dene; kaldırılacaklar (aşama 2). Gönderi bağlantıları aşama 1'de yok.
- **Fiyatlar ve kapaklar:** kademe onayı, kapak seçimi, rehber görseli onayı.
- **Ayarlar:** hepsini durdur, platform aç/kapat, içerik türü aç/kapat, saatler, günlük sayılar.

Aşama 1'de "Merkez" ve "Hızlı Paylaşım" ekranları yanında durur; sonraki aşamada yerlerini alır; platform sayfaları bağlantı ve durum için kalır. Telefonda 360 px'te taşma olmaz, dokunma hedefleri en az 44 px.

## Mimari

- `lib/paylasim/` altında saf, testli modüller: sıra planlayıcı, görsel seçimi, açıklama üretimi, fiyat kademesi ayrıştırma, hitap ve ek, hikâye görsel adresi.
- Sunucu modülü: Firestore koleksiyonu `paylasim` (belge kimliği = paylaşım anahtarı; tür, zaman, görseller, metinler, platform başına durum) ve `paylasim_ayar/main`. Yalnız Admin SDK; istemciye açık değil.
- Yayıncılar mevcut platform modülleridir (`lib/instagram.ts`, `facebook-page.ts`, `threads.ts`, `telegram-channel.ts`, `pinterest.ts`, `tiktok.ts`). Yeni olan: Facebook sayfa hikâyesi (uygulama sırasında resmi belgeden doğrulanacak) ve Telegram albümü yoksa eklenmesi.
- Müşteri paylaşımı mevcut `lib/social-broadcast.ts` anlık yayın akışının üzerine kurulur.
- Zamanlama: mevcut `/api/cron/main` içine tek `paylasim` adımı. Vakti gelen paylaşım o turda yayınlanır; o gün kaçan paylaşım aynı gün içinde telafi edilir, önceki günler biriktirilmez.
- Firestore kotası: ürünler mevcut önbellekten okunur; plan tek ayar belgesi ve yakın tarihli paylaşım sorgusuyla çalışır.

## Geçiş

1. Yeni sistem **önizleme modunda** açılır: sıra oluşur, hiçbir şey yayınlanmaz. Eski otomasyon sürer.
2. Yönetici fiyat kademelerini ve kapakları onaylar, sırayı kontrol eder.
3. Tek anahtarla yeni sistem açılır; aynı anahtar eski ürün/model ve hikâye paylaşımlarını kapatır (çift paylaşım olmaz). Geri dönüş aynı anahtarla yapılır.

## Hata yönetimi

- Platformlar birbirinden bağımsızdır; biri hata verirse diğerleri yayınlanır.
- Hedef başına en fazla 3 deneme; sonra "hata" ve Telegram bildirimi.
- Yayınlanmış hedef yeniden gönderilmez; aynı paylaşımı iki turun birlikte işlemesi işlem kilidiyle engellenir. Sonucu belirsiz kalan hedef otomatik yeniden denenmez, panelde elle karar istenir.

## Gizlilik ve kurallar

- `/gizlilik` sayfasına izinli paylaşım maddesi eklenir.
- Telegram grup mesajlarında açık adres, müşteri notu ve müşteri fotoğrafı bulunmaz (mevcut kural).
- Marka yalnız online mağaza olarak anlatılır; hiçbir metin ya da görselde adres ve çalışma saati yer almaz.

## Test

Saf modüller Jest ile: sıra (tekrar yok, tur geçişi, yeni/pasif ürün), görsel seçimi ve platform sınırları, kapak sınıflandırma, kademe ayrıştırma, izin kontrolü, hitap ve ekler, metin sınırları. Yayıncılar sahte `fetch` ile; testte gerçek paylaşım yapılmaz. Canlıda ilk doğrulama önizleme modunda.

## Aşamalar

1. Ürün karuselleri, hikâyeler, fiyat kademeleri, kapaklar ve tek panel.
2. İzin kutusu, hitap ve müşteri paylaşımları.
3. Sipariş rehberi görselleri.
4. Pinterest fotoğraf akışı ve TikTok, bağlantıları tamamlandıkça.

Her aşama ayrı dalda, testli ve tek başına yayına alınabilir.

## Dış bağımlılıklar

- Pinterest: deneme erişimi onayı, sonra herkese açık erişim başvurusu.
- TikTok: hedef hesap, kapsamlar, demo videosu ve uygulama incelemesi.
