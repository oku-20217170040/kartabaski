import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminSession } from '@/lib/require-admin';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const ALLOWED_PREFIX = 'karta-baski/';
const MAX_IDS = 50;

export async function POST(req: NextRequest) {
  // Sadece doğrulanmış adminler silebilir
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Cloudinary yapılandırması eksik.' }, { status: 500 });
  }

  let body: { publicIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const { publicIds } = body;
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return NextResponse.json({ ok: true });
  }
  if (publicIds.length > MAX_IDS) {
    return NextResponse.json({ error: `En fazla ${MAX_IDS} görsel silinebilir.` }, { status: 400 });
  }
  const valid = publicIds.every(
    (id) => typeof id === 'string' && id.startsWith(ALLOWED_PREFIX) && !id.includes('..') && !/[&=\s]/.test(id)
  );
  if (!valid) {
    return NextResponse.json({ error: 'Geçersiz görsel kimliği.' }, { status: 400 });
  }

  await Promise.allSettled(
    (publicIds as string[]).map(async (publicId) => {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto
        .createHash('sha256')
        .update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
        .digest('hex');

      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', API_KEY);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
        { method: 'POST', body: form }
      );
      if (!res.ok) {
        console.error(`Cloudinary delete failed for ${publicId}:`, await res.text());
      }
    })
  );

  return NextResponse.json({ ok: true });
}
