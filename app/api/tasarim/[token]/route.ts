import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateDesign } from '@/lib/designs';
import { DESIGN_TOKEN_RE, MAX_DESIGN_NOTE } from '@/lib/design-types';
import { clientIp, failure, tooMany } from '../respond';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  note: z.string().trim().max(MAX_DESIGN_NOTE).optional(),
  productSlug: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/).optional(),
  color: z.string().max(60).optional(),
});

/** Müşteri notunu veya kupa seçimini günceller. */
export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = tooMany(`tasarim-duzenle:${clientIp(req)}`, 60, 10 * 60 * 1000);
  if (limited) return limited;
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!DESIGN_TOKEN_RE.test(params.token) || !body.success) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  try {
    await updateDesign(params.token, body.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
