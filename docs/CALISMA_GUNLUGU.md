# Çalışma günlüğü

Bu projede çalışan her asistan ve geliştirici için ortak hafıza: **ne yapıldı, nasıl yapıldı, neden yapıldı.**

## Kural

Her iş bitiminde (kod, sunucu, dış hizmet ya da yalnız araştırma) bu dosyaya, **en üste**, bir kayıt ekleyin. Yarım kalan iş de yazılır.

```
## GG.AA.YYYY — Kısa başlık (PR #n)
- Neden: kullanıcının isteği ya da çözülen sorun
- Ne: görünen sonuç
- Nasıl: yaklaşım, ana dosyalar, alınan kararlar ve gerekçeleri
- Doğrulama: neyle denendi; denenmeyen ne
- Açık / dikkat: yarım kalanlar, tuzaklar
```

**Bu depo herkese açık.** Buraya anahtar, parola, kurulum kodu, sohbet kimliği, sunucu giriş bilgisi, müşteri ya da kişi bilgisi yazmayın.

---

## 28.11.2026 — Paylaşım sistemi tasarlandı (yarım: gözden geçirme ve uygulama)
- Neden: kullanıcı, paylaşımların tek panelden yönetilen ve müdahale edilebilen tek bir sistemde toplanmasını istedi.
- Ne: tasarım belgesi `docs/superpowers/specs/2026-11-28-paylasim-sistemi-design.md` (ürün karuselleri, fiyatlı hikâyeler, izinli müşteri paylaşımları, sipariş rehberi, Pinterest fotoğraf akışı, tek panel).
- Nasıl: sorularla sohbette netleştirildi ve onaylandı; mevcut paylaşım modülleri okunarak yazıldı. Canlı ürün sayfalarında 11 ürün, 77 renk sayıldı; ürünlerin çoğunda ana görsel tek, diğer fotoğraflar renklerin altında. Fiyat satırları ürünler arasında farklı biçimde yazılmış.
- Doğrulama: yalnız belge; kod ve canlı ayar değişmedi.
- Açık: kullanıcının belgeyi gözden geçirmesi, uygulama planı, aşama aşama kurulum. Mevcut otomasyon bu sürede olduğu gibi çalışıyor.

## 28.11.2026 — TikTok sandbox ve doğrulama (yarım: hedef kullanıcı, kapsamlar, demo videosu)
- Neden: TikTok incelemesi demo videosu istiyor; onaysız uygulama sandbox'ta gösterilir.
- Ne: alan adı doğrulaması (URL prefix, imza dosyası `public/`) yayında ve doğrulandı. Sandbox oluşturuldu, sunucuya sandbox client key yazıldı (`TIKTOK-KAYDEDILDI`).
- Nasıl: imza dosyası PR #45 ile eklendi ve yayına alındı. Sandbox ilk denemede `non_sandbox_target` hatası verdi: hedef kullanıcı (Target Users) listesi boş; hesap henüz eklenmedi. Sandbox kapsamları da henüz eklenmedi.
- Doğrulama: `/admin/tiktok` 307 (giriş yönlendirmesi, beklenen); konteyner sağlıklı.
- Açık: Target Users'a @kartabaski eklenecek, sandbox'a kapsamlar (`user.info.basic`, `video.upload`) ve ürünler eklenecek, sonra demo kaydı ve Production incelemesi gönderimi.

