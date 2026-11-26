# Telegram yönetim botu

Tek bot, tek yönetim grubu. Sipariş, önizleme cevabı, yorum ve otomasyon haberleri gruba gelir; düğme ve komutlarla yönetilir.

## Kurulum (bir kez)

1. Bilgisayarda terminalde çalıştırın, sorulunca BotFather anahtarını yapıştırın (görünmez):
   `ssh -t -i "$HOME\.ssh\umit_spot_oracle" ubuntu@132.145.224.255 "bash /home/ubuntu/kartabaski/tools/sunucu/telegram-kur.sh"`
2. Telegram'da grubu kurun; diğer yöneticileri ve botu ekleyin.
3. Gruba betiğin yazdığı `/kur KOD` komutunu yazın. Yazan kişi yönetici olur.
4. Diğer yöneticiler `/katil` yazar; mevcut bir yönetici “Onayla” der.

Bir bot aynı anda tek adrese bağlanabilir; aynı anahtar başka projede kullanılıyorsa yeni bot açın.

## Komutlar

`/siparisler`, `/siparis KOD`, `/bugun`, `/rapor`, `/kargo KOD Firma TakipNo [https://…]`, `/otomasyon`, `/yoneticiler`, `/katil`, `/yardim`

## Kurallar

- Bot yalnız bağlı grupta ve yalnız kayıtlı yöneticilere cevap verir.
- Gruba ad, telefon, il/ilçe ve ürün bilgisi gider. Açık adres, müşteri notu ve fotoğraf gitmez.
- “Teslim edildi” muhasebeye yazdığı için ikinci onay ister. Silme ve ürün/fiyat değişikliği yalnız panelde.
- Sabah 09:00 özeti; gündüz saatlerinde 3 saattir ilgilenilmeyen yeni sipariş ve 1 gündür cevapsız önizleme hatırlatılır.

## Zamanlayıcı ve nöbet

`tools/sunucu/zamanlayici.sh` ubuntu crontab'ında: `cron` yarım saatte bir `/api/cron/main`; `nobet` 5 dakikada bir site ve disk denetimi (site iki kez üst üste açılmazsa ve disk %85'i geçerse gruba yazar).
Kayıt: `~/kartabaski-zamanlayici.log`.

## Kod

`lib/bot.ts` (olaylar, komutlar, düğmeler), `lib/bot-utils.ts` (saf kurallar, testli), `lib/bot-store.ts` (Firestore `bot/ayar`, `bot/durum`), `app/api/telegram` (webhook; gizli başlık anahtardan türetilir), `app/api/bot` (betikler için, `CRON_SECRET`).
