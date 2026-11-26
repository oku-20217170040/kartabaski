import { NextRequest, NextResponse } from 'next/server';
import { sendProof } from '@/lib/siparis';
import { MAX_PHOTO_BYTES, MAX_PROOF_IMAGES, MAX_PROOF_TEXT, ORDER_TOKEN_RE } from '@/lib/siparis-types';
import { getAdminSession } from '@/lib/require-admin';
import { failure, tooLarge } from '../../respond';

export const dynamic = 'force-dynamic';

/**
 * Yönetici baskı önizlemesi gönderir. Dosyalar sunucu eylemi sınırını aştığı için API yolu kullanılır;
 * oturum çerezi SameSite=Lax olduğundan başka siteden gönderilen form oturum taşımaz.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  const blocked = tooLarge(req, MAX_PHOTO_BYTES * MAX_PROOF_IMAGES + 64 * 1024);
  if (blocked) return blocked;
  if (!ORDER_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const form = await req.formData().catch(() => null);
    const files = (form?.getAll('file') ?? []).filter((f): f is File => f instanceof Blob);
    const message = String(form?.get('message') ?? '').trim().slice(0, MAX_PROOF_TEXT);
    return NextResponse.json({ proof: await sendProof(params.token, files, message || undefined) });
  } catch (error) {
    return failure(error);
  }
}
