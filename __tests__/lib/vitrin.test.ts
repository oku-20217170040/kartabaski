import { toLines } from '@/components/MugPreview';
import { PRINT_SAMPLES, VITRIN_MUGS, vitrinOrderText } from '@/lib/vitrin';
import { existsSync } from 'fs';
import path from 'path';

describe('toLines', () => {
  it('boş metinde satır üretmez', () => {
    expect(toLines('   ')).toEqual([]);
  });

  it('kısa metni tek satırda tutar', () => {
    expect(toLines('Önce kahve')).toEqual(['Önce kahve']);
  });

  it('uzun metni en fazla üç dengeli satıra böler', () => {
    expect(toLines('İyi ki doğdun Şule, nice yıllara')).toEqual(['İyi ki', 'doğdun Şule,', 'nice yıllara']);
  });

  it('tek uzun kelimeyi bölmez', () => {
    expect(toLines('Muvaffakiyetsizleştiriciler')).toEqual(['Muvaffakiyetsizleştiriciler']);
  });
});

describe('vitrin görselleri', () => {
  it('her kupa ve örnek için dosya public/vitrin altında bulunur', () => {
    for (const { file } of [...VITRIN_MUGS, ...PRINT_SAMPLES]) {
      expect(existsSync(path.join(process.cwd(), 'public', 'vitrin', `${file}.webp`))).toBe(true);
    }
  });
});

describe('vitrinOrderText', () => {
  it('yazı ve fotoğraf yoksa yalnızca rengi söyler', () => {
    expect(vitrinOrderText({ text: '', color: 'Mavi', handwriting: false, hasPhoto: false }))
      .toBe('Merhaba, mavi kulplu kupaya baskı yaptırmak istiyorum.');
  });

  it('yazıyı, yazı tipini ve fotoğrafı ekler', () => {
    const text = vitrinOrderText({ text: ' Elif ', color: 'Koyu yeşil', handwriting: true, hasPhoto: true });
    expect(text).toContain('Yazı: "Elif" (el yazısı).');
    expect(text).toContain('Fotoğrafı bu mesajın ardından gönderiyorum.');
  });
});
