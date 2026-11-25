import { renderMarkdown, extractHeadings, slugifyHeading } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('başlık, paragraf, liste ve vurgu üretir', () => {
    const html = renderMarkdown('## Başlık\n\nMerhaba **dünya** ve *kupa*.\n\n- bir\n- iki');
    expect(html).toContain('<h2 id="baslik">Başlık</h2>');
    expect(html).toContain('<strong>dünya</strong>');
    expect(html).toContain('<em>kupa</em>');
    expect(html).toContain('<ul><li>bir</li><li>iki</li></ul>');
  });

  it('numaralı liste ve alıntı', () => {
    const html = renderMarkdown('1. bir\n2. iki\n\n> alıntı');
    expect(html).toContain('<ol><li>bir</li><li>iki</li></ol>');
    expect(html).toContain('<blockquote>alıntı</blockquote>');
  });

  it('HTML ve script enjeksiyonunu kaçışlar', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  });

  it('tehlikeli bağlantı şemalarını bağlantıya çevirmez', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
    expect(renderMarkdown('[x](//evil.example)')).not.toContain('<a');
  });

  it('site içi ve dış bağlantılar; dış bağlantı yeni sekmede açılır', () => {
    expect(renderMarkdown('[ürün](/urun/kupa-a)')).toContain('<a href="/urun/kupa-a">ürün</a>');
    expect(renderMarkdown('[dış](https://example.com)')).toContain('rel="noopener noreferrer"');
  });

  it('yalnızca kendi Cloudinary görsellerine izin verir', () => {
    expect(renderMarkdown('![k](karta-baski/urunler/abc)')).toContain('<img src="https://res.cloudinary.com/');
    expect(renderMarkdown('![k](https://evil.example/x.png)')).not.toContain('<img');
  });

  it('H1 yazılsa bile H2 olur (sayfa H1 başlığa ayrılmış)', () => {
    expect(renderMarkdown('# Başlık')).toContain('<h2 ');
  });
});

describe('extractHeadings / slugifyHeading', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(slugifyHeading('İçindekiler: Çay & Şeker')).toBe('icindekiler-cay-seker');
  });
  it('yalnızca ## başlıklarını listeler', () => {
    const list = extractHeadings('# H1\n## Bir\ntext\n### Alt\n## İki **kalın**');
    expect(list).toEqual([{ id: 'bir', text: 'Bir' }, { id: 'iki-kalin', text: 'İki kalın' }]);
  });
});
