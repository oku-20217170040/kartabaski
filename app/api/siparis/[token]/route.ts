import { NextRequest, NextResponse } from 'next/server';
import { deleteByCustomer } from '@/lib/siparis';
import { ORDER_TOKEN_RE, orderNo } from '@/lib/siparis-types';
import { notifyAdmin } from '@/lib/notify';
import { failure, tooMany } from '../respond';

export const dynamic = 'force-dynamic';

/** Müşteri siparişini ve fotoğraflarını siler (üretime alınmadan önce). */
export async function DELETE(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-sil', 10, 10 * 60 * 1000);
  if (blocked) return blocked;
  if (!ORDER_TOKEN_RE.test(params.token)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const order = await deleteByCustomer(params.token);
    if (order.status !== 'yukleniyor') {
      await notifyAdmin(`Müşteri siparişini sildi (No: ${orderNo(order.token)})`, 'Fotoğrafları da kaldırıldı.').catch(() => false);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
