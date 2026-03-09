# Ümit Spot — Ürün Katalog Sitesi

Next.js 14 + Firebase + Cloudinary ile geliştirilmiş spot mağaza kataloğu.

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
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dshbqbtpb
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=spot_urun
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
2. **Settings → Upload** → Upload preset ekle:
   - Preset name: `spot_urun`
   - Signing mode: **Unsigned**
   - Folder: `umit-spot/urunler`

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
| Admin Giriş | `/admin/login` |
| Admin Dashboard | `/admin` |
| Ürün Yönetimi | `/admin/products` |
| Yeni Ürün | `/admin/products/new` |
| Ürün Düzenle | `/admin/products/[id]` |

---

## Vercel Deployment

1. [Vercel](https://vercel.com) hesabı aç
2. Projeyi GitHub'a push et
3. Vercel'de "Import Project" → GitHub repo'nu seç
4. Environment Variables bölümüne `.env.local` değişkenlerini gir
5. Deploy!

---

## Mağaza Bilgileri

- **Ad:** Ümit Spot
- **Adres:** Mehmet Akif Ersoy Mah. 1824 Sk. 11A, Esenyurt / İstanbul
- **Telefon:** 0542 644 72 96
- **Saat:** Her gün 09:00 – 00:00
