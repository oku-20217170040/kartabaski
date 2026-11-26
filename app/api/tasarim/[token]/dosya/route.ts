import { NextRequest, NextResponse } from 'next/server';
import { addDesignFile, removeDesignFile } from '@/lib/designs';
import { DESIGN_TOKEN_RE, MAX_DESIGN_FILE_BYTES } from '@/lib/design-types';
import { clientIp, failure, tooLarge, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = tooMany(`tasarim-dosya:${clientIp(req)}`, 30, 10 * 60 * 1000)
    ?? tooLarge(req, MAX_DESIGN_FILE_BYTES + 64 * 1024);
  if (limited) return limited;
  if (!DESIGN_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const file = (await req.formData().catch(() => null))?.get('file');
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });
    return NextResponse.json({ id: await addDesignFile(params.token, file) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = tooMany(`tasarim-dosya:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (limited) return limited;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!DESIGN_TOKEN_RE.test(params.token) || !id) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    await removeDesignFile(params.token, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
