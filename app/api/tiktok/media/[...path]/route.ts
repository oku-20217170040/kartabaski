import { cloudinaryUrl } from '@/lib/format';
import { parseMediaPath } from '@/lib/tiktok-utils';

// TikTok fotoğrafı doğrulanmış alan adı önekinden çeker (https://www.kartabaski.com/api/tiktok/media/):
// Cloudinary'deki ürün görselini JPEG olarak aktarır. Yalnızca karta-baski/urunler/ klasörü kabul edilir.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const id = parseMediaPath(params.path ?? []);
  if (!id) return new Response('Not found', { status: 404 });
  const upstream = await fetch(cloudinaryUrl(id, 'f_jpg,q_auto,w_1080,c_limit'), { cache: 'no-store' }).catch(() => null);
  if (!upstream || !upstream.ok) return new Response('Not found', { status: 404 });
  return new Response(upstream.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
  });
}
