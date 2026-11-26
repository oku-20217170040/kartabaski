import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/siparis';
import { OrderInputSchema } from '@/lib/siparis-types';
import { failure, tooLarge, tooMany } from './respond';

export const dynamic = 'force-dynamic';

/** Sipariş açar (fotoğraflar ardından tek tek yüklenir). */
export async function POST(req: NextRequest) {
  const blocked = tooMany(req, 'siparis-yeni', 8, 10 * 60 * 1000) ?? tooLarge(req, 128 * 1024);
  if (blocked) return blocked;
  try {
    const input = OrderInputSchema.safeParse(await req.json().catch(() => null));
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0]?.message || 'Sipariş bilgileri geçersiz.' }, { status: 400 });
    }
    return NextResponse.json(await createOrder(input.data));
  } catch (error) {
    return failure(error);
  }
}
