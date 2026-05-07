/**
 * Musteri referanslari / yorumlari bilesen.
 * Kurumsal sayfada ve ana sayfada kullanilabilir.
 *
 * Gercek musterilerden gelen yorumlarla degistirmek icin
 * asagidaki TESTIMONIALS dizisini guncelleyin.
 */

const TESTIMONIALS = [
  {
    name: 'Elif Y.',
    role: 'Guzellik Salonu Sahibi',
    text: 'Salonumuz icin 30 adet logolu kupa yaptirdik. Musterilerimize hediye ediyoruz, cok begendiler. Tasarim destegi mukemmeldi.',
    rating: 5,
    type: 'kurumsal' as const,
  },
  {
    name: 'Ahmet K.',
    role: 'Bireysel Musteri',
    text: 'Esimin dogum gunu icin sihirli kupa siparis ettim. Fotograf sicak suyla belirince cok sasirdi. Harika bir hediye oldu!',
    rating: 5,
    type: 'bireysel' as const,
  },
  {
    name: 'Deniz A.',
    role: 'IK Muduru',
    text: 'Sirketimizde her yeni calisana hosgeldin kupasi veriyoruz. 50+ adet siparis verdik, fiyat ve kalite cok uygundu.',
    rating: 5,
    type: 'kurumsal' as const,
  },
  {
    name: 'Selin M.',
    role: 'Ogretmen',
    text: 'Ogrencilerime donem sonu hediyesi olarak kisisellestirilmis kupalar aldim. Hepsinin ismi yaziliydi, cok mutlu oldular.',
    rating: 5,
    type: 'bireysel' as const,
  },
  {
    name: 'Burak T.',
    role: 'Kafe Isletmecisi',
    text: 'Kafemiz icin ozel tasarim latte fincanlari yaptirdik. Musteriler soruyor nereden aldik diye. Kalite gercekten iyi.',
    rating: 5,
    type: 'kurumsal' as const,
  },
  {
    name: 'Zeynep D.',
    role: 'Bireysel Musteri',
    text: 'Arkadasima yurtdisindan kupa gonderttim. Paketleme cok ozenli geldi, kupa sapasaglam ulasti. Tesekkurler!',
    rating: 5,
    type: 'bireysel' as const,
  },
];

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--accent)">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

interface TestimonialsProps {
  filter?: 'kurumsal' | 'bireysel';
  maxItems?: number;
}

export default function Testimonials({ filter, maxItems }: TestimonialsProps) {
  const items = filter
    ? TESTIMONIALS.filter((t) => t.type === filter)
    : TESTIMONIALS;

  const display = maxItems ? items.slice(0, maxItems) : items;

  return (
    <div className="testimonials-grid">
      {display.map((t) => (
        <div key={t.name} className="testimonial-card">
          <div className="testimonial-stars">
            {Array.from({ length: t.rating }).map((_, i) => (
              <StarIcon key={i} />
            ))}
          </div>
          <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
          <div className="testimonial-author">
            <div className="testimonial-avatar">{t.name.charAt(0)}</div>
            <div>
              <div className="testimonial-name">{t.name}</div>
              <div className="testimonial-role">{t.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
