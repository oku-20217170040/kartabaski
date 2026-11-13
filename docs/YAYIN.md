# Yayın (Oracle sunucusu, Docker)

Vercel Hobby planı 11 Kasım 2026'da kota aşımı yüzünden durduruldu; site Oracle Cloud'daki ortak sunucuya taşındı. Genel düzen ve komutlar: `umit-spot/docs/SUNUCU.md`.

- Sunucu klasörü: `~/kartabaski`, konteyner `kartabaski` (ağ `web`), iç adres `kartabaski:3000`.
- Derleme: `Dockerfile` (Node 24, Next 14 standalone, `sharp`; `DOCKER_BUILD=1` iken `output: 'standalone'`). `.env` sunucuda (yerel `.env.local` kopyası), `NEXT_PUBLIC_*` derleme anında gömülür.
- Çalışan adres: https://kartabaski.132-145-224-255.sslip.io (geçici önizleme, noindex). Nihai adres `kartabaski.com`: DNS'te A kaydı 132.145.224.255 yapılınca `~/edge/staged/kartabaski.caddy.off` yayına alınır.
- Veri Firebase (`kartabaski-fcf0e`) ve Cloudinary'de; sunucuda kalıcı veri yok.
- Güncelleme: `git archive HEAD | ssh … 'tar -x -C ~/kartabaski'` sonra `sudo docker compose up -d --build`.
- `railway.toml` eski seçenek olarak duruyor, kullanılmıyor.
