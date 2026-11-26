import { NextRequest, NextResponse } from 'next/server';
import { completeOrder } from '@/lib/siparis';
import { ORDER_TOKEN_RE, orderNo, orderUrl } from '@/lib/siparis-types';
import { notifyAdmin } from '@/lib/notify';
import { failure, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

/** Yüklemeler bitti: sipariş panele düşer ve yöneticiye haber gider. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-tamamla', 20, 10 * 60 * 1000);
  if (blocked) return blocked;
  if (!ORDER_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const { order, first } = await completeOrder(params.token);
    if (first) {
      const lines = order.items.map((i, n) => `${n + 1}) ${i.title} x${i.qty}${i.color ? ` (${i.color})` : ''}`);
      await notifyAdmin(
        `Yeni sipariş (No: ${orderNo(order.token)})`,
        [...lines, `${order.name} · ${order.phone}`, orderUrl(order.token)].join('\n'),
      ).catch(() => false);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
