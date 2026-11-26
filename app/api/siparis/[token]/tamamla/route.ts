import { NextRequest, NextResponse } from 'next/server';
import { completeOrder } from '@/lib/siparis';
import { ORDER_TOKEN_RE } from '@/lib/siparis-types';
import { notifyNewOrder } from '@/lib/bot';
import { failure, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

/** Yüklemeler bitti: sipariş panele düşer ve yöneticiye haber gider. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-tamamla', 20, 10 * 60 * 1000);
  if (blocked) return blocked;
  if (!ORDER_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const { order, first } = await completeOrder(params.token);
    if (first) await notifyNewOrder(order);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
