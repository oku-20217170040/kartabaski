# Yapay zekâ ve sohbet botlarında görünürlük (27 Kasım 2026)

Hedef: ChatGPT, Claude, Gemini, Perplexity ve Google yapay zekâ özetlerinde "kişiye özel kupa" sorularında KAR-TA BASKI'nın bulunması ve doğru anlatılması. Bundan sonraki çalışmaların temel listesi budur.

## Kısa sonuç

- Teknik kapı açık: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Googlebot ve Bingbot kullanıcı adlarıyla ana sayfa 200 döndü; `robots.txt` yalnız `/admin/`, `/api/`, `/siparis/` yollarını kapatıyor. Sayfalar sunucuda üretiliyor.
- Eksik olan büyük parça site dışı: marka aramasında bir web arama aracı siteyle ilgili hiçbir sonuç döndürmedi; başka bir araç yalnız eski metinli kayıtlar buldu (ör. artık satılmayan "sihirli konik" anlatımı). Yapay zekâ cevapları arama dizinlerinden beslendiği için önce dizine girmek ve güncellenmek gerekiyor.
- Site içinde birbiriyle çelişen bilgiler var; sohbet botu bunlardan birini alıp yanlış aktarabilir.

## 1. Dizin ve hesaplar (ücretsiz)

| Sıra | İş | Durum / neden |
|---|---|---|
| 1 | Google Search Console ve site haritası | 27 Kasım'da kuruldu (bkz. `CALISMA_GUNLUGU.md`). Dizine eklenme birkaç gün sonra izlenir. |
| 2 | Bing Webmaster Tools | 27 Kasım'da kuruldu; "AI Performance" raporu alıntılanmayı izlemek için kullanılır. |
| 3 | Google Merchant Center ücretsiz ürün listelemesi | Google'ın yapay zekâ rehberi Merchant Center beslemelerini sayıyor. `meta-feed.xml` yakın biçimde; küçük uyarlama gerekebilir. |
| 4 | Pazaryeri ve sosyal profiller, firma rehberleri | Her yerde aynı ad, telefon ve web adresi. Fiziksel adres yazılmaz (marka online mağaza). Google İşletme Profili yalnız online markalara verilmediği için listede yok. |
| 5 | Teslim edilen siparişlerde yorum bağlantısı (`/yorum/[token]`) | Gerçek yorum, "güvenilir mi" sorusunun ham maddesi. Yorumu asla kendiniz yazmayın. |

## 2. Site içi düzeltmeler (öncelik sırasıyla)

Ana sayfa canonical, ürün arama açıklaması, işletme yapılandırılmış verisi, site haritası görselleri, RSS, IndexNow ve `llms.txt` ayrı bir çalışma olarak uygulanıyor; güncel durum için `CALISMA_GUNLUGU.md`. Aşağıdaki içerik düzeltmeleri henüz yapılmadı.

1. **Çelişkileri giderin**
   - `/hakkimizda`: "Sepet ya da ödeme ekranı yok" yazıyor; sitede `/sepet` var. Doğrusu: "Ödeme sitede alınmaz." **(Düzeltildi: 27.11.2026)**
   - Sihirli Kupa açıklaması "kurumsal 85₺/adet" diyor, aynı sayfada 45 adet üzeri 160₺ yazıyor. **(Düzeltildi: 27.11.2026)**
   - Seramik Kahve Fincanı "6'lı Set Tasarımsız: 1120₺" (büyük olasılıkla 120₺). **(Düzeltildi: 27.11.2026)**
   - Porselen Motto Fincan "Sihirli Kupa" kategorisinde. **(Düzeltildi: 27.11.2026)**
   - Yayındaki eski "Sihirli Kupa Nasıl Çalışır" yazısı Tabaklı Fincan'ı sihirli kupa olarak listeliyor.
   - Ana sayfadaki yapılandırılmış veri (`app/layout.tsx`) olmayan ürünleri ("Sihirli Mat Kupa", "Sihirli Konik Kupa") ve doğrulanmamış ödeme yöntemlerini ("Cash, Credit Card") söylüyor; meta anahtar kelimelerde de eski adlar var.
