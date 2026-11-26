import { NextRequest, NextResponse } from 'next/server';
import { replyProof } from '@/lib/siparis';
import { ProofReplySchema, orderNo, orderUrl } from '@/lib/siparis-types';
import { notifyAdmin } from '@/lib/notify';
import { failure, tooLarge, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

/** Müşteri baskı önizlemesini onaylar ya da düzeltme ister. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-onay', 20, 10 * 60 * 1000) ?? tooLarge(req, 8 * 1024);
  if (blocked) return blocked;
  try {
    const body = ProofReplySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message || 'Geçersiz istek.' }, { status: 400 });
    const { order, proof } = await replyProof(params.token, body.data.round, body.data.decision, body.data.reply);
    await notifyAdmin(
      `${proof.state === 'onaylandi' ? 'Önizleme onaylandı' : 'Düzeltme istendi'} (No: ${orderNo(order.token)})`,
      [order.name, proof.reply, orderUrl(order.token)].filter(Boolean).join('\n'),
    ).catch(() => false);
    return NextResponse.json({ proof });
  } catch (error) {
    return failure(error);
  }
}
