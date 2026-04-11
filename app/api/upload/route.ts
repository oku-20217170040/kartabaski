import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const FOLDER = 'karta-baski/urunler';

export async function POST(req: NextRequest) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Cloudinary yapılandırması eksik.' }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });
  }

  // Dosya boyutu kontrolü: max 10 MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Dosya 10 MB\'dan büyük olamaz.' }, { status: 400 });
  }

  // Dosya türü kontrolü
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Sadece görsel dosyaları yüklenebilir.' }, { status: 400 });
  }

  // İmzalı upload parametreleri
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${FOLDER}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + API_SECRET)
    .digest('hex');

  // Cloudinary'e yükle
  const cloudForm = new FormData();
  cloudForm.append('file', file);
  cloudForm.append('api_key', API_KEY);
  cloudForm.append('timestamp', String(timestamp));
  cloudForm.append('signature', signature);
  cloudForm.append('folder', FOLDER);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: cloudForm }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Cloudinary upload error:', err);
    return NextResponse.json({ error: 'Görsel yüklenemedi.' }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ public_id: data.public_id });
}
