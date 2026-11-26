import { NextRequest, NextResponse } from 'next/server';
import { getOrderRequest } from '@/lib/siparis';
import { orderImageIds } from '@/lib/siparis-types';
import { signedImageUrl } from '@/lib/cloudinary-private';
import { failure, tooMany } from '../../respond';

export const dynamic = 'force-dynamic';

// Bir sayfa açılışında onlarca görsel istenir: sipariş belgesi kısa süre bellekte tutulur (Firestore kotası).
const cache = new Map<string, { at: number; ids: Set<string> }>();
const CACHE_MS = 20_000;

async function allowedIds(token: string): Promise<Set<string>> {
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ids;
  const order = await getOrderRequest(token);
  const ids = new Set(order ? orderImageIds(order) : []);
  if (cache.size > 500) cache.clear();
  if (order) cache.set(token, { at: Date.now(), ids });
  return ids;
}

/** Kapalı depodaki sipariş görselini, yalnız o siparişe aitse akıtır. */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const blocked = tooMany(req, 'siparis-gorsel', 600, 10 * 60 * 1000);
  if (blocked) return blocked;
  try {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (!(await allowedIds(params.token)).has(id)) return NextResponse.json({ error: 'Görsel bulunamadı.' }, { status: 404 });
    const width = Number(req.nextUrl.searchParams.get('w'));
    const transform = width === 240 || width === 900 ? `c_limit,q_auto,w_${width}` : '';
    const upstream = await fetch(signedImageUrl(id, transform), { cache: 'no-store' });
    const type = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !type.startsWith('image/')) return NextResponse.json({ error: 'Görsel alınamadı.' }, { status: 502 });
    const headers: Record<string, string> = {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex',
    };
    if (req.nextUrl.searchParams.get('indir')) {
      const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      headers['Content-Disposition'] = `attachment; filename="siparis-${params.token.slice(0, 6)}-${id.split('/').pop()}.${ext}"`;
    }
    return new NextResponse(upstream.body, { headers });
  } catch (error) {
    return failure(error);
  }
}
