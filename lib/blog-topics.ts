// Blog konu bankası (saf, testli): kupa baskıya özel sabit konular, özel gün takvimi, kategori rehberleri ve
// Arama Motoru ayarlarındaki "anahtar kelime hedefleri"nden türetilen konular. Üretim (şablon ya da LLM) bu
// konuları `lib/blog-draft.ts` ile yazıya çevirir; hangi konunun sırada olduğunu `pickNextTopic` belirler.
import { trTime, trDayKey, DAY_MS } from './tr-time';
import { slugifyHeading } from './markdown';
import type { FaqItem } from './posts-types';
import type { Category } from '@/types';

export interface TopicSection { h: string; p: string } // p: Markdown (paragraf ya da "- madde" listesi)

export type TopicKind = 'evergreen' | 'occasion' | 'category' | 'keyword';

export interface BlogTopic {
  id: string; // kullanıldı takibi için kalıcı kimlik (özel günlerde yıl dahil)
  kind: TopicKind;
  title: string;
  excerpt: string;
  intro: string;
  sections: TopicSection[];
  faq: FaqItem[];
  tags: string[];
  categories: Category[]; // ürün eşleştirmede tercih edilen kategoriler
  occasion?: { id: string; name: string; date: number; leadDays: number };
  keyword?: string;
}

// ── Özel gün takvimi ─────────────────────────────────────────────────────────

export interface OccasionDef {
  id: string;
  name: string;
  leadDays: number; // gün öncesinden yazı öne alınır
  /** Verilen yıl için günün TSİ gece yarısı (ms). */
  dateOf: (year: number) => number;
  who: string; // kime hediye
  ideas: string[]; // tasarım fikirleri
  categories: Category[];
  note?: string;
}

const fixed = (m: number, d: number) => (y: number) => trTime(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, 0);

/** Ayın n. pazarı (n=2: ikinci pazar). */
function nthSunday(y: number, month: number, n: number): number {
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay(); // 0 = pazar
  const day = 1 + ((7 - first) % 7) + (n - 1) * 7;
  return trTime(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, 0);
}

// Dinî bayram tarihleri (Diyanet takvimine göre bayramın ilk günü). Takvim her yıl kontrol edilmeli;
// tabloda olmayan yıl için o bayram atlanır (yanlış tarihle yazı üretmemek için).
const BAYRAM: Record<'ramazan' | 'kurban', Record<number, string>> = {
  ramazan: { 2026: '2026-03-20', 2027: '2027-03-09', 2028: '2028-02-27', 2029: '2029-02-14', 2030: '2030-02-04' },
  kurban: { 2026: '2026-05-27', 2027: '2027-05-16', 2028: '2028-05-05', 2029: '2029-04-24', 2030: '2030-04-13' },
};
const bayram = (k: 'ramazan' | 'kurban') => (y: number) => (BAYRAM[k][y] ? trTime(BAYRAM[k][y], 0) : 0);

export const OCCASIONS: OccasionDef[] = [
  {
    id: 'sevgililer-gunu', name: 'Sevgililer Günü', leadDays: 21, dateOf: fixed(2, 14),
    who: 'sevgiliniz ya da eşiniz',
    ideas: ['Birlikte çekilmiş en sevdiğiniz fotoğraf', 'İkinizin tanışma tarihi ve ortak bir söz', 'Sihirli kupada ısınınca ortaya çıkan sürpriz mesaj', 'Eş kupalar: aynı tasarımın iki farklı renk versiyonu'],
    categories: ['Sihirli Kupa', 'Lüks Kupa', 'Özel Tasarım'],
  },
  {
    id: 'kadinlar-gunu', name: 'Kadınlar Günü', leadDays: 14, dateOf: fixed(3, 8),
    who: 'annenize, arkadaşınıza ya da çalışma arkadaşlarınıza',
    ideas: ['Kişinin adı ve sevdiği bir söz', 'Çiçek ve pastel renklerde sade bir tasarım', 'Ofis için isim baskılı ortak kupa seti', 'Birlikte çekilmiş bir anı fotoğrafı'],
    categories: ['Lüks Kupa', 'Latte Fincanı', 'Kurumsal'],
    note: 'Çalışanlarınıza toplu hediye düşünüyorsanız kurumsal sipariş seçeneğiyle her kupaya ayrı isim bastırabilirsiniz.',
  },
  {
    id: 'ramazan-bayrami', name: 'Ramazan Bayramı', leadDays: 14, dateOf: bayram('ramazan'),
    who: 'aile büyüklerinize ve sevdiklerinize',
    ideas: ['Bayram mesajı ve kaligrafik yazı', 'Torunlarının fotoğrafıyla büyükanne ve büyükbaba kupası', 'Ailenin soyadıyla bayram hatırası', 'Kahve ve lokum sofrasına uygun şık fincanlar'],
    categories: ['Seramik Kahve Fincanı', 'Kahve Fincanı', 'Lüks Kupa'],
  },
  {
    id: 'kurban-bayrami', name: 'Kurban Bayramı', leadDays: 14, dateOf: bayram('kurban'),
    who: 'bayramda ziyaret edeceğiniz akrabalara',
    ideas: ['Bayram tebriği ve aile adı', 'Aile fotoğrafı baskılı hatıra kupası', 'Misafirlere ikram için isimli kahve fincanı seti', 'Sade ve zarif yazı tasarımı'],
    categories: ['Seramik Kahve Fincanı', 'Kahve Fincanı', 'Büyük Kupa'],
  },
  {
    id: 'anneler-gunu', name: 'Anneler Günü', leadDays: 21, dateOf: (y) => nthSunday(y, 5, 2),
    who: 'annenize',
    ideas: ['Çocukların el yazısıyla yazılmış "Annem" mesajı', 'Anne ve çocuklarının birlikte çekildiği fotoğraf', 'Torunların fotoğraflarından oluşan kolaj', 'Annenizin en sevdiği çiçekle isim tasarımı'],
    categories: ['Lüks Kupa', 'Sihirli Kupa', 'Latte Fincanı'],
  },
  {
    id: 'babalar-gunu', name: 'Babalar Günü', leadDays: 21, dateOf: (y) => nthSunday(y, 6, 3),
    who: 'babanıza',
    ideas: ['"Dünyanın en iyi babası" gibi esprili bir yazı', 'Baba ve çocukların birlikte çekilmiş fotoğrafı', 'Babanızın hobisini ya da tuttuğu takımı yansıtan tasarım', 'Büyük kapasiteli kupada isim ve unvan baskısı'],
    categories: ['Büyük Kupa', 'Pro Kupa', 'Özel Tasarım'],
  },
  {
    id: 'mezuniyet', name: 'Mezuniyet', leadDays: 21, dateOf: fixed(6, 15),
    who: 'mezun olan arkadaşınıza ya da kardeşinize',
    ideas: ['Bölüm, mezuniyet yılı ve ad-soyad baskısı', 'Sınıf fotoğrafı ve ortak anı kolajı', 'Okul logosu ve mezuniyet sloganı', 'Sınıf arkadaşlarına toplu isimli kupa seti'],
    categories: ['Özel Tasarım', 'Pro Kupa', 'Kurumsal'],
    note: 'Sınıf ya da bölüm olarak toplu sipariş verirseniz her kupaya ayrı isim yazdırabilirsiniz.',
  },
  {
    id: 'ogretmenler-gunu', name: 'Öğretmenler Günü', leadDays: 21, dateOf: fixed(11, 24),
    who: 'öğretmeninize',
    ideas: ['Sınıfın imzalarından oluşan teşekkür kolajı', 'Öğretmenin adı ve ders adıyla zarif bir yazı', 'Öğrencilerin çizimlerinden oluşan tasarım', '"İyi ki öğretmenimsiniz" mesajlı sade kupa'],
    categories: ['Lüks Kupa', 'Kahve Fincanı', 'Özel Tasarım'],
    note: 'Sınıf velileri ortak sipariş verirse tek tasarımla öğretmene uygun fiyatlı, anlamlı bir hediye hazırlanır.',
  },
  {
    id: 'yilbasi', name: 'Yılbaşı', leadDays: 30, dateOf: fixed(12, 31),
    who: 'sevdiklerinize ve iş arkadaşlarınıza',
    ideas: ['Yeni yıl mesajı ve yıl baskısı', 'Kış temalı, karlı ve sıcak renkli tasarımlar', 'Ofis için yılbaşı hediye seti', 'Sihirli kupada ısınınca beliren yeni yıl dileği'],
    categories: ['Sihirli Kupa', 'Lüks Kupa', 'Kurumsal'],
    note: 'Yılbaşı öncesi kargo yoğunluğu arttığı için siparişi erken vermek en güvenli yoldur.',
  },
  {
    id: 'dunya-kahve-gunu', name: 'Dünya Kahve Günü', leadDays: 10, dateOf: fixed(10, 1),
    who: 'kahve tutkunu arkadaşlarınıza',
    ideas: ['Favori kahve türünüzün adı ve basit bir ikon', 'Latte sanatına uygun geniş ağızlı fincan', 'Kafe ya da ofis için logolu kahve fincanı', 'İsim baskılı seramik espresso fincanı'],
    categories: ['Latte Fincanı', 'Kahve Fincanı', 'Seramik Kahve Fincanı'],
  },
];

