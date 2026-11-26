# Tek sepet ve sipariş sayfası (Aşama 1)

Onay: 26 Kasım 2026. Amaç: tek sipariş yolu; her kupa tasarımıyla sepete girer, WhatsApp'a yalnız sipariş bağlantısı gider.

## Akış
1. Ürün sayfası "Tasarla ve sepete ekle" → `/tasarla/[slug]` (renk, adet, yazı, ≤8 fotoğraf, not, "siz hazırlayın"). Lüks Kupa'da canlı önizleme. Ana sayfa vitrini de sepete ekler.
2. `/sepet`: satır başına küçük görsel, Düzenle, adet. Ad + telefon zorunlu; il/ilçe/adres isteğe bağlı; KVKK onayı.
3. "Siparişi oluştur" → fotoğraflar yüklenir → `/siparis/<anahtar>` → "WhatsApp'tan gönderin" (mesajda yalnız bağlantı).

## Veri
- Cihaz: sepet `localStorage` (`kartabaski-cart-v1`), fotoğraflar IndexedDB (`lib/cart-files.ts`). Sipariş tamamlanana kadar hiçbir fotoğraf yüklenmez.
- Firestore `siparis_talepleri/<32 hex>`; yalnız Admin SDK. Durum: `yukleniyor` → `yeni` → `incelendi` / `siparis` / `tamamlandi` / `iptal`.
- Görseller Cloudinary `karta-baski/siparisler`, `type=authenticated`; yalnız `/api/siparis/<anahtar>/gorsel` üzerinden (sunucu kimliğin siparişe ait olduğunu denetler).

## Gizlilik
- Müşteri görünümünde telefon maskeli, açık adres gösterilmez.
- Müşteri sipariş üretime alınmadan önce siparişini ve fotoğraflarını silebilir.
- Cron: yarım kalan yüklemeler 1 gün sonra, tamamlanan/iptal siparişlerin fotoğrafları 30 gün sonra silinir.
- `/gizlilik` KVKK aydınlatma taslağı (hukuki kontrol işletmede).

## Yönetim
Tek menü `/admin/siparisler`: liste, ayrıntı, orijinal indirme, müşteriye WhatsApp, durum, iç not, üretim hattına aktarma (`createOrderFromCart`), silme. Eski Sepet Talepleri ve Tasarım Siparişleri modülleri kaldırılır (kayıt yoktu).

## Sonraki aşamalar
2: durum çizelgesi, baskı önizlemesi onayı, kargo takip no. 3: konfigüratör aynı sepete.
