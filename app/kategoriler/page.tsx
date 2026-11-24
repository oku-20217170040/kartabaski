import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { getProductsServer } from '@/lib/products-server';
import { cloudinaryUrl } from '@/lib/format';
import { getActive, getCategory } from '@/lib/product-utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Kategoriler',
  description: 'Kupa, kahve fincanı ve özel tasarım baskı ürünlerini kategoriye göre inceleyin.',
  alternates: { canonical: '/kategoriler' },
};

const getProducts = unstable_cache(() => getProductsServer(), ['products'], {
  tags: ['products'],
  revalidate: 3600,
});

export default async function KategorilerPage() {
  const products = (await getProducts()).filter(getActive);

  const groups = new Map<string, { count: number; image: string | null }>();
  for (const p of products) {
    const cat = getCategory(p);
    if (!cat) continue;
    const g = groups.get(cat) ?? { count: 0, image: null };
    g.count += 1;
    if (!g.image && p.images?.[0]) g.image = p.images[0];
    groups.set(cat, g);
  }
  const categories = Array.from(groups.entries());

  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <nav aria-label="Sayfa yolu">
              <ol className="breadcrumb">
                <li><Link href="/">Ana sayfa</Link></li>
                <li aria-current="page">Kategoriler</li>
              </ol>
            </nav>
            <h1 className="display">Kategoriler</h1>
            <p className="lead">Aradığınız kupa ya da fincan türünü seçin, o kategorideki tüm ürünleri görün.</p>
          </header>
        </div>

        <section className="section" aria-label="Kategori listesi">
          <div className="wrap">
            {categories.length === 0 ? (
              <p className="muted">Şu an listelenecek ürün yok. Daha sonra tekrar bakın.</p>
            ) : (
              <div className="tile-grid">
                {categories.map(([cat, g]) => (
                  <Link key={cat} className="tile" href={`/?kategori=${encodeURIComponent(cat)}#urunler`}>
                    <div className="tile-media">
                      {g.image && (
                        <Image
                          src={g.image.startsWith('http') ? g.image : cloudinaryUrl(g.image, 'f_auto,q_auto,w_800,h_800,c_fill')}
                          alt={cat}
                          width={800}
                          height={800}
                          sizes="(max-width: 640px) 50vw, (max-width: 960px) 33vw, 25vw"
                        />
                      )}
                    </div>
                    <b>{cat}</b>
                    <span>{g.count} ürün</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
