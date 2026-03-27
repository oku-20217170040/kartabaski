import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export async function POST(req: NextRequest) {
  // Sadece oturum açmış adminler silebilir
  const session = cookies().get('__session');
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Cloudinary yapılandırması eksik.' }, { status: 500 });
  }

  const { publicIds } = await req.json();
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await Promise.allSettled(
    publicIds.map(async (publicId: string) => {
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
