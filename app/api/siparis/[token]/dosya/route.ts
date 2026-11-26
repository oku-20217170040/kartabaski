import { NextRequest, NextResponse } from 'next/server';
import { addOrderImage } from '@/lib/siparis';
import { MAX_PHOTO_BYTES, ORDER_TOKEN_RE } from '@/lib/siparis-types';
import { failure, tooLarge, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-dosya', 300, 10 * 60 * 1000) ?? tooLarge(req, MAX_PHOTO_BYTES + 64 * 1024);
  if (blocked) return blocked;
  if (!ORDER_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const line = Number(form?.get('line'));
    const kind = form?.get('kind') === 'preview' ? 'preview' : 'photo';
    if (!(file instanceof Blob) || !Number.isInteger(line) || line < 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });
    }
    await addOrderImage(params.token, line, kind, file);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
