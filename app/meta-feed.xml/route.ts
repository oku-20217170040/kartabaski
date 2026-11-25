import { getProductsServer } from '@/lib/products-server';
import { buildMetaFeedXml } from '@/lib/meta-feed';
import { SITE_URL } from '@/lib/site';

// Meta Commerce katalog feed'i (Facebook/Instagram mağazası). Meta bu adresi zamanlanmış olarak okur;
// feed herkese açık ürün verisidir, gizli bilgi içermez. Build sırasında Firestore'a bağlanmamak için dinamik.
export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await getProductsServer();
  // Ürün verisi okunamazsa boş feed yayınlanmaz: Meta boş feed görürse kataloğu boşaltabilir.
  if (products.length === 0) {
    return new Response('Feed şu an kullanılamıyor', { status: 503, headers: { 'Retry-After': '300' } });
  }

  return new Response(buildMetaFeedXml(products, SITE_URL), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