/** Günün başlangıcı (TSİ). */
const dayStart = (now: number) => trTime(trDayKey(now), 0);

export interface UpcomingOccasion { def: OccasionDef; year: number; date: number; daysLeft: number }

/** Önümüzdeki `horizonDays` içinde (bugün dahil) gerçekleşecek özel günler, yakın olan önce. */
export function upcomingOccasions(now: number, horizonDays = 45): UpcomingOccasion[] {
  const today = dayStart(now);
  const y = Number(trDayKey(now).slice(0, 4));
  const out: UpcomingOccasion[] = [];
  for (const def of OCCASIONS) {
    for (const year of [y, y + 1]) {
      const date = def.dateOf(year);
      if (!date) continue;
      const daysLeft = Math.round((date - today) / DAY_MS);
      if (daysLeft >= 0 && daysLeft <= horizonDays) out.push({ def, year, date, daysLeft });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

// ── Konu üreticileri ─────────────────────────────────────────────────────────

const trDate = (ms: number) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

export function occasionTopic(def: OccasionDef, year: number, date: number): BlogTopic {
  const orderBy = trDate(date - 7 * DAY_MS);
  const name = def.name;
  return {
    id: `occ-${def.id}-${year}`,
    kind: 'occasion',
    title: `${name} İçin Kişiye Özel Kupa Hediye Fikirleri (${year})`,
    excerpt: `${name} yaklaşırken ${def.who} ne alsanız diye düşünüyorsanız: kişiye özel kupa baskı fikirleri, doğru model seçimi ve siparişin ne zamana kadar verilmesi gerektiği.`,
    intro: `${name} (${trDate(date)}) yaklaşırken en büyük soru hep aynı: ${def.who} ne hediye edeceksiniz? Mağazadan alınan hazır bir ürün çoğu zaman unutulur; ama üzerinde kendi fotoğrafınız, adınız ya da sözünüz olan bir kupa her sabah kullanılır ve her seferinde sizi hatırlatır. Bu yazıda ${name} için kupa hediyesini nasıl seçeceğinizi, hangi tasarımların işe yaradığını ve siparişi ne zamana kadar vermeniz gerektiğini anlatıyoruz.`,
    sections: [
      {
        h: `${name} için neden kişiye özel kupa?`,
        p: `Kişiye özel kupa hem kullanışlı hem duygusal bir hediyedir. Günlük hayatta defalarca eline alınır, ofiste ya da evde masada durur. Üstelik baskı tasarımını siz belirlediğiniz için hediye ${def.who} tam olarak ona özel olur. Tek bir kupa da sipariş edebilirsiniz; minimum adet şartı yoktur.`,
      },
      {
        h: 'Tasarım fikirleri',
        p: def.ideas.map((i) => `- ${i}`).join('\n'),
      },
      {
        h: 'Hangi model size uygun?',
        p: `Sade ve şık bir hediye için seramik kupalar, sürpriz etkisi isteyenler için sihirli kupa (sıcak içecek koyunca görsel ortaya çıkar), kahve severler için ise fincan modelleri öne çıkar. Hacim, kulp ve renk seçeneklerini ürün sayfalarında görebilir, kararsız kalırsanız WhatsApp üzerinden bize yazıp öneri alabilirsiniz.${def.note ? ` ${def.note}` : ''}`,
      },
      {
        h: 'Siparişi ne zaman vermelisiniz?',
        p: `Tasarım onayından sonra siparişler genellikle 3 iş günü içinde kargoya verilir. Tasarım hazırlığı ve önizleme onayı için de zaman ayırmanız gerekir. ${name} öncesinde yoğunluk arttığı için siparişinizi en geç ${orderBy} tarihine kadar vermenizi öneririz; ne kadar erken yazarsanız tasarımı o kadar rahat ince ayar yapabiliriz.`,
      },
      {
        h: 'Tasarımı nasıl göndereceksiniz?',
        p: 'Fotoğrafı, logoyu ya da yazdırmak istediğiniz metni WhatsApp üzerinden göndermeniz yeterli. Hazır bir tasarımınız yoksa tasarımı ücretsiz hazırlıyoruz. Baskıdan önce dijital önizleme gönderiyoruz; siz onaylamadan baskı yapılmaz.',
      },
    ],
    faq: [
      { q: `${name} için sipariş en geç ne zaman verilmeli?`, a: `Tasarım onayından sonra kargo süresi yaklaşık 3 iş günüdür. ${name} öncesi yoğunluk olacağından siparişi en geç ${orderBy} tarihine kadar vermenizi öneririz.` },
      { q: 'Tek adet kupa sipariş edebilir miyim?', a: 'Evet. Minimum sipariş adedi yok; tek adet kupa da basıyoruz. Toplu siparişlerde adede göre özel fiyat sunuyoruz.' },
      { q: 'Hediye paketi ve not eklenebilir mi?', a: 'Sipariş sırasında WhatsApp üzerinden hediye notunuzu ve paketleme isteğinizi iletebilirsiniz.' },
    ],
    tags: [`${name.toLocaleLowerCase('tr-TR')} hediyesi`, 'kişiye özel kupa', 'hediye kupa', 'kupa baskı', `${year}`],
    categories: def.categories,
    occasion: { id: def.id, name, date, leadDays: def.leadDays },
  };
}

const CATEGORY_NOTES: Record<Category, { what: string; fits: string; tip: string }> = {
  'Seramik Kahve Fincanı': {
    what: 'Küçük hacimli, zarif seramik fincanlar; Türk kahvesi, espresso ve filtre kahve sofralarına uygundur.',
    fits: 'misafir ağırlayanlar, kahve sofrası sevenler, kafe ve ofis kullanımı',
    tip: 'Küçük yüzeyde kısa metin ve sade tasarım en iyi sonucu verir; ince detaylar küçülünce okunmaz.',
  },
  'Lüks Kupa': {
    what: 'Şık formlu, kaliteli seramik kupalar; hediyelik ve özel gün siparişlerinde en çok tercih edilen gruptur.',
    fits: 'hediye almak isteyenler, özel gün siparişleri, markalı hediye kutuları',
    tip: 'Hediye için fotoğraf ve kısa bir cümleyi birlikte kullanmak, kupayı kişisel kılar.',
  },
  'Kahve Fincanı': {
    what: 'Günlük kahve kullanımına uygun, orta hacimli fincanlar.',
    fits: 'ofis ve ev kullanımı, kahve tutkunları, takım hediyeleri',
    tip: 'Fincanın kulpunu ve iç rengini tasarımla uyumlu seçmek bütüncül bir görünüm sağlar.',
  },
  'Latte Fincanı': {
    what: 'Geniş ağızlı, büyük hacimli latte ve cappuccino fincanları.',
    fits: 'latte sanatı sevenler, sütlü kahve içenler, kafeler',
    tip: 'Geniş yüzeyi sayesinde yatay yerleşimli tasarımlar ve uzun yazılar rahat okunur.',
  },
  'Pro Kupa': {
    what: 'Yoğun kullanıma dayanıklı, baskı kalitesi yüksek profesyonel kupalar.',
    fits: 'kurumsal siparişler, etkinlikler, toplu hediye ve tanıtım ürünleri',
    tip: 'Logo baskısında yüksek çözünürlüklü, arka planı şeffaf bir dosya göndermek keskin sonuç verir.',
  },
  'Büyük Kupa': {
    what: 'Geniş hacimli kupalar; çay, kahve ve sütlü içecekler için bol ölçülüdür.',
    fits: 'uzun çalışma saatleri, çay severler, baba ve dede hediyeleri',
    tip: 'Büyük yüzey panoramik tasarımlara uygundur; kupa çevresini saran görseller dikkat çeker.',
  },
  'Sihirli Kupa': {
    what: 'Isıya duyarlı yüzeyi sayesinde sıcak içecek konulunca gizli görselin ortaya çıktığı kupalar.',
    fits: 'sürpriz hediye verenler, sevgililer günü ve doğum günü hediyeleri, çocuklar',
    tip: 'Siyah zeminli sihirli kupada beliren görselin kontrastı yüksek olmalı; açık renkli ve net fotoğraflar seçin.',
  },
  'Özel Tasarım': {
    what: 'Tasarımın tamamen size ait olduğu, ürün ve renk seçiminden baskıya kadar serbestçe şekillendirilen siparişler.',
    fits: 'kendine özel fikri olanlar, hediyeye anlam katmak isteyenler',
    tip: 'Fikriniz net değilse bir referans görsel gönderin; biz tasarımı hazırlayıp önizlemesini paylaşırız.',
  },
  'Kurumsal': {
    what: 'Firma, kurum ve etkinlikler için logolu toplu kupa siparişleri.',
    fits: 'şirketler, okullar, dernekler, fuar ve etkinlik organizatörleri',
    tip: 'Toplu siparişte tek tasarım ya da her çalışana ayrı isimli versiyon seçilebilir; adede göre özel fiyat verilir.',
  },
};

export function categoryTopic(cat: Category): BlogTopic {
  const n = CATEGORY_NOTES[cat];
  return {
    id: `cat-${slugifyHeading(cat)}`,
    kind: 'category',
    title: `${cat} Rehberi: Kimler İçin, Nasıl Seçilir?`,
    excerpt: `${cat} nedir, kimler için uygundur, baskıda nelere dikkat edilmeli? Model seçimi ve tasarım ipuçlarıyla kısa bir rehber.`,
    intro: `${cat} kategorisi, kupa baskı siparişlerinde sık sorulan gruplardan biri. ${n.what} Bu rehberde ${cat.toLocaleLowerCase('tr-TR')} seçerken bilmeniz gerekenleri ve baskıdan en iyi sonucu almanın yollarını topladık.`,
    sections: [
      { h: `${cat} nedir?`, p: n.what },
      { h: 'Kimler için uygun?', p: `Bu kategori özellikle şu kullanımlar için öne çıkar: ${n.fits}. Tek adetten toplu siparişe kadar her adet için baskı yapılır.` },
      { h: 'Baskı ve tasarım ipucu', p: `${n.tip} Hazır bir tasarımınız yoksa fotoğrafınızı, logonuzu ya da metninizi gönderin; tasarımı ücretsiz hazırlıyoruz ve baskıdan önce onayınıza sunuyoruz.` },
      { h: 'Nasıl sipariş verilir?', p: 'Beğendiğiniz modeli seçin, WhatsApp üzerinden tasarım fikrinizi iletin, önizlemeyi onaylayın. Onaydan sonra siparişiniz yaklaşık 3 iş günü içinde kargoya verilir; Türkiye genelinde gönderim yapıyoruz.' },
    ],
    faq: [
      { q: `${cat} için minimum sipariş adedi var mı?`, a: 'Hayır, minimum adet yok. Tek adet de sipariş verebilirsiniz.' },
      { q: 'Baskı yıkamada silinir mi?', a: 'Sublimasyon baskı seramiğe kalıcı işlenir; yine de elde yıkamak ve aşındırıcı süngerlerden kaçınmak baskının ömrünü uzatır.' },
    ],
    tags: [cat.toLocaleLowerCase('tr-TR'), `${cat.toLocaleLowerCase('tr-TR')} baskı`, 'kupa baskı', 'kişiye özel'],
    categories: [cat],
  };
}

export function keywordTopic(keyword: string): BlogTopic {
  const kw = keyword.trim();
  const Kw = kw.charAt(0).toLocaleUpperCase('tr-TR') + kw.slice(1);
  return {
    id: `kw-${slugifyHeading(kw)}`,
    kind: 'keyword',
    keyword: kw,
    title: `${Kw}: Nasıl Seçilir, Nelere Dikkat Edilir?`,
    excerpt: `${Kw} arıyorsanız: doğru modeli seçmek, tasarımı hazırlamak ve siparişi vermek için pratik bir rehber.`,
    intro: `"${kw}" araması yapıyorsanız aradığınız şey büyük olasılıkla kaliteli bir baskı, doğru model ve sorunsuz bir sipariş süreci. Bu yazıda karar vermeden önce bilmeniz gerekenleri sade bir dille özetledik.`,
    sections: [
      { h: 'Önce kullanım amacını belirleyin', p: 'Kupa kendiniz için mi, hediye için mi, yoksa kurumsal bir sipariş için mi? Amaç; model, hacim ve tasarım dilini belirler. Hediye için kişisel bir fotoğraf ve kısa bir cümle yeterlidir; kurumsal siparişte logo ve adet öne çıkar.' },
      { h: 'Modeli seçerken nelere bakılmalı?', p: '- Hacim: günlük kahve için küçük fincan, çay ve sütlü içecek için büyük kupa\n- Yüzey: geniş yüzey, geniş tasarımlara imkan verir\n- Özel özellik: sihirli kupa gibi modeller sürpriz etkisi yaratır' },
      { h: 'Baskı kalitesi için tasarım ipuçları', p: 'Yüksek çözünürlüklü fotoğraf kullanın, küçük yazıları büyütün ve kontrastı yüksek tutun. Dosyanız hazır değilse göndermeniz yeterli; ücretsiz tasarım desteği veriyoruz ve baskıdan önce önizleme paylaşıyoruz.' },
      { h: 'Sipariş süreci', p: 'Siparişler WhatsApp üzerinden alınır. Modeli seçip tasarımı gönderirsiniz, önizlemeyi onaylarsınız ve ürün yaklaşık 3 iş günü içinde kargoya verilir. Türkiye geneline gönderim yapıyoruz.' },
    ],
    faq: [
      { q: 'Tasarımı ben hazırlamak zorunda mıyım?', a: 'Hayır. Fotoğraf, logo ya da metni gönderin; tasarımı ücretsiz hazırlıyoruz.' },
      { q: 'Kargo ne kadar sürer?', a: 'Tasarım onayından sonra 3 iş günü içinde kargoya verilir; teslimat süresi kargo firmasına ve bölgeye göre değişir.' },
    ],
    tags: [kw.toLocaleLowerCase('tr-TR'), 'kupa baskı', 'kişiye özel kupa'],
    categories: [],
  };
}

// ── Sabit (her zaman geçerli) konular ────────────────────────────────────────

export const EVERGREEN_TOPICS: BlogTopic[] = [
  {
    id: 'sihirli-kupa-nasil-calisir',
    kind: 'evergreen',
    title: 'Sihirli Kupa Nasıl Çalışır? Isıyla Görünen Baskının Sırrı',
    excerpt: 'Sihirli kupa sıcak içecekle birlikte nasıl görsel ortaya çıkarıyor? Çalışma prensibi, bakım ve hediye olarak neden tercih edildiği.',
    intro: 'Soğukken tamamen siyah ya da tek renk görünen, sıcak içecek konulunca üzerindeki fotoğraf veya yazının beliriverdiği kupayı görenler "bu nasıl oluyor?" diye soruyor. Sihirli kupa, hediyeler için en çok tercih edilen modellerden biri. Çalışma prensibini ve doğru kullanımını anlatalım.',
    sections: [
      { h: 'Görsel nasıl ortaya çıkıyor?', p: 'Sihirli kupanın yüzeyi, ısıya tepki veren özel bir kaplamayla hazırlanır. Sıcak bir içecek koyduğunuzda kaplama saydamlaşır ve altındaki baskı görünür olur; içecek soğudukça kaplama eski rengine döner. Bu yüzden görsel her seferinde yeniden "sürpriz" olur.' },
      { h: 'Hangi tasarımlar sihirli kupada iyi görünür?', p: '- Net, yüksek kontrastlı fotoğraflar\n- Büyük puntolu isim ve kısa mesajlar\n- Sade grafikler ve logolar\n\nÇok ince ayrıntılı ya da düşük çözünürlüklü görseller, görünür olduğunda bile bulanık çıkabilir.' },
      { h: 'Bakım ipuçları', p: 'Isıya duyarlı kaplamayı korumak için kupayı elde, yumuşak bir süngerle yıkamanızı öneririz. Aşındırıcı süngerlerden, çok sıcak suyla uzun süre ıslatmaktan ve bulaşık makinesinden kaçının. Kupayı doğrudan ocağa ya da açık alevin yakınına koymayın.' },
      { h: 'Neden iyi bir hediye?', p: 'Sürpriz etkisi sayesinde doğum günü, sevgililer günü ve yılbaşı gibi özel günlerde çok sevilir. Hediye alan kişi kupayı ilk kez sıcak içecekle doldurduğunda yaşadığı şaşkınlık, hediyenin en güzel kısmıdır.' },
    ],
    faq: [
      { q: 'Sihirli kupada görsel ne zaman görünür?', a: 'Sıcak içecek koyulduktan kısa süre sonra görsel belirir; içecek soğuyunca kupa eski rengine döner.' },
      { q: 'Sihirli kupa bulaşık makinesine girer mi?', a: 'Kaplamanın ömrü için elde yıkamanızı öneririz; bulaşık makinesi ve aşındırıcı süngerlerden kaçının.' },
      { q: 'Sihirli kupaya fotoğraf bastırabilir miyim?', a: 'Evet. Net ve kontrastı yüksek bir fotoğraf göndermeniz yeterli; baskıdan önce önizlemesini paylaşıyoruz.' },
    ],
    tags: ['sihirli kupa', 'sihirli kupa nasıl çalışır', 'ısıya duyarlı kupa', 'hediye kupa'],
    categories: ['Sihirli Kupa'],
  },
  {
    id: 'kupa-bakimi-ve-yikama',
    kind: 'evergreen',
    title: 'Baskılı Kupa Nasıl Yıkanır? Baskının Ömrünü Uzatan Bakım İpuçları',
    excerpt: 'Kişiye özel baskılı kupanın rengi solmasın, baskı silinmesin: yıkama, mikrodalga ve günlük kullanım için pratik bakım rehberi.',
    intro: 'Kişiye özel kupanız yalnızca bir içecek kabı değil, bir hatıra. Doğru bakımla baskı yıllarca ilk günkü gibi kalır. İşte yıkama ve kullanımda dikkat etmeniz gerekenler.',
    sections: [
      { h: 'Elde yıkama en güvenli yoldur', p: 'Ilık suyla ve yumuşak bir süngerle yıkamak baskının ömrünü uzatır. Tel, zımpara ya da aşındırıcı yüzeyli süngerler baskıyı çizebilir; bu tür malzemelerden kaçının.' },
      { h: 'Bulaşık makinesi ve mikrodalga', p: 'Sublimasyon baskı seramiğe işlendiği için dayanıklıdır; yine de sık sık bulaşık makinesinde yıkamak, yüksek ısı ve güçlü deterjanlar yüzünden parlaklığı azaltabilir. Mikrodalgada kullanım için kupanın metal detay içermediğinden emin olun; altın yaldızlı ya da metalik detaylı kupaları mikrodalgaya koymayın. Sihirli kupalar için bulaşık makinesinden kaçınılmalıdır.' },
      { h: 'Günlük kullanımda dikkat edilecekler', p: '- Kupayı ani sıcaklık değişimlerinden koruyun (buzdolabından çıkardığınız kupaya hemen kaynar su koymayın)\n- Baskı yüzeyini sert cisimlerle çizmeyin\n- Kullandıktan sonra uzun süre içinde sıvı bırakmayın' },
      { h: 'Leke ve koku için', p: 'Çay ve kahve lekeleri için karbonatlı ılık su ya da sirkeli suyla kısa süre bekletip yumuşak süngerle silmek yeterlidir. Baskılı bölgeye sert fırçayla uzun süre bastırmayın.' },
    ],
    faq: [
      { q: 'Baskılı kupa bulaşık makinesinde yıkanır mı?', a: 'Seramik üzerine sublimasyon baskı dayanıklıdır, ancak elde yıkama baskının ömrünü uzatır. Sihirli kupayı bulaşık makinesine koymayın.' },
      { q: 'Baskı zamanla silinir mi?', a: 'Doğru bakımla baskı yıllarca kalır. Aşındırıcı süngerler ve sert kimyasallar baskıyı zamanla matlaştırabilir.' },
    ],
    tags: ['kupa bakımı', 'baskılı kupa yıkama', 'sublimasyon baskı', 'kupa baskı'],
    categories: ['Lüks Kupa', 'Büyük Kupa'],
  },
  {
    id: 'sublimasyon-baski-nedir',
    kind: 'evergreen',
    title: 'Sublimasyon Baskı Nedir? Kupa Baskı Teknikleri Karşılaştırması',
    excerpt: 'Kupa baskıda kullanılan sublimasyon, DTF ve etiket teknikleri arasındaki fark nedir? Hangisi daha kalıcı, hangisi neden tercih edilir?',
    intro: 'Kişiye özel kupa siparişi verirken sık duyulan bir kelime: sublimasyon. Peki sublimasyon nedir, diğer baskı tekniklerinden farkı ne ve neden çoğu kupa baskıcısı bunu tercih ediyor?',
    sections: [
      { h: 'Sublimasyon baskı nasıl yapılır?', p: 'Tasarım önce özel mürekkeple transfer kağıdına basılır. Kağıt kupaya sarılır ve yaklaşık 180–200 derece sıcaklıkta ısı presinde bekletilir. Isı ve basınçla mürekkep gaz hâline geçerek kupanın polimer kaplı yüzeyine işlenir. Boya yüzeyde durmaz, yüzeyin içine geçer.' },
      { h: 'Neden kalıcı ve canlı?', p: 'Mürekkep yüzeyin içine işlendiği için baskı parmakla hissedilmez, soyulmaz ve doğru bakımla uzun süre solmaz. Fotoğraf gibi renk geçişi çok olan tasarımlarda da canlı sonuç verir.' },
      { h: 'Diğer yöntemler', p: '- Etiket / sticker baskı: ucuzdur ama zamanla kenarlardan kalkabilir\n- Serigrafi: tek renkli ve çok adetli işlerde kullanılır, fotoğraf için uygun değildir\n- DTF ve benzeri transfer yöntemleri: yüzeyde bir katman bırakır; sublimasyon kadar yüzeyle bütünleşmez' },
      { h: 'Hangi kupalar sublimasyona uygun?', p: 'Sublimasyon için kupanın yüzeyi polimer kaplı olmalıdır. Biz kullandığımız kupa modellerini bu yönteme uygun seçiyoruz; hangi modelin hangi tasarım için daha uygun olduğunu sipariş sırasında önerebiliriz.' },
    ],
    faq: [
      { q: 'Sublimasyon baskı kalıcı mıdır?', a: 'Mürekkep yüzeyin içine işlendiği için kalıcıdır; elde yıkama ve yumuşak sünger baskının ömrünü uzatır.' },
      { q: 'Fotoğraf baskısı için sublimasyon uygun mu?', a: 'Evet. Renk geçişleri ve ayrıntılar sublimasyonla çok canlı çıkar.' },
    ],
    tags: ['sublimasyon baskı', 'kupa baskı teknikleri', 'sublimasyon kupa', 'kupa baskı'],
    categories: ['Pro Kupa', 'Lüks Kupa'],
  },
  {
    id: 'kurumsal-hediye-kupa-rehberi',
    kind: 'evergreen',
    title: 'Kurumsal Hediye Olarak Logolu Kupa: Toplu Sipariş Rehberi',
    excerpt: 'Şirket, okul ve etkinlikler için logolu kupa siparişi nasıl verilir? Adet, tasarım, teslimat ve bütçe için pratik ipuçları.',
    intro: 'Çalışanlara, müşterilere ve etkinlik katılımcılarına verilen logolu kupa, hem kullanışlı hem de markanızı her gün göz önünde tutan bir hediyedir. Toplu siparişi sorunsuz yönetmek için bilmeniz gerekenleri derledik.',
    sections: [
      { h: 'Neden logolu kupa?', p: 'Kupa her gün kullanılan bir üründür; logonuz masada, ofiste ve evde sürekli görünür. Kalem ya da ajanda gibi ürünlere göre daha uzun ömürlü ve daha çok sevilen bir kurumsal hediyedir.' },
      { h: 'Sipariş öncesi hazırlık', p: '- Logonuzu yüksek çözünürlüklü (tercihen vektörel ya da şeffaf arka planlı PNG) gönderin\n- Adedi ve teslim tarihini belirleyin\n- Her kupaya aynı tasarım mı, yoksa kişiye özel isim mi isteyeceğinizi söyleyin' },
      { h: 'Kişiye özel isimli toplu sipariş', p: 'Toplu siparişte her kupaya farklı bir isim yazdırmak mümkündür. Bu seçenek özellikle yılbaşı, yeni işe başlama ve ekip hediyelerinde çok beğenilir.' },
      { h: 'Fiyat ve teslimat', p: 'Adet arttıkça birim fiyat düşer. Adedinizi ve tasarımınızı WhatsApp üzerinden iletirseniz size özel fiyat teklifi veririz. Baskıdan önce önizleme paylaşılır, onayınızdan sonra üretim ve kargo yaklaşık 3 iş günü sürer; çok büyük adetlerde süre ayrıca bildirilir.' },
    ],
    faq: [
      { q: 'Kurumsal siparişte minimum adet var mı?', a: 'Minimum adet yok; adet arttıkça birim fiyat avantajı sağlıyoruz.' },
      { q: 'Logo dosyasını hangi formatta göndermeliyim?', a: 'Vektörel (AI, SVG, PDF) ya da yüksek çözünürlüklü, şeffaf arka planlı PNG dosyası idealdir. Elinizde yoksa mevcut görselle de yardımcı oluruz.' },
      { q: 'Toplu siparişte her kupaya farklı isim yazılabilir mi?', a: 'Evet, isim listesini gönderirseniz her kupaya ayrı isim basabiliriz.' },
    ],
    tags: ['kurumsal hediye', 'logolu kupa', 'toplu kupa baskı', 'kurumsal kupa'],
    categories: ['Kurumsal', 'Pro Kupa'],
  },
  {
    id: 'kisiye-ozel-hediye-fikirleri',
    kind: 'evergreen',
    title: 'Kişiye Özel Kupa ile Hediye Fikirleri: Her Duruma Uygun 12 Öneri',
    excerpt: 'Doğum günü, yıl dönümü, terfi, emeklilik… Kişiye özel kupa ile hazırlanabilecek anlamlı hediye fikirleri ve tasarım önerileri.',
    intro: 'Ne alacağınıza karar veremediğiniz anlarda kişiye özel kupa güvenli ve anlamlı bir seçenektir. İşte farklı durumlar için işe yarayan 12 fikir.',
    sections: [
      { h: 'Duygusal hediyeler', p: '- Birlikte çekilmiş bir fotoğraf ve ortak bir söz\n- Çocukların çizimlerinden oluşan "baba/anne" kupası\n- Aile bireylerinin isimlerinin yazıldığı büyükanne-büyükbaba kupası\n- Yıl dönümü için önemli tarih ve kısa bir mesaj' },
      { h: 'Esprili hediyeler', p: '- Arkadaşınızın meşhur sözü ya da iç şakası\n- "Pazartesi kupası" gibi mizahi yazılar\n- Karikatür portre ya da komik fotoğraf kolajı' },
      { h: 'İş ve okul hayatı', p: '- Terfi, emeklilik veya yeni iş için teşekkür kupası\n- Öğretmen ve mezuniyet hediyeleri\n- Ekip kupası: her takım üyesine isimli kupa' },
      { h: 'Doğru modeli seçmek', p: 'Sürpriz sevenler için sihirli kupa, günlük kullanım için büyük kupa, kahve sofraları için seramik fincanlar uygundur. Tasarım hazır değilse fikrinizi anlatın; ücretsiz hazırlıyoruz.' },
    ],
    faq: [
      { q: 'Hediye için hangi model en uygun?', a: 'Sürpriz etkisi için sihirli kupa, şıklık için lüks kupa, kahve severler için fincan modelleri tercih edilebilir.' },
      { q: 'Hediye notu eklenebilir mi?', a: 'Evet, sipariş sırasında hediye notunuzu WhatsApp üzerinden iletebilirsiniz.' },
    ],
    tags: ['hediye fikirleri', 'kişiye özel hediye', 'hediye kupa', 'kupa baskı'],
    categories: ['Sihirli Kupa', 'Lüks Kupa', 'Özel Tasarım'],
  },
  {
    id: 'dogum-gunu-icin-kisiye-ozel-kupa',
    kind: 'evergreen',
    title: 'Doğum Günü İçin Kişiye Özel Kupa: Tasarım ve Mesaj Önerileri',
    excerpt: 'Doğum günü hediyesi olarak kupa hazırlarken hangi fotoğraf, hangi mesaj ve hangi model seçilmeli? Pratik öneriler.',
    intro: 'Doğum günü hediyesi, kişiyi ne kadar tanıdığınızı gösterme fırsatıdır. Kişiye özel bir kupa; fotoğrafı, mesajı ve modeliyle tamamen ona göre hazırlanabildiği için hem özel hem de kullanışlıdır.',
    sections: [
      { h: 'Fotoğraf seçimi', p: 'Yüksek çözünürlüklü, ışığı iyi bir fotoğraf seçin. Kalabalık fotoğraflar küçük yüzeyde kaybolur; en fazla iki üç kişinin olduğu, yüzlerin net göründüğü kareler en iyi sonucu verir.' },
      { h: 'Mesaj fikirleri', p: '- "İyi ki doğdun, iyi ki varsın"\n- Yaşı ve doğum yılı: "1995 Üretimi, Hala Çalışıyor"\n- Kişinin adı ve sevdiği bir söz\n- Aranızdaki ortak bir iç şaka' },
      { h: 'Hangi model?', p: 'Sihirli kupa sürpriz etkisiyle doğum günlerinde çok tercih edilir; sade ve şık bir hediye için lüks kupa ya da kahve seven biri için fincan seçebilirsiniz.' },
      { h: 'Zamanlama', p: 'Doğum gününden en az bir hafta önce siparişi vermenizi öneririz: tasarım onayı ve 3 iş günü kargo süresi için rahat bir pay bırakır.' },
    ],
    faq: [
      { q: 'Doğum günü kupası için ne kadar önce sipariş verilmeli?', a: 'Tasarım onayı ve kargo süresi için en az bir hafta önce sipariş vermenizi öneririz.' },
      { q: 'Birden fazla fotoğraf kullanılabilir mi?', a: 'Evet; kolaj tasarımlarında birden fazla fotoğraf kullanabiliriz, yine de net ve büyük görseller en iyi sonucu verir.' },
    ],
    tags: ['doğum günü hediyesi', 'kişiye özel kupa', 'doğum günü kupası', 'kupa baskı'],
    categories: ['Sihirli Kupa', 'Lüks Kupa', 'Büyük Kupa'],
  },
  {
    id: 'kupa-baskida-gorsel-hazirlama',
    kind: 'evergreen',
    title: 'Kupa Baskı İçin Görsel Nasıl Hazırlanır? Çözünürlük ve Format Rehberi',
    excerpt: 'Bulanık baskı istemiyorsanız: kupaya baskı için fotoğraf ve logo dosyası nasıl hazırlanır, hangi çözünürlük ve format uygundur?',
    intro: 'Kupa baskıda en sık karşılaşılan sorun, ekranda güzel görünen ama baskıda bulanıklaşan görsellerdir. Dosyanızı doğru hazırlamak baskı kalitesini doğrudan belirler.',
    sections: [
      { h: 'Çözünürlük', p: 'Kupanın baskı alanı yaklaşık 20 x 9 cm civarındadır. Net bir sonuç için görselin kısa kenarının en az 1500–2000 piksel olması iyi sonuç verir. WhatsApp\'ta sıkıştırılmış görseller küçülür; mümkünse dosyayı "belge" olarak gönderin.' },
      { h: 'Format', p: '- Fotoğraf için JPG ya da PNG\n- Logo için şeffaf arka planlı PNG ya da vektörel dosya (SVG, PDF, AI)\n- Metinlerde okunaklı, kalın fontlar tercih edin' },
      { h: 'Renk ve kontrast', p: 'Ekran renkleri ile baskı renkleri bire bir aynı olmaz; çok açık pastel tonlar baskıda silik görünebilir. Koyu kupalarda açık, açık kupalarda koyu yazı kullanın.' },
      { h: 'Biz ne yapıyoruz?', p: 'Gönderdiğiniz görseli baskıya uygun hâle getiriyor, düzenini hazırlıyor ve baskıdan önce önizleme gönderiyoruz. Tasarımınız hazır değilse ücretsiz tasarım desteği veriyoruz.' },
    ],
    faq: [
      { q: 'Telefonla çekilmiş fotoğraf yeterli mi?', a: 'Evet; iyi ışıkta çekilmiş, net bir telefon fotoğrafı çoğu zaman yeterlidir. Dosyayı sıkıştırmadan göndermeniz önemlidir.' },
      { q: 'Logom düşük çözünürlüklü, ne yapabilirim?', a: 'Elinizdeki dosyayı gönderin; mümkünse iyileştirir, mümkün değilse daha yüksek çözünürlüklü versiyon isteriz.' },
    ],
    tags: ['kupa baskı görsel hazırlama', 'baskı çözünürlüğü', 'kupa tasarım', 'kupa baskı'],
    categories: ['Özel Tasarım', 'Pro Kupa'],
  },
  {
    id: 'kupa-boyutu-nasil-secilir',
    kind: 'evergreen',
    title: 'Kupa, Kahve Fincanı ve Latte Fincanı Arasındaki Fark: Hangisi Size Uygun?',
    excerpt: 'Hacim, ağız genişliği ve kullanım amacına göre kupa mı, kahve fincanı mı, latte fincanı mı? Seçim rehberi.',
    intro: 'Kişiye özel baskı için kupa seçerken en çok sorulan soru: "Hangi hacim, hangi model?" Cevap, ne içeceğinize ve nasıl kullanacağınıza bağlı.',
    sections: [
      { h: 'Kahve fincanı', p: 'Küçük hacimli (genellikle 80–120 ml) fincanlar Türk kahvesi, espresso ve ikram için uygundur. Küçük yüzeyde kısa metin ve sade desenler iyi görünür.' },
      { h: 'Latte fincanı', p: 'Geniş ağızlı ve daha büyük hacimli fincanlar latte, cappuccino ve sütlü kahveler için idealdir. Geniş yüzeyi sayesinde yatay tasarımlar rahat okunur.' },
      { h: 'Kupa', p: 'Orta ve büyük hacimli kupalar çay, filtre kahve ve sütlü içecekler için gündelik kullanımda en pratik seçimdir. Ofis masası için büyük kupa uzun süre sıcak içecek içmenizi sağlar.' },
      { h: 'Seçim özeti', p: '- Misafir ağırlama: seramik kahve fincanı\n- Latte ve cappuccino: latte fincanı\n- Günlük çay/kahve: büyük kupa\n- Sürpriz hediye: sihirli kupa\n- Toplu ve kurumsal: pro kupa' },
    ],
    faq: [
      { q: 'Çay için hangi kupa uygun?', a: 'Çay için orta ve büyük hacimli kupalar pratiktir; ince belli çay bardağı yerine kupa tercih edenler için büyük kupa idealdir.' },
      { q: 'Baskı alanı fincanlarda daha mı küçük?', a: 'Evet; küçük fincanlarda baskı alanı sınırlıdır, bu yüzden kısa metin ve sade tasarım önerilir.' },
    ],
    tags: ['kupa seçimi', 'latte fincanı', 'kahve fincanı', 'büyük kupa'],
    categories: ['Latte Fincanı', 'Kahve Fincanı', 'Büyük Kupa'],
  },
  {
    id: 'isim-yazili-kupa-tasarim-ipuclari',
    kind: 'evergreen',
    title: 'İsim Yazılı Kupa Tasarımı: Okunaklı ve Şık Sonuç İçin 7 İpucu',
    excerpt: 'İsim baskılı kupada font seçimi, yerleşim ve renk uyumu nasıl olmalı? Şık ve okunaklı tasarım için pratik ipuçları.',
    intro: 'İsim yazılı kupa, en çok sipariş edilen kişiye özel ürünlerden biri. Basit görünse de font, boyut ve yerleşim kararları sonucu belirler.',
    sections: [
      { h: '1. Okunaklı bir font seçin', p: 'Aşırı süslü el yazısı fontlar küçük yüzeyde okunmayı zorlaştırır. İsim için kalın ve temiz bir font, yanındaki kısa mesaj için daha ince bir font kullanmak dengeli görünür.' },
      { h: '2. Yerleşime dikkat edin', p: 'Kulpun karşısındaki yüzey, kupayı tutarken karşı tarafa bakan ana yüzeydir. Ana mesajı bu alana, ikinci derece detayları yan yüzeylere yerleştirin.' },
      { h: '3. Renk uyumu', p: 'Kupanın iç ve kulp rengini yazı rengiyle uyumlu seçin. Koyu zeminli kupada açık, beyaz kupada koyu renk yazı daha okunur.' },
      { h: '4. Kısa tutun', p: 'Kısa isimler büyük yazılabilir; uzun isim ve unvanlarda iki satıra bölmek okunurluğu artırır.' },
      { h: '5. İkon ve süsleme', p: 'İsmin yanına küçük bir ikon (kalp, yıldız, kahve fincanı) eklemek tasarımı hafifletir; fazla sayıda öğe karışıklık yaratır.' },
      { h: '6. Önizlemeyi mutlaka inceleyin', p: 'Her siparişte baskıdan önce dijital önizleme gönderiyoruz. Yazım hatası ve yerleşimi bu aşamada kontrol edin; onayınız olmadan baskı yapılmaz.' },
      { h: '7. Toplu siparişlerde isim listesi', p: 'Birden fazla kupa için isim listesini yazım doğrulamasıyla birlikte tek mesajda gönderin; yanlış yazılmış isimleri baskıdan önce düzeltmek çok daha kolaydır.' },
    ],
    faq: [
      { q: 'Türkçe karakterler (ğ, ş, ı) sorunsuz basılıyor mu?', a: 'Evet. Türkçe karakterler tüm fontlarda sorunsuz basılır; yine de önizlemede kontrol edin.' },
      { q: 'İsmi iki satıra bölebilir miyiz?', a: 'Evet, uzun isim ve unvanlar için iki satırlı yerleşim önerilir.' },
    ],
    tags: ['isim yazılı kupa', 'kupa tasarımı', 'isimli kupa', 'kupa baskı'],
    categories: ['Özel Tasarım', 'Lüks Kupa'],
  },
  {
    id: 'toplu-kupa-siparisi-nasil-verilir',
    kind: 'evergreen',
    title: 'Toplu Kupa Siparişi Nasıl Verilir? Etkinlik, Düğün ve Okul İçin Rehber',
    excerpt: 'Düğün, nişan, okul ve etkinlikler için toplu kupa baskı siparişi: adet, tasarım, teslim süresi ve fiyat için adım adım rehber.',
    intro: 'Düğün hatırası, mezuniyet, takım hediyesi ya da etkinlik katılımcıları için toplu kupa sipariş etmek istiyorsanız süreç sanıldığından basittir. Adım adım anlatalım.',
    sections: [
      { h: '1. Adedi ve amacı belirleyin', p: 'Kaç kişiye ve hangi amaçla hediye vereceğinizi belirleyin. Adet arttıkça birim fiyat avantajı oluşur; yaklaşık adedi söylemeniz teklif için yeterlidir.' },
      { h: '2. Tasarımı seçin', p: 'Herkese aynı tasarım ya da her kupaya ayrı isim yazılı seçenek mümkündür. Etkinlik logosu, tarih ve kısa bir mesaj sık tercih edilen kombinasyondur.' },
      { h: '3. Önizlemeyi onaylayın', p: 'Baskıdan önce dijital önizleme gönderiyoruz. Yazım ve yerleşimi kontrol edip onayladığınızda üretim başlar.' },
      { h: '4. Teslimat planı', p: 'Standart siparişlerde onaydan sonra yaklaşık 3 iş günü içinde kargoya veriyoruz. Yüksek adetlerde süre değişebilir; etkinlik tarihinizi baştan söylerseniz planı buna göre yaparız.' },
    ],
    faq: [
      { q: 'Toplu siparişte indirim var mı?', a: 'Evet, adede göre özel fiyat veriyoruz. Adedinizi WhatsApp üzerinden yazmanız yeterli.' },
      { q: 'Etkinlik tarihine yetişir mi?', a: 'Tarihi baştan söylerseniz üretim ve kargoyu buna göre planlarız; mümkün olduğunca erken sipariş vermenizi öneririz.' },
    ],
    tags: ['toplu kupa siparişi', 'düğün hatırası', 'etkinlik kupa', 'kurumsal kupa'],
    categories: ['Kurumsal', 'Pro Kupa'],
  },
  {
    id: 'kupa-baski-fiyatlari-neye-gore-degisir',
    kind: 'evergreen',
    title: 'Kupa Baskı Fiyatları Neye Göre Değişir?',
    excerpt: 'Kişiye özel kupa baskı fiyatını hangi etkenler belirler? Model, adet, tasarım ve kargo hakkında bilmeniz gerekenler.',
    intro: 'Kupa baskı fiyatı sabit değildir; model, adet ve tasarım çalışmasına göre değişir. Teklif alırken hangi unsurların fiyatı etkilediğini bilmek karar vermenizi kolaylaştırır.',
    sections: [
      { h: 'Model ve malzeme', p: 'Sade seramik kupa, sihirli kupa ve özel formlu fincanlar farklı fiyatlardadır. Isıya duyarlı kaplama ya da özel kulp ve iç renk seçenekleri fiyata yansır.' },
      { h: 'Adet', p: 'Adet arttıkça birim fiyat düşer. Tek adet de sipariş verebilirsiniz; toplu siparişlerde adede göre özel fiyat sunuyoruz.' },
      { h: 'Tasarım', p: 'Hazır tasarımla gelen siparişlerde ek tasarım çalışması gerekmez. Biz tasarımı ücretsiz hazırlıyoruz; çok karmaşık, sıfırdan illüstrasyon gerektiren işlerde önceden bilgi veririz.' },
      { h: 'Kargo', p: 'Türkiye geneline kargo ile gönderim yapıyoruz. Kargo ücreti ve süresi, adet ve adrese göre değişebilir; teklifte açıkça belirtilir.' },
    ],
    faq: [
      { q: 'Güncel fiyatları nereden görebilirim?', a: 'Ürün sayfalarında başlangıç fiyatları yazar; kesin fiyat model, adet ve tasarıma göre WhatsApp üzerinden netleştirilir.' },
      { q: 'Tasarım ücretli mi?', a: 'Standart tasarım desteği ücretsizdir.' },
    ],
    tags: ['kupa baskı fiyatları', 'kupa baskı ücreti', 'toplu kupa fiyat', 'kupa baskı'],
    categories: ['Özel Tasarım', 'Kurumsal'],
  },
  {
    id: 'ofis-icin-kupa-secimi',
    kind: 'evergreen',
    title: 'Ofis İçin Kupa Seçimi: Çalışan Memnuniyetini Artıran Küçük Detay',
    excerpt: 'Ofis kupası seçerken hacim, dayanıklılık ve tasarım nasıl olmalı? İsimli ya da logolu ofis kupasının faydaları.',
    intro: 'Ofiste her gün kullanılan kupa, çalışanın kurumla en sık temas ettiği nesnelerden biridir. Doğru kupa seçimi hem memnuniyeti hem de marka algısını etkiler.',
    sections: [
      { h: 'Hacim ve form', p: 'Uzun toplantılar ve yoğun çalışma temposu için büyük hacimli kupalar pratiktir. Ağız yapısı sıcak içeceği uzun süre tutacak kadar derin olmalıdır.' },
      { h: 'Dayanıklılık', p: 'Yoğun kullanıma dayanıklı seramik kupalar, ofis kullanımında uzun yıllar sorunsuz hizmet eder. Baskının çizilmemesi için elde yıkama önerilir.' },
      { h: 'İsimli kupa avantajı', p: 'Kupalar ortak mutfakta karıştığı için isimli kupa hem hijyen hem sahiplenme duygusu verir. Yeni işe başlayanlara isimli kupa hediye etmek şık bir karşılama jestidir.' },
      { h: 'Markanıza uygun tasarım', p: 'Logonuzu ve kurumsal renklerinizi kullanan sade bir tasarım, hem çalışanlar hem ziyaretçiler için profesyonel bir izlenim bırakır.' },
    ],
    faq: [
      { q: 'Ofis için hangi kupa daha uygun?', a: 'Günlük yoğun kullanım için büyük hacimli pro ya da büyük kupa modelleri pratiktir.' },
      { q: 'Çalışan isimleri toplu olarak yazdırılabilir mi?', a: 'Evet, isim listesini gönderirseniz her kupaya ayrı isim basılır.' },
    ],
    tags: ['ofis kupası', 'logolu kupa', 'kurumsal hediye', 'isimli kupa'],
    categories: ['Kurumsal', 'Pro Kupa', 'Büyük Kupa'],
  },
];

// ── Seçim ────────────────────────────────────────────────────────────────────

export interface PickOptions {
  /** Arama ayarlarındaki anahtar kelime hedefleri (ek konu kaynağı). */
  keywordTargets?: string[];
  /** Kullanılmış konu kimlikleri. */
  usedIds: Iterable<string>;
}

export interface PickedTopic { topic: BlogTopic; urgent: boolean }

function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

/** Aday konuların tam sırası (özel günler hariç): sabit, kategori ve anahtar kelime konuları iç içe. */
export function evergreenPool(keywordTargets: string[] = []): BlogTopic[] {
  const cats = (Object.keys(CATEGORY_NOTES) as Category[]).map(categoryTopic);
  const kws = keywordTargets.map((k) => k.trim()).filter((k) => k.length >= 3).map(keywordTopic);
  // Sabit konular iki kat ağırlıklı: kategori rehberi ve anahtar kelime konuları arada serpiştirilir.
  const ev = EVERGREEN_TOPICS;
  return interleave([ev.slice(0, Math.ceil(ev.length / 2)), cats, ev.slice(Math.ceil(ev.length / 2)), kws]);
}

/**
 * Sıradaki konu. 1) Pencereye giren (leadDays içinde) ve en az 4 gün kalan özel gün konusu "acil" (kuyruğun önüne geçer).
 * 2) Yoksa kullanılmamış ilk sabit/kategori/anahtar kelime konusu. 3) Hepsi kullanıldıysa null.
 */
export function pickNextTopic(now: number, opts: PickOptions): PickedTopic | null {
  const used = new Set(opts.usedIds);
  for (const o of upcomingOccasions(now, 45)) {
    if (o.daysLeft < 4 || o.daysLeft > o.def.leadDays) continue;
    const t = occasionTopic(o.def, o.year, o.date);
    if (!used.has(t.id)) return { topic: t, urgent: true };
  }
  const next = evergreenPool(opts.keywordTargets).find((t) => !used.has(t.id));
  return next ? { topic: next, urgent: false } : null;
}

/** Kimliği bilinen herhangi bir konuyu (admin elle seçimi için) bulur. */
export function findTopic(id: string, now: number, keywordTargets: string[] = []): BlogTopic | null {
  const occ = upcomingOccasions(now, 400).find((o) => `occ-${o.def.id}-${o.year}` === id);
  if (occ) return occasionTopic(occ.def, occ.year, occ.date);
  return evergreenPool(keywordTargets).find((t) => t.id === id) ?? null;
}
