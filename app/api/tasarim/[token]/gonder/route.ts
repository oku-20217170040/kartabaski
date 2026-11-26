import { NextRequest, NextResponse } from 'next/server';
import { submitDesign } from '@/lib/designs';
import { DESIGN_TOKEN_RE, designNo, designUrl } from '@/lib/design-types';
import { notifyAdmin } from '@/lib/notify';
import { clientIp, failure, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

/** Müşteri "WhatsApp'tan gönder"e bastığında taslak siparişe döner ve yöneticiye haber gider. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = tooMany(`tasarim-gonder:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (limited) return limited;
  if (!DESIGN_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const { design, first } = await submitDesign(params.token);
    if (first) {
      await notifyAdmin(
        `Yeni tasarım siparişi (No: ${designNo(design.token)})`,
        `${design.productTitle}\n${designUrl(design.token)}`,
      ).catch(() => false);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
