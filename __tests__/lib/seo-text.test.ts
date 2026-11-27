import { pendingUrls } from '@/lib/indexnow-utils';
import { clipWords, escapeXml, plainText, productMetaDescription, textParts } from '@/lib/seo-text';

const raw = '✔ İç hacim: 140ml\n✔ Yükseklik: 6 cm | Ağız çapı: 5.5 cm\n✔ Bulaşık makinesinde yıkanabilir (uzun ömür için el yıkaması önerilir)\n\n🎁 Hediye için ideal';

describe('seo metinleri', () => {
  it('süs işaretlerini ve boş satırları atar', () => {
    expect(textParts(raw)).toEqual(['İç hacim: 140ml', 'Yükseklik: 6 cm', 'Ağız çapı: 5.5 cm', 'Bulaşık makinesinde yıkanabilir (uzun ömür için el yıkaması önerilir)', 'Hediye için ideal']);
    expect(plainText(raw)).not.toMatch(/[✔🎁\n|]/u);
  });

  it('ürün açıklaması sınırı aşmaz, özellikleri ve fiyatı içerir', () => {
    const d = productMetaDescription({ title: 'Pro Kupa', text: raw, price: '300₺’den başlayan' });
    expect(d.length).toBeLessThanOrEqual(158);
    expect(d).toBe('Pro Kupa: kişiye özel baskı. İç hacim: 140ml. Yükseklik: 6 cm. Ağız çapı: 5.5 cm. Bulaşık makinesinde yıkanabilir. Fiyat: 300₺’den başlayan.');
    expect(productMetaDescription({ title: 'Kupa', text: '' })).toBe('Kupa: kişiye özel baskı.');
  });

  it('kelime ortasından kesmez ve XML kaçışı yapar', () => {
    expect(clipWords('bir iki üç dört beş altı', 12)).toBe('bir iki üç…');
    expect(escapeXml('a<b>&"\'')).toBe('a&lt;b&gt;&amp;&quot;&apos;');
  });
});

describe('IndexNow', () => {
  const site = 'https://www.kartabaski.com';
  const entries = [
    { url: site, lastModified: new Date(5000) }, { url: `${site}/blog`, lastModified: new Date(5000) },
    { url: `${site}/hakkimizda`, lastModified: new Date(5000) },
    { url: `${site}/urun/eski`, lastModified: new Date(100) }, { url: `${site}/blog/yeni`, lastModified: new Date(3000) },
  ];
  it('ilk bildirimde hepsini gönderir, sonra yalnız yeni ve değişenleri', () => {
    const first = pendingUrls(entries, [], site);
    expect(first.urls).toHaveLength(5);
    expect(pendingUrls(entries, first.sent, site).urls).toEqual([]);
    const changed = entries.map((e) => (e.url.endsWith('/urun/eski') ? { ...e, lastModified: new Date(9000) } : e));
    expect(pendingUrls(changed, first.sent, site).urls).toEqual([site, `${site}/blog`, `${site}/urun/eski`]);
  });

  it('eski tarihli olup haritaya sonradan düşen yazıyı da gönderir; liste sayfalarını izlemez', () => {
    const { sent } = pendingUrls(entries, [], site);
    const late = [...entries, { url: `${site}/blog/gec-gelen`, lastModified: new Date(1) }, { url: `${site}/blog/sayfa/2`, lastModified: new Date(99999) }];
    expect(pendingUrls(late, sent, site).urls).toEqual([site, `${site}/blog`, `${site}/blog/gec-gelen`]);
  });
});
