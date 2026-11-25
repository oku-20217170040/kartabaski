import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminSession } from '@/lib/require-admin';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const FOLDER = 'karta-baski/urunler';
const MAX_BYTES = 10 * 1024 * 1024;

const ascii = (b: Uint8Array, start: number, s: string) =>
  b.length >= start + s.length && s.split('').every((c, i) => b[start + i] === c.charCodeAt(0));

function isAllowedImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // jpeg
  if (b[0] === 0x89 && ascii(b, 1, 'PNG\r\n') && b[6] === 0x1a && b[7] === 0x0a) return true; // png
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return true; // gif
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return true; // webp
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return ['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
  }
  return false;
}

export async function POST(req: NextRequest) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Cloudinary yapılandırması eksik.' }, { status: 500 });
  }

  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  // Gövde boyutu: formData okunmadan önce reddet (multipart ek yükü için küçük pay)
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (!contentLength || contentLength > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Dosya 10 MB\'dan büyük olamaz.' }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Dosya 10 MB\'dan büyük olamaz.' }, { status: 413 });
  }

  // Gerçek içerik kontrolü (magic bytes) — client'ın file.type değerine güvenilmez
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (!isAllowedImage(head)) {
    return NextResponse.json({ error: 'Sadece görsel dosyaları yüklenebilir.' }, { status: 400 });
  }

  // İmzalı upload parametreleri (yalnızca beyaz listedeki klasörler kabul edilir)
  const targetFolder = formData.get('folder') === 'sosyal' ? 'karta-baski/sosyal' : FOLDER;
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${targetFolder}&timestamp=${timestamp}`;
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
  cloudForm.append('folder', targetFolder);

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
