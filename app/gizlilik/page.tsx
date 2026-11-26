import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { PHONE, PHONE_DISPLAY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Kişisel verilerin korunması',
  description: 'Sipariş verirken paylaştığınız bilgi ve fotoğrafların nasıl işlendiği, ne kadar saklandığı ve haklarınız.',
  alternates: { canonical: '/gizlilik' },
};

export default function GizlilikPage() {
  return (
    <>
      <Navbar />
      <main id="icerik">
        <div className="wrap">
          <header className="page-head">
            <h1 className="display">Bilgileriniz ve fotoğraflarınız</h1>
          </header>
          <div className="prose section">
            <p>
              KAR-TA BASKI olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında sipariş sürecinde
              paylaştığınız bilgilerin veri sorumlusuyuz.
            </p>
            <h2>Hangi bilgileri alıyoruz?</h2>
            <ul>
              <li>Ad soyad ve telefon numarası; isterseniz il, ilçe ve teslimat adresi</li>
              <li>Kupaya basılmasını istediğiniz fotoğraf, logo, çizim ve yazılar</li>
              <li>Siparişle ilgili notlarınız, baskı önizlemesine verdiğiniz cevaplar ve kargo takip bilgisi</li>
            </ul>
            <h2>Ne için kullanıyoruz?</h2>
            <p>
              Siparişinizi hazırlamak, size ulaşmak, baskıyı yapmak ve kargolamak için (sözleşmenin kurulması ve ifası);
              yasal yükümlülüklerimizi yerine getirmek için. Fotoğraflarınızı reklam ya da tanıtımda izniniz olmadan kullanmayız.
            </p>
            <h2>Nerede saklanıyor, kimlerle paylaşılıyor?</h2>
            <p>
              Sipariş kayıtları Google Firebase, görseller Cloudinary altyapısında tutulur; bu hizmetlerin sunucuları yurt
              dışında olabilir. Kargo için ad, telefon ve adresiniz kargo firmasıyla paylaşılır. WhatsApp’tan yazdığınızda
              mesajınız WhatsApp’ın koşullarına tabidir; hazır mesajımıza yalnızca sipariş bağlantınız eklenir.
            </p>
            <p>
              Sipariş bağlantınızı bilen kişi sipariş sayfanızı ve fotoğraflarınızı görebilir. Sayfada telefonunuz maskeli
              gösterilir, açık adresiniz gösterilmez. Bağlantıyı yalnızca güvendiğiniz kişilerle paylaşın.
            </p>
            <p>
              Sipariş takibi sayfasında yalnızca sipariş kodunu giren kişi siparişin aşamasını, kargo takip bilgisini ve
              ürün adlarını, adetlerini ve renklerini görür; fotoğraflar, yazılar, ad ve telefon gösterilmez.
            </p>
            <h2>Ne kadar saklıyoruz?</h2>
            <ul>
              <li>Sipariş oluşturulana kadar fotoğraflarınız yalnızca kendi cihazınızda durur.</li>
              <li>Yüklemesi yarım kalan siparişler 1 gün sonra silinir.</li>
              <li>Tamamlanan ya da iptal edilen siparişlerin fotoğrafları 30 gün sonra silinir.</li>
              <li>Sipariş ve muhasebe bilgileri yasal saklama süreleri boyunca tutulabilir.</li>
            </ul>
            <h2>Haklarınız</h2>
            <p>
              Siparişinizin ve fotoğraflarınızın silinmesini isteyebilirsiniz. KVKK’nın 11. maddesindeki haklarınız
              (bilgi alma, düzeltme, silme, itiraz) için <a href="mailto:info@kartabaski.com">info@kartabaski.com</a> adresine ya da{' '}
              <a href={`tel:+${PHONE}`}>{PHONE_DISPLAY}</a> numarasına başvurabilirsiniz.
            </p>
            <p><Link href="/">Ana sayfaya dönün</Link></p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
