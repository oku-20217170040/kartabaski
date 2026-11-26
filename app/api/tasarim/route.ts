import { NextRequest, NextResponse } from 'next/server';
import { createDesign } from '@/lib/designs';
import { DesignInputSchema, MAX_DESIGN_FILE_BYTES } from '@/lib/design-types';
import { clientIp, failure, tooLarge, tooMany } from './respond';

export const dynamic = 'force-dynamic';

/** Yeni tasarım taslağı: ayarlar + (varsa) önizleme ve müşterinin fotoğrafı. */
export async function POST(req: NextRequest) {
  const limited = tooMany(`tasarim-yeni:${clientIp(req)}`, 8, 10 * 60 * 1000)
    ?? tooLarge(req, MAX_DESIGN_FILE_BYTES * 2 + 64 * 1024);
  if (limited) return limited;

  try {
    const form = await req.formData().catch(() => null);
    let raw: unknown = null;
    try { raw = JSON.parse(String(form?.get('data') ?? '')); } catch { /* aşağıda reddedilir */ }
    const input = DesignInputSchema.safeParse(raw);
    if (!form || !input.success) return NextResponse.json({ error: 'Tasarım bilgileri geçersiz.' }, { status: 400 });

    const preview = form.get('preview');
    const photo = form.get('photo');
    const token = await createDesign(
      input.data,
      preview instanceof Blob ? preview : null,
      photo instanceof Blob ? photo : null,
    );
    return NextResponse.json({ token });
  } catch (error) {
    return failure(error);
  }
}