## 27.11.2026 — TikTok geliştirici kaydı, Kullanım Şartları sayfası yayında (yarım: uygulama incelemesi)
- Neden: TikTok Content Posting API için uygulama kaydı ve incelemede istenen Kullanım Şartları sayfası gerekiyordu.
- Ne: `/kullanim-sartlari` sayfası eklendi ve yayına alındı (PR #43). TikTok'ta "KartaBaski" uygulaması ve "KAR-TA BASKI" kuruluşu oluşturuldu.
- Nasıl: sayfa mevcut gizlilik sayfasının yapısıyla yazıldı; metin taslak, içinde adres ya da dükkân bilgisi yok. Yayın: sunucuda yedek (`kartabaski-yedek-20261127-204413.tgz`) ve eski imaj etiketi (`onceki-20261127-204413`) alındı, `docker compose up -d --build` çalıştırıldı.
- Doğrulama: testler 722/722 geçti; canlıda `/kullanim-sartlari` 200, ana sayfa 200, konteyner healthy.
- Açık: TikTok'ta gizlilik adresi doğrulaması (URL özellikleri, doğrulama metni bekleniyor), Web URL alanı, demo video (zorunlu), sonra Client Secret'ın sunucuya girilmesi ve `/admin/tiktok` ile bağlama.

## 27.11.2026 — Pinterest yönlendirme adresi eklendi, durum belgelendi (yarım: Trial onayı)
- Neden: kullanıcı "şimdi yapılacakların hepsini yapalım" dedi; anahtar Trial onayına kadar görünmediği için yapılabilen tek adım yönlendirme adresiydi.
- Ne: uygulamaya `https://www.kartabaski.com/api/pinterest/callback` eklendi. Gizli anahtar hâlâ "trial erişimi bekliyor" durumunda kullanılamıyor.
- Nasıl: uygulama ayarları sayfası, "Yeniden yönlendirme URI'leri" alanı.
- Doğrulama: uygulama sayfasında adresin listede olduğu görüldü.
- Açık: Pinterest onay maili (kullanıcı haber verecek). Sonra anahtar sunucuya yazılacak, `/admin/pinterest` ile bağlanacak, otomatik paylaşım için onay alınacak. Mail gelmeden devam edilemez.

## 27.11.2026 — Pinterest geliştirici uygulaması oluşturuldu (yarım: anahtar ve bağlama)
- Neden: Pinterest API ile otomatik pin paylaşımı için uygulama kaydı gerekiyordu.
- Ne: "KartaBaski Paylasim" uygulaması oluşturuldu; durum "Trial erişimi bekliyor". Uygulama simgesi (logo) yüklendi.
- Nasıl: developers.pinterest.com/apps/connect formu. Site ve gizlilik adresi (`/gizlilik`), amaç metni, kullanım "pin oluşturma", hedef kitle "işletmeler", veri erişimi "Evet, benim" (kendi pano ve pinlerini okumak için, panolar otomasyonda bulunmalı). reCAPTCHA kullanıcı tarafından işaretlendi.
- Doğrulama: uygulamalar sayfasında uygulama listelendi, "Trial erişimi bekliyor" görüldü.
- Açık: uygulama gizli anahtarı kullanıcıda, sunucuya kullanıcı girecek. Yönlendirme `/api/pinterest/callback` uygulama ayarlarına girilecek; `/admin/pinterest` üzerinden bağlama ve otomatik paylaşım onayı yapılacak. Trial onayı gelene kadar pinler yalnız hesap sahibine görünür.

## 27.11.2026 — Pinterest işletme hesabına geçildi (yarım: geliştirici uygulaması)
- Neden: geliştirici uygulaması işletme hesabı istiyor; kullanıcı dönüştürmenin yapılmasını istedi.
- Ne: hesap işletme hesabı oldu. İşletme adı "KAR-TA BASKI", ülke Türkiye, site adresi girildi; tür "çevrimiçi satıcı veya pazaryeri", hedefler çevrimiçi satış ve site trafiği, odak "kendin yap ve el işleri", reklam "planlamıyorum".
- Nasıl: Pinterest işletme kurulum soruları (tarayıcıda). Reklam ya da ödeme adımı açılmadı.
- Doğrulama: kurulum sonrası başlangıç önerileri ekranı geldi; profil sayfasında ad, hakkında ve site bağlantısı duruyor, sayfa verisi işletme (partner) hesabı gösteriyor.
- Açık: geliştirici uygulaması (developers.pinterest.com/apps, yönlendirme `/api/pinterest/callback`), anahtarların sunucuya girilmesi, panelden bağlama, otomatik paylaşım için kullanıcı onayı. Web sitesi sahiplenme (claim) yapılmadı; paylaşım için gerekmiyor. Sonra TikTok.

## 27.11.2026 — Pinterest profili dolduruldu (yarım: işletme hesabı ve uygulama)
- Neden: kullanıcı hesabı açtı (`kartabaski`) ve profilin doldurulmasını istedi.
- Ne: ad "KAR-TA BASKI", hakkında metni (tanım, teslimat, WhatsApp), logo yüklendi; web sitesi alanında site adresi var.
- Nasıl: Pinterest ayarları tarayıcıda. Sekme arka plandayken ayar sayfaları boş kalıyor; profil sayfasındaki kalem simgesi ve dosya alanı ile yüklendi.
- Doğrulama: profil sayfasında ad, hakkında ve logo görüldü. Site adresi `http://` biçiminde görünebiliyor (site https'e yönlendirir).
- Açık: hesap kişisel görünüyor; geliştirici uygulaması için işletme hesabına dönüştürülmeli (koşul kabulü, kullanıcı onayı). Panolar bilerek açılmadı: otomasyon ihtiyaç oldukça kendi açar.

## 27.11.2026 — Pinterest kurulumu başladı
- Neden: sosyal medya sırasındaki sıradaki platform.
- Ne: tarayıcıda Pinterest oturumu yok; işletme hesabı oluşturma formu açıldı.
- Nasıl: pinterest.com/business/create. E-posta ve parola kullanıcıda.
- Doğrulama: yok (henüz hesap açılmadı).
- Açık: işletme hesabı (açılacak ya da giriş); sonra geliştirici uygulaması, yönlendirme `/api/pinterest/callback`, anahtarlar sunucuda, panelden "Pinterest'e bağlan". Deneme erişiminde pinleri yalnız hesap sahibi görür; herkese açık için Standard başvurusu gerekir (docs/SOSYAL_MEDYA_KURULUM_2.md).

## 27.11.2026 — Threads profili tamamlandı, ilk gönderi yayında
- Neden: kullanıcı Threads profilinin uygun şekilde doldurulmasını istedi.
- Ne: biyografi (tanım + WhatsApp numarası), "Online mağaza" (site) ve "Telegram kanalı" bağlantıları eklendi. Ad ve logo hazırdı; adres yazılmadı.
- Nasıl: threads.com profil düzenleme penceresi (tarayıcıda). Ekran görüntüsü sık sık zaman aşımına uğradı; erişilebilirlik ağacıyla tıklandı.
- Doğrulama: sayfa yenilendikten sonra biyografi ve bağlantılar profilde görüldü. İlk model gönderisi 22:17'de profilde (saat aralığı dışında olduğu için elle "şimdi paylaş" ile atılmış görünüyor).
- Açık: "10 profili takip et" ve ilgi alanları bilerek yapılmadı.

## 27.11.2026 — Threads bağlandı
- Neden: sosyal medya sırasındaki sıradaki platform.
- Ne: "KartaBaski Paylasim" uygulamasına "Access the Threads API" kullanım durumu ve `threads_content_publish`, `threads_manage_replies` izinleri eklendi (`threads_basic` hazırdı).
- Nasıl: Meta geliştirici panelinden. @kartabaskii için Threads Tester daveti denendi.
- Doğrulama: davet rol listesinde görünmüyor; threads.com/@kartabaskii "Threads hesabını nasıl oluşturmak istediğini seç" ekranına yönleniyor, yani hesabın Threads profili yok görünüyor.
- Deneme: kullanıcı onayladı (ad tercihi `kartabaski`, olmazsa `kartabaskii`). Web kaydı "Instagram ile devam et" ile giriş formu arasında dönüyor; profil açılamadı, parola gerektiren adım kullanıcıda. Instagram ile açılan Threads profili Instagram kullanıcı adını alır.
- Sonradan: kullanıcı Threads profilini açtı; Threads Tester daveti gönderildi, durum "Pending".
- Tamamlanan: kullanıcı daveti kabul etti, User Token Generator ile belirteç üretip panodan sunucuya `THREADS_ACCESS_TOKEN` olarak kaydetti (belirteç sohbete ve depoya yazılmadı). Canlıda Graph `/me` 200 ve `kartabaskii`; panelde @kartabaskii bağlı, 11 model sırada. Giriş notu: web'deki "Instagram ile devam et" döngüye soktu, kullanıcı adı + Instagram şifresiyle giriş yapıldı.
- Sonradan: kullanıcı onayıyla otomatik paylaşım açıldı (günde 3, 10:00–21:00; sayfa yenilenince "Açık" kaldı).
- Açık: ilk Threads gönderisi henüz atılmadı, ilk tur izlenmeli. Belirteç 60 günlük, kod yeniliyor; ilk 24 saatte yenileme denemesi hata verebilir.

## 27.11.2026 — Facebook sayfa profili tamamlandı, ilk gönderi yayında
- Neden: düzeltme sonrası gönderi yayınlandı; kullanıcı sayfa profilinin tamamlanmasını istedi.
- Ne: profil fotoğrafı (logo), kapak görseli (sitedeki gerçek kupa fotoğraflarıyla), telefon, e-posta (sitedeki iletişim adresi), site ve Telegram kanalı bağlantıları, Instagram hesabı, "Daha fazla bilgi al" eylem düğmesi (siteye). Adres ve çalışma saati bilerek girilmedi.
- Nasıl: Facebook arayüzünden tarayıcıda. Kapak, HTML'den Playwright ile üretildi (kobalt zemin, Archivo). Meta'nın pazarlama e-postaları kapatıldı.
- Doğrulama: logo, kapak, telefon, e-posta, bağlantılar ve Instagram sayfada görüldü; eylem düğmesi menüde "düzenle" olarak görünüyor (ziyaretçi görünümü ayrıca denenmedi).
- Sonradan (aynı akşam): kullanıcı parolasını girdi, `facebook.com/kartabaski` açılıyor. Kullanıcı onayıyla Facebook otomatik paylaşımı açıldı (günde 3, 10:00–21:00; sayfa yenilenince "Açık" kaldı). Açıldığında saat aralığı dışındaydı; ilk otomatik tur henüz izlenmedi.
- Açık: WhatsApp bağlantısı numaraya gelen onay koduyla yapılır (kullanıcıda). info@kartabaski.com adresinin e-posta aldığı doğrulanmadı.

## 27.11.2026 — Facebook yayın hatası (#200 publish_actions) giderildi
- Neden: ilk otomasyon turu "(#200) publish_actions" hatasıyla gönderi atamadı.
- Ne: sayfaya yazmadan önce sayfanın kendi belirteci alınıyor; env'deki sistem kullanıcısı belirteci yeterli, yeni belirteç gerekmedi.
- Nasıl: `lib/facebook-page.ts` içine `withPageToken` eklendi (`/{sayfa}?fields=access_token`); gönderi, bağlantı ve düzenleme çağrıları bunu kullanıyor. İzinler zaten tamdı (`pages_manage_posts` dahil); ilk "izin eksik" tahmini yanlıştı.
- Doğrulama: jest 722/722, `lib` için tsc ve eslint temiz; canlıda salt okunur Graph kontrolünde sayfa belirteci alınabiliyor. Gerçek gönderi henüz atılmadı.
- Açık: Facebook otomatik paylaşımı kullanıcı tarafından kapatıldı; açılmadan önce onaylı bir test gönderisi atılmalı. Hata almış kayıtlar panelden "Tekrar dene" ile yeniden denenebilir.

## 27.11.2026 — Facebook sayfası oluşturuldu ve sistem kullanıcısına bağlandı (yarım: gönderi testi ve otomatik paylaşım kapalı)
- Neden: sosyal medya sırasında Facebook sayfası gerekiyordu; sayfa yoktu.
- Ne: KAR-TA BASKI işletme portföyü altında "Kar-Ta BASKI" Facebook sayfası açıldı (kategori: Butik Mağaza; açıklamada adres ya da çalışma saati yok). Sayfa "KartaBaski Otomasyon" sistem kullanıcısına atandı (İçerik ve Topluluk hareketleri). Sayfa kimliği sunucu `.env` içinde `FACEBOOK_PAGE_ID` olarak tanımlandı; belirteç de `FACEBOOK_PAGE_ACCESS_TOKEN` olarak sunucuda.
- Nasıl: uygulamaya "Manage everything on your Page" kullanım durumu eklendi; belirteç Asla süreli, pages izinleriyle üretildi. İlk denemede Business Settings'te görünen kimlik sayfa kimliği sanıldı; Graph /me/accounts ile gerçek sayfa kimliği bulundu ve düzeltildi.
- Doğrulama: konteyner sağlıklı; Graph ile sayfa adı ve yayında olma durumu okunabiliyor. Gönderi atılmadı (test gönderisi yapılmadı).
- Açık: Facebook otomatik paylaşımı kapalı; açılmadan önce test gönderisi ve kullanıcı onayı gerekir. Belirteç yalnızca sunucuda; sohbet ve depoda yok.

## 27.11.2026 — Instagram doğrulaması graph.facebook.com'a taşındı (yarım: belirteç yapıştırılıp doğrulanacak)
- Neden: Meta'da kurulan Instagram bağlantısı bir sistem kullanıcısı belirteciyle yapıldı; uygulama ise Instagram Login uç noktası (graph.instagram.com) ile doğrulamaya çalıştığı için her denemede "Cannot parse access token (kod 190)" hatası alındı. Belirteç Meta'da geçerliydi (graph.facebook.com üzerinden hesap "kartabaskii" olarak döndü).
- Ne: `lib/instagram.ts` API adresi graph.facebook.com/v26.0 oldu; hesap doğrulaması kullanıcı kimliğiyle yapılır (`/{id}?fields=id,username`); sistem kullanıcısı belirteci yenilenmediği için yenileme atlanır. Çağıran iki yerdeki argüman kaldırıldı.
- Nasıl: belirteç sohbete ya da koda yazılmadı; panelde ve sunucu `.env` dosyasında kullanıcı tarafından girildi. Firestore'daki eski (geçersiz) belirteç panelden yeniden kaydedilerek üzerine yazılmalı; panel önce Firestore değerini kullanır.
- Doğrulama: `npx jest` 720/720 geçti; `lib` için `tsc` ve eslint temiz (kalan tsc hataları eski `.next` çıktısı ve önceden var olan test tipleri). Canlıda `.env` ve konteyner belirteci görüyor (uzunluk kontrolü); Graph çağrısı 200 ve kartabaskii döndürdü.
- Açık: panelde "Kaydet ve doğrula" ile yeni belirteç kaydedilmeli; sonra Instagram otomatik paylaşım açılabilir (şu an kapalı).

## 27.11.2026 — Telegram kanalı açıldı ve otomatik paylaşım başladı (yarım: Instagram sırada)
- Neden: sosyal medya otomasyonları sırayla kurulacaktı; ilk adım Telegram kanalı.
- Ne: herkese açık kanal "KAR-TA BASKI" (@kartabaski) açıldı, logo ve açıklama girildi. Yönetici botu yalnızca "Gönderi gönder" ve "Gönderileri düzenle" yetkileriyle kanal yöneticisi yapıldı. Test gönderisi (tabaklı kahve fincanı, "Satışta") kanala gitti. Otomatik paylaşım açıldı: günde 3 gönderi, 10:00–21:00.
- Nasıl: sunucu `.env` dosyasına `TELEGRAM_CHANNEL_ID=@kartabaski` eklendi, konteyner `--force-recreate` ile yeniden başlatıldı. Bot tokenı ve yönetici paneli girişi kullanıcı tarafından yapıldı; sohbete yazılmadı. Kanal ayarları Telegram arayüzünden tarayıcıda yapıldı.
- Doğrulama: konteyner sağlıklı (healthy); test gönderisi panelde "Satışta" olarak göründü. Otomatik turların zamanlaması canlıda henüz izlenmedi.
- Açık: Instagram (@kartabaskii) kurulumu başlamadı. Kanaldaki ilk otomatik gönderilerin saatleri bir gün sonra kontrol edilmeli.

## 27.11.2026 — Fiyatlar fiyat listesine göre güncellendi
- Neden: sitede çelişen fiyatlar vardı; kullanıcı güncel fiyat listesini (PDF) verdi.
- Ne: Büyük Beyaz Kupa tek adet 200 → 250 TL; Kahve Fincanı 245 → 250 TL (ürün ve tasarım aracı); Seramik Kahve Fincanı 6'lı tasarımsız 1120 → 120 TL; Sihirli Kupa'dan yanlış “85 TL” satırı kaldırıldı, 2'li set 325 TL eklendi, görsel sayısı 1+2 yapıldı; Porselen Motto Fincan kategorisi Kahve Fincanı; fiyat geçen 23 blog yazısı ve Hakkımızda metni.
- Nasıl: ürün ve yazı kayıtları Firestore'da doğrudan güncellendi (önce yedek, sonra kuru deneme, metin bulunamazsa hiç yazmayan betik). Yayın durumu ve planlar değişmedi. Karşılaştırma cümleleri ve türetilen tutarlar yeni fiyata göre yeniden hesaplandı.
- Doğrulama: yayındaki 11 ürünün fiyat satırları listeyle birebir; tasarım aracında 7 bardak doğru; yazılarda eski tek adet değeri kalmadı; 720 test ve build geçti; canlıda ürün, Hakkımızda ve blog sayfaları denendi (geri dönüş imajı onceki-20261127e), 14 sayfa IndexNow ile bildirildi.
- Açık: listedeki dört ürün sitede yok (İkili Kaşıklı Fincan Seti, Halka Kulplu Kupa, Türk Kahvesi Fincanı ve Seti). Motto kategorisi kullanıcıya sorulmadan benzer porselenlerle aynı yapıldı.

## 27.11.2026 — IndexNow düzeltmesi ve blog sonrası kontrol
- Neden: blog işi bittikten sonra yapılan kontrolde yeni yazıların çoğunun IndexNow'a hiç bildirilmediği görüldü.
- Ne: bildirim artık zamana göre değil, daha önce bildirilen sayfa sürümlerine göre.
- Nasıl: ilk bildirim sırasında yazı listesi önbellekten eski geliyordu; sonradan haritaya düşen yazıların tarihi “son bildirim”den eski olduğu için atlanıyordu. `pendingUrls` (`lib/indexnow-utils.ts`) adres + tarih kaydı tutar (`seo_state/indexnow.sent`). Eski kayıtta bu alan olmadığı için ilk turda bütün adresler yeniden gider.
- Blog kontrolü (canlı): 51 yazının hepsi açılıyor; liste, 2. sayfa ve örnek yazılar 360 px ve masaüstünde taşma, kırık görsel ve sayfa hatası vermedi. Yarım saatlik sunucu zamanlayıcısı sabahtan beri HTTP 200.
- Doğrulama: 720 test ve ayrı kopyada build; canlıya alındı (geri dönüş imajı onceki-20261127d), ilk turda 69 adres kabul edildi.
- Açık: ilk planlı yayın 28.11 10:00'da; henüz görülmedi. `docs/YAPAY_ZEKA_GORUNURLUGU.md` içindeki site içi çelişkiler kullanıcı kararını bekliyor.

## 27.11.2026 — 50 blog yazısı, 30 günlük yayın planı ve öneri raporu
- Neden: yapay zekâ aramalarında görünürlük (kullanıcı isteği).
- Ne: 50 yazı yayında; 28.11–27.12 arası her gün 10:00 ve 18:00 (TSİ) birer yazı planlı (60). Blog 24'lük sayfalara bölündü, ilgili yazılar, stok kapaklarda kaynak satırı.
- Nasıl: `lib/blog-cadence.ts` günde 2, en az 4 saat; cron taslak üretimi yalnız `BLOG_AUTO_GENERATE=1`. Yazılar Admin SDK ile `posts` koleksiyonuna yazıldı (`batch: blog-2026-11-27`; toplu geri alma bu alanla). Eski otomatik planlı taslak silinmedi, takvimden çıkarıldı. Kapaklar `karta-baski/blog/` altında kopya: `docs/BLOG_GORSELLERI.md`. Öneriler: `docs/YAPAY_ZEKA_GORUNURLUGU.md`.
- Doğrulama: 715 test, lint, ayrı kopyada build; yazılar betikle (uzunluk, bağlantı, tekrar, tutar) denetlendi, kapaklar gözle kontrol edildi. İlk planlı yayın henüz gerçekleşmedi (simülasyon testi var).
- Açık: plan sürerken panelde "Şimdi taslak üret" kullanmayın. Ürün açıklamalarındaki çelişkiler (rapor bölüm 2) düzeltilmedi.

## 27.11.2026 — Teknik SEO ve yapay zekâ görünürlüğü
- Neden: sitenin arama motorlarında ve yapay zekâ yanıtlarında daha doğru ve hızlı tanınması (kullanıcı onayladı).
- Ne: `llms.txt`, blog RSS (`feed.xml`), görsel site haritası, IndexNow bildirimi, ana sayfa canonical, temiz ürün arama açıklaması, işletme verisinde iletişim noktası.
- Nasıl: yeni içerik üretmeden var olan veriden. `lib/seo-text.ts` ürün açıklamasındaki süs imlerini ve satır kırıklarını temizleyip özellik + fiyatla 158 karakterlik açıklama kurar. IndexNow ayrı cron adımıdır (`lib/indexnow.ts`, durum `seo_state/indexnow`): blog koduna dokunmadan, site haritasında değişen ürün ve yazıları bildirir. Marka online mağaza olarak anlatılır; adres eklenmez.
- Düzeltme: önceki denetimde “ürün sayfasında arama açıklaması yok” denmişti; yanlıştı (açıklama çok satırlı olduğu için denetim görmemişti). Açıklama vardı ama ✔ imleri ve satır kırıklarıyla uzundu.
- Doğrulama: 696 test, tür kontrolü, ayrı kopyada build ve yerel deneme; canlıya alındı (geri dönüş imajı onceki-20261127b), yeni adresler 200, ilk IndexNow bildiriminde 19 adres kabul edildi.
- Açık: Google/Bing sonuçlarına yansıma günler alır. Fiyat tablosu, karşılaştırma ve soru-cevap sayfaları ayrı iş.

## 27.11.2026 — Bing Webmaster Tools kuruldu
- Neden: Bing dizini bazı yapay zekâ aramalarını da besliyor (kullanıcı isteği).
- Ne: yalnız `https://www.kartabaski.com/` ve site haritası eklendi; Bing durumu “Success”, 19 adres.
- Nasıl: sitenin sahibinin Google hesabıyla giriş (kullanıcı onayladı) ve **Google Search Console'dan içe aktarma** (Bing'in yalnız okuma izni var). Bu yüzden Search Console mülkü ya da izni kaldırılırsa Bing doğrulaması da etkilenir.
- Not: panelde **AI Performance (beta)** raporu var; sitenin yapay zekâ yanıtlarında alıntılanmasını izlemek için kullanılabilir. **IndexNow** menüsü teknik maddeler uygulanırken kullanılacak.

## 27.11.2026 — Google Search Console kuruldu, site haritası gönderildi
- Neden: arama motorları ve onlardan beslenen yapay zekâ aramaları siteyi daha hızlı ve eksiksiz tanısın (kullanıcı isteği).
- Ne: `https://www.kartabaski.com/` URL ön eki mülkü eklendi, sahiplik doğrulandı, `sitemap.xml` gönderildi.
- Nasıl: HTML etiketi yöntemi; kod admin panelinde **SEO Ayarları → Doğrulama kodları → Google** alanına kaydedildi (kod ya da dağıtım gerekmedi). **Bu alan silinirse doğrulama düşer.** Mülk, sitenin sahibinin Google hesabındadır.
- Doğrulama: etiket canlı ana sayfada görüldü; Google sahipliği ve site haritasını kabul etti. Dizine ekleme sonuçları birkaç gün sonra görülür.
- Açık: Google İşletme Profili açılmadı: Google yalnız online hizmet veren markalara profil vermiyor. Pazaryeri ve sosyal profiller, firma rehberleri ve haber siteleri sırada; her yerde aynı ad, telefon ve web adresi kullanılacak, uydurma adres yazılmayacak.

## 27.11.2026 — Çalışma günlüğü kuruldu
- Neden: kullanıcı, yapılan her işin diğer asistan ve modellerin anlayacağı biçimde not edilmesini istedi.
- Ne: bu dosya; `CLAUDE.md` ve `AGENTS.md` içine kayıt kuralı; `docs/DEVAM_NOTLARI.md` başına güncel durum.
- Nasıl: 26-27 Kasım işleri commit ve PR geçmişinden geriye dönük yazıldı. #4-#7 için `docs/DEVAM_NOTLARI.md` geçerlidir.

## 27.11.2026 — Yapay zekâda görünürlük: blog ve teknik SEO (devam ediyor)
- Neden: kullanıcının birinci önceliği sitenin sohbet botlarında ve yapay zekâ aramalarında öne çıkması.
- Ne: ayrı bir oturum 50 blog yazısı yayınlama ve sonraki 30 güne günde 2 yazı planlama işini yürütüyor (sonucunu kendi kaydıyla ekler). Teknik maddeler onaylandı, henüz uygulanmadı; blog işi bitince yapılacak.
- Canlı denetim (salt okuma): botlar siteye erişebiliyor (`robots.txt` açık); eksikler: `llms.txt`, RSS, site haritasında görsel, ana sayfada canonical, bakılan ürün sayfasında arama açıklaması, işletme verisinde adres.
- Uygulanacaklar: ürün açıklamaları, canonical, işletme yapılandırılmış verisi, site haritası görselleri, RSS, IndexNow, `llms.txt`.
- Karar (kullanıcı): marka **online mağaza** olarak anlatılır. Siteye ve içeriğe fiziksel adres, ziyaret ya da çalışma saati eklenmez; her platformda ad ve telefon aynı tutulur.
- Açık: diğer sosyal hesaplar ve kupa ölçüleri kullanıcıdan istendi; gelmeden uydurulmayacak. Search Console ve Bing'e site haritası gönderimi, pazaryeri / sosyal profiller, firma rehberleri ve haber siteleri için kullanıcı onay verdi.

## 27.11.2026 — Telegram yönetim botunun gerçek kurulumu
- Neden: kullanıcı kurulumu kendi tarayıcısından yapmamı istedi.
- Ne: yönetim grubu kuruldu, mevcut site botu bağlandı (`/kur`), botun ve grubun profil resmi site logosu yapıldı.
- Nasıl: bot anahtarını kullanıcı `tools/sunucu/telegram-kur.sh` ile kendisi girdi. Bot resmi Bot API `setMyProfilePhoto` ile; grup resmi grup sahibinin tarayıcısından (bot yönetici olmadığı için `setChatPhoto` reddedildi).
- Açık: diğer yöneticilerin `/katil` yazıp onaylanması gerekiyor. İşletmenin resmi numarası Telegram'da bulunamadı; kullanıcı eklenmesini istemedi.

## 27.11.2026 — Telegram yönetim botu ve sunucu zamanlayıcısı (PR #20)
- Neden: sipariş bildirimi hiç gitmiyordu (sunucuda anahtar yoktu); yöneticiler işleri Telegram'dan yürütmek istedi. GitHub'ın yarım saatlik zamanlanmış işi iki günde yalnız birkaç kez çalışmıştı.
- Ne: bildirimler (yeni sipariş, önizleme cevabı, yorum, otomasyon hatası), düğmeler (sahiplenme, üretime aktarma, aşama, kargo, yorum onayı), komutlar, sabah özeti, hatırlatmalar; site ve disk nöbeti.
- Nasıl: `app/api/telegram` webhook (gizli başlık anahtardan türetilir, ek env yok); `lib/bot.ts` + saf ve testli `lib/bot-utils.ts`; grup ve yöneticiler Firestore `bot/ayar`; panel ile bot aynı sunucu işlevlerini kullanır (`lib/siparis-uretim.ts`). Zamanlayıcı `tools/sunucu/zamanlayici.sh` (ubuntu crontab). Ayrıntı: `docs/TELEGRAM_BOTU.md`.
- Kararlar: grup mesajlarında açık adres, müşteri notu ve fotoğraf yok (KVKK); silme ve fiyat değişikliği yalnız panelde; “teslim edildi” ikinci onaylı.
- Doğrulama: birim testleri, sahte Telegram ile test kopyasında uçtan uca, canlıda grup bağlama.
- Dikkat: `.sh` dosyaları LF kalmalı (`.gitattributes`). Bir bot aynı anda tek webhook'a bağlanır.

## 26.11.2026 — Ayrıntılı adres ve yeni sipariş yönetimi (PR #19)
- Neden: siparişte eksiksiz teslimat adresi istendi; sipariş ve baskı bilgisi ekranının telefonda açık ve işlevsel olması istendi.
- Ne: il / ilçe / mahalle seçmeli adres, posta kodu, başka alıcı, kurumsal fatura; panelde “sıradaki adım” kartı, Baskı / Süreç / Müşteri sekmeleri, indirilebilir (aynalanabilir) baskı şablonu, listede arama.
- Nasıl: `components/address/`, `lib/address.ts`; listeler `tools/adres-verisi.mjs` ile turkiye-api (MIT) 2025 verisinden `public/adres/` altına üretilir, elle düzenlenmez. Baskı şablonu `drawPrint` ile 2400 px.
- Açık: baskı alanı ölçüleri ürün fotoğrafından tahmin; gerçek cm değerleri gelirse düzeltilecek.

## 26.11.2026 — Sipariş kodu ve kodla takip (PR #18)
- Neden: müşteri sipariş numarasıyla durum sorgulayabilsin; silme düğmesi kaldırılsın; yönetici WhatsApp'tan takip bağlantısı gönderebilsin.
- Nasıl: `KB` + 11 karakterlik kod (karışan 0/O, 1/I/L yok); `/siparis-takip` yalnız durum, kargo ve ürün özeti gösterir (kullanıcı kararı: fotoğraf, ad, telefon görünmez); sorgu hız sınırlı; müşteri silme ucu kaldırıldı.

## 26.11.2026 — Yönetim paneli telefona uyarlandı (PR #17)
- Neden: yöneticiler paneli telefondan kullanıyor.
- Nasıl: `app/admin/mobile.css` (≤860px): alt sekme çubuğu, yapışkan kaydet çubuğu, alttan pencereler; 360px taşma yok, dokunma hedefi ≥44px.

## 26.11.2026 — Ürün kaydetme hatası (PR #16)
- Neden: aynı slug'a sahip iki ürün yüzünden kategori güncellenemiyordu.
- Nasıl: benzersizlik yalnız slug değişince denetlenir; hata metni panele döner; sitede aktif ürün gösterilir.

## 26.11.2026 — 3D kupa ve iki yüze baskı (PR #15)
- Neden: müşteri sipariş verirken kupayı döndürerek görsün; bazıları iki yüze ayrı fotoğraf istiyor.
- Nasıl: `components/mug3d/`, `lib/mug3d.ts` (11 model, ürün fotoğraflarından ölçülü, ürün adının başından eşleşir); arka yüz sipariş satırında `back` alanında. Karar: iki yüz aynı fiyat.

## 26.11.2026 — Vitrin, tek sepet, takip, konfigüratör (PR #8-#14)
- Neden: site “yapay zekâ elinden çıkmış” görünmesin; siparişler tek sepetten ve tek panelden yürüsün; WhatsApp'a yalnız sipariş bağlantısı gitsin.
- #8 “Tabela” tasarım sistemi (`app/site.css`). #9 fotoğraf düzenleme, tarayıcıda arka plan silme, galeri. #10 tek sepet; fotoğraflar sipariş anına kadar cihazda, Cloudinary'de kapalı. #11 durum çizelgesi, önizleme onayı, kargo. #12-#13 konfigüratör sepete bağlandı ve yeniden tasarlandı. #14 örnek görseller ürüne bağlandı, sipariş akışındaki üç hata.
- Dikkat: tasarımda degrade, krem zemin, hap rozet, emoji, “01/02/03” yok (bkz. `CLAUDE.md` Styling).

## Sunucu bakımı (26.11.2026)
- Neden: eski yedek ve imajlar diski dolduruyordu; kullanıcı düzenli temizlik istedi.
- Ne: sunucuda haftalık temizlik betiği (son 2 geri dönüş imajı ve son 2 yedek kalır; 7 günden eski ortak derleme önbelleği silinir). Daha fazlasını silmek için kullanıcı onayı gerekir; sunucu başka projelerle ortaktır.

---

## Her sürümde izlenen yol
1. Test, tür kontrolü, lint; kullanıcının geliştirme sunucusu `.next` klasörünü bozmamak için build **ayrı bir kopyada**.
2. Sunucudaki kod yayındaki sürümle karşılaştırılır; yedek alınır, çalışan imaj `onceki-…` adıyla etiketlenir.
3. `git archive` paketi gönderilip özeti (sha256) doğrulanır; derleme arka planda, bitince sağlık durumu denetlenir.
4. Push, PR, birleştirme. PR'daki kırmızı “Vercel” denetimi önemsizdir.
5. Canlı denemede yalnız “QA Test” adlı kayıt açılır ve doğrulanarak silinir; kullanıcının kayıtlarına dokunulmaz.

Girişsiz admin denemesi: proje geçici bir klasöre kopyalanır; Firebase, oturum ve Telegram sahteleriyle değiştirilir; gerçek anahtar kopyalanmaz.
