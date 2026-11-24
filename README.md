# KAR-TA BASKI — Kupa Baskı Katalog Sitesi

Next.js 14 + Firebase + Cloudinary ile geliştirilmiş kişiye özel kupa baskı kataloğu.
Sepet veya ödeme yoktur — tüm siparişler WhatsApp üzerinden alınır.

---

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

`.env.local.example` dosyasını kopyala ve doldur:

```bash
cp .env.local.example .env.local
```

Doldurulacak değişkenler:

```
NEXT_PUBLIC_PHONE=905458266508
NEXT_PUBLIC_PHONE_DISPLAY=0545 826 65 08
NEXT_PUBLIC_SITE_NAME=KAR-TA BASKI
NEXT_PUBLIC_SITE_URL=https://www.kartabaski.com

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 3. Firebase kurulumu

1. [Firebase Console](https://console.firebase.google.com) → Yeni proje oluştur
2. **Authentication** → Email/Password'ı aktifleştir
3. **Firestore Database** → Üret → Test modunda başlat
4. **Firestore Security Rules** (production için):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 4. Admin kullanıcısı oluştur

Firebase Authentication'da bir kullanıcı oluştur, ardından Firestore'a şu dokümanı ekle:

**Collection:** `users`  
**Document ID:** `{kullanıcı UID'si}`  
**Data:**
```json
{
  "role": "admin",
  "email": "admin@example.com"
}
```

### 5. Cloudinary kurulumu

1. [Cloudinary](https://cloudinary.com) hesabı aç
2. API Key ve Secret'ı `.env.local`'a ekle

---

## Geliştirme

```bash
npm run dev
```

→ http://localhost:3000

---

## Sayfalar

| Sayfa | URL |
|-------|-----|
| Ana Sayfa (Ürün Listesi) | `/` |
| Ürün Detay | `/urun/[slug]` |
| Kategoriler | `/kategoriler` |
| Nasıl Sipariş Verilir? | `/nasil-siparis-verilir` |
| Hakkımızda | `/hakkimizda` |
| Admin Giriş | `/admin/login` |
| Admin Dashboard | `/admin` |
| Ürün Yönetimi | `/admin/products` |
| Yeni Ürün | `/admin/products/new` |
| Ürün Düzenle | `/admin/products/[id]` |

---

## Ürün Kategorileri

- Seramik Kahve Fincanı
- Lüks Kupa
- Kahve Fincanı
- Latte Fincanı
- Pro Kupa
- Büyük Kupa
- Sihirli Kupa
- Özel Tasarım
- Kurumsal

(Kaynak: `lib/schemas.ts`)

---

## Deployment

Prodüksiyon: **Oracle Cloud (Docker)** — adım adım anlatım için [`docs/YAYIN.md`](docs/YAYIN.md). Vercel eski barındırmadır (Hobby plan 11 Kas 2026'da durduruldu); Railway kullanılmıyor.

---

## İşletme Bilgileri

- **Ad:** KAR-TA BASKI
- **Slogan:** Hayal Et, Biz Basalım
- **Telefon:** 0545 826 65 08
- **WhatsApp:** https://wa.me/905458266508
- **Hizmet:** Türkiye geneli online kupa baskı
