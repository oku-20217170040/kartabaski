import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { getInvite, inviteCookieHash, trackReviewUpload, cleanupExpiredReviewUploads } from '@/lib/reviews';
import { inviteAccess, REVIEW_IMAGE_FOLDER, MAX_REVIEW_IMAGES, isAllowedReviewImage } from '@/lib/reviews-utils';

// Yorum fotoğrafı: yalnızca geçerli (kullanılmamış, süresi dolmamış) bağlantıyı ilk açan cihaz yükleyebilir.
// Ek korumalar: IP ve bağlantı başına sınır, boyut sınırı, magic byte doğrulaması.
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`upload-review:${ip}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Çok fazla yükleme yaptınız. Lütfen biraz sonra tekrar deneyin.' }, { status: 429 });
  }
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Yükleme şu an kullanılamıyor.' }, { status: 500 });
  }

  // Gövde boyutu: formData okunmadan önce reddet (multipart ek yükü için küçük pay)
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (!contentLength || contentLength > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Fotoğraf 6 MB’dan büyük olamaz.' }, { status: 413 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  const token = String(formData?.get('token') ?? '');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });

  const invite = await getInvite(token).catch(() => null);
  if (inviteAccess(invite, inviteCookieHash(token)) !== 'ok') {
    return NextResponse.json({ error: 'Yorum bağlantısı geçersiz veya süresi dolmuş.' }, { status: 403 });
  }
  // bağlantı başına en fazla (MAX + birkaç yeniden deneme) yükleme
  if (!rateLimit(`upload-review-token:${token}`, MAX_REVIEW_IMAGES * 2, 6 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Bu yorum için fotoğraf sınırına ulaşıldı.' }, { status: 429 });
  }

  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Fotoğraf 6 MB’dan büyük olamaz.' }, { status: 413 });
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!isAllowedReviewImage(head)) {
    return NextResponse.json({ error: 'Yalnızca JPG, PNG veya WebP fotoğraf yüklenebilir.' }, { status: 400 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${REVIEW_IMAGE_FOLDER}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha256').update(paramsToSign + API_SECRET).digest('hex');

  const cloudForm = new FormData();
  cloudForm.append('file', file);
  cloudForm.append('api_key', API_KEY);
  cloudForm.append('timestamp', String(timestamp));
  cloudForm.append('signature', signature);
  cloudForm.append('folder', REVIEW_IMAGE_FOLDER);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: cloudForm });
  if (!res.ok) {
    console.error('Cloudinary upload-review error:', await res.text().catch(() => ''));
    return NextResponse.json({ error: 'Fotoğraf yüklenemedi.' }, { status: 500 });
  }

  const data = await res.json();
  await trackReviewUpload(data.public_id).catch((e) => console.error('[upload-review] takip kaydı:', e));
  if (Math.random() < 0.1) cleanupExpiredReviewUploads().catch(() => {});
  return NextResponse.json({ public_id: data.public_id });
}