2. **Cevap sayfaları**: `/fiyatlar` (tek, 6'lı, 45+ tablo; güncelleme tarihi), `/teslimat-ve-iade` (kargo ücreti, süre, iade, ödeme yöntemi: bugün hiçbiri yazmıyor), `/iletisim` (işletme unvanı, telefon, e-posta, yanıt süresi). Yapay zekâya en çok "ne kadar, kaç günde, nasıl sipariş, güvenilir mi" soruluyor.
3. **Kategori sayfaları**: `/kategoriler/sihirli-kupa` gibi kalıcı adres, her birinde özgün 150–250 kelime ve ürün listesi. Bugün kategori için alıntılanabilecek ayrı sayfa yok.
4. **Yapılandırılmış veri**: ana sayfaya canonical; `Organization`/`OnlineStore` içinde gerçek iletişim bilgisi; ürünlerde renk varyantı (`ProductGroup`), hacim ve ölçü; kargo ve iade bilgisi netleşince `shippingDetails` ve `hasMerchantReturnPolicy`; gerçek yorum geldikçe `aggregateRating` (kod hazır). Google bunun yapay zekâ özetleri için şart olmadığını söylüyor; zengin sonuç ve alışveriş listeleri için yararlı.
5. **IndexNow**: yazı yayınlanınca Bing'e adresi bildiren küçük bir istek.
6. **`llms.txt`**: düşük öncelik. Google bu dosyayı kullanmadığını açıkça yazıyor; sektör çalışmalarında (ikincil kaynak) dosyanın nadiren istendiği ve alıntılanmaya etkisi görülmediği bildiriliyor. Zararı yok, 30 dakikalık iş; mucize beklemeyin.

## 3. Bot izinleri

Değişiklik gerekmiyor. Arama botları (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot) açık kalmalı. Eğitim botlarını (GPTBot, ClaudeBot, Google-Extended) kapatmak aramada görünürlüğü doğrudan etkilemez; markanın modellerin genel bilgisine girmesini istediğiniz için açık bırakmanızı öneririm.

## 4. Site dışı görünürlük

- Instagram profilinde ve gönderilerde site adresi; ürün adları sitedekilerle aynı.
- Kısa videolar (sihirli kupanın ısınması, baskı öncesi/sonrası) YouTube Shorts'a da: video başlığında marka ve ürün.
- Firma rehberleri, haber siteleri, sipariş verdiğiniz okul/dernek/işletmelerin sitelerinde adınız ve bağlantı.
- Pazar yeri mağazası açarsanız aynı marka adı ve açıklama.
- Sahte yorum, satın alınmış bağlantı ve forumlarda gizli reklam yapmayın.

## 5. Ölçüm

- Ayda bir, aynı 10 soruyu ChatGPT, Claude, Gemini, Perplexity ve Google'da sorun; çıkıp çıkmadığınızı ve söylenenin doğruluğunu bir tabloya yazın. Örnekler: "Tek adet kişiye özel kupa nereden yaptırılır?", "Logolu kupa 50 adet fiyatı", "Sihirli kupa fotoğraflı sipariş", "Yılbaşı için kişiye özel kupa 2027".
- `/admin` istatistiklerinde ChatGPT, Claude, Gemini, Perplexity, Copilot kaynakları zaten ayrı sayılıyor (`lib/analytics-utils.ts`).
- Search Console ve Bing raporlarında blog sayfalarının dizine girme oranını haftalık izleyin.

## 6. Blog planı ve risk

27 Kasım'da 50 yazı yayınlandı; 28 Kasım – 27 Aralık arasında her gün 10:00 ve 18:00'de birer yazı planlı.

Google'ın rehberi yalnız sayıyı artırmanın siteyi daha değerli yapmadığını, arama ya da yapay zekâ cevaplarını yönlendirmek için toplu sayfa üretmenin "ölçekli içerik kötüye kullanımı" sayılabileceğini söylüyor. Küçük bir sitede kısa sürede 110 yazı bu açıdan risklidir. Azaltmak için her yazı ayrı konuda, gerçek ürün verisiyle ve elle denetlenerek hazırlandı. Önerim:

- Aralık sonunda aynı tempoyla devam etmeyin; ayda 4–8 yazı yeter.
- 4–6 hafta sonra Search Console'da "tarandı, dizine eklenmedi" sayısı yüksekse benzer yazıları birleştirin ya da yayından kaldırın.
- Gerçek sipariş fotoğrafı (izinli), kendi baskı deneyiminiz ve müşteri soruları ekledikçe yazıları güncelleyin; özgünlük en güçlü sinyal.
- Fiyat geçen yazılarda "27 Kasım 2026" tarihi yazar; fiyat değişince güncelleyin.

## Kaynaklar

- Google: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide> (10 Temmuz 2026 güncel)
- OpenAI botları: <https://developers.openai.com/api/docs/bots>
- Anthropic botları: <https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler>
- llms.txt çalışmaları (ikincil): <https://www.optimizely.com/field-notes/articles/does-llms-txt-work>
- ChatGPT ürün beslemesi bildirildiğine göre henüz ABD odaklı (ikincil): <https://alhena.ai/blog/chatgpt-shopping-product-feed-guide/>
