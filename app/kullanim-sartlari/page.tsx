import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Kullanım şartları',
  description: 'KAR-TA BASKI online mağazasında sipariş, fiyat, önizleme onayı, teslimat ve iade koşulları.',
  alternates: { canonical: '/kullanim-sartlari' },
};

export default function KullanimSartlariPage() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <h1 className="display">Kullanım şartları</h1>
          </header>
          <div className="prose section">
            <p>
              Bu sayfa KAR-TA BASKI online mağazasının (kartabaski.com) kullanımını ve verilen siparişleri düzenler. Siteyi
              kullanarak ya da sipariş vererek bu koşulları kabul etmiş olursunuz.
            </p>
            <h2>Satıcı ve sipariş</h2>
            <p>
              KAR-TA BASKI, kişiye özel kupa ve fincan baskısı yapan online bir mağazadır. Sepetinizde oluşturduğunuz
              sipariş talebi, fiyat ve teslimat bilgisinin WhatsApp üzerinden onaylanmasıyla kesinleşir. Sitede ödeme
              alınmaz; ödeme sipariş onayından sonra size bildirilen yöntemle yapılır.
            </p>
            <h2>Fiyat</h2>
            <p>
              Sitede yazan fiyatlar Türk Lirası cinsindendir ve ürüne ve adede göre değişir. Sipariş adedinizin ve
              ürününüzün son fiyatı, sipariş onayı sırasında yazılı olarak size bildirilir.
            </p>
            <h2>Baskı önizlemesi ve onay</h2>
            <p>
              Kendi fotoğrafınızı ya da yazınızı yüklediğinizde size bir baskı önizlemesi gösterilir. Önizlemeyi onaylamadan
              baskıya geçilmez. Onayladıktan sonra tasarımın içeriğinden ve haklarından siz sorumlusunuz; başkasına ait
              görsel, logo ya da marka kullanmamanız gerekir.
            </p>
            <h2>Teslimat</h2>
            <p>
              Ürünler iş günü içinde baskıya alınıp kargoya verilir; teslimat süresi genellikle yaklaşık 3 iş günüdür.
              Kargo süresi ve kargo ücreti, bulunduğunuz yere ve kargo firmasının koşullarına göre değişebilir.
            </p>
            <h2>İade ve değişim</h2>
            <p>
              Kişiye özel baskılı ürünler sizin tasarımınıza göre üretildiği için, tasarımda bizden kaynaklanan bir hata ya
              da ürünün ayıplı gelmesi durumu dışında iade alınmaz. Hasarlı ya da hatalı ürünü teslim aldığınız tarihten
              itibaren kısa sürede bize fotoğrafla bildirin; ürünü yenileyelim ya da bedelini iade edelim.
            </p>
            <h2>İletişim</h2>
            <p>
              Sorularınız için WhatsApp üzerinden bize ulaşabilirsiniz. Kişisel verilerinizin işlenmesi hakkında bilgi için
              <a href="/gizlilik"> Kişisel verilerin korunması</a> sayfasına bakın.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
