import { HIKAYE, hikayeUrl, kisaMetin, telegramMetni, uzunMetin } from '@/lib/paylasim/metin';
import type { PaylasimUrun } from '@/lib/paylasim/types';

const u: PaylasimUrun = {
  id: 'a', title: 'Sihirli Kupa', slug: 'sihirli-kupa', category: 'Sihirli Kupa', shortDesc: 'Sıcak <içecek> ile açılır.',
  deliveryDays: 3, createdAt: 1, images: ['karta-baski/urunler/x'], colors: [],
  tiers: Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}’li uzun set açıklaması tasarımlı`, price: `${300 - i} ₺` })),
};

it('uzun açıklamada tüm kademeler, renk ve bağlantı vardır', () => {
  const s = uzunMetin(u, 'Siyah');
  expect(s).toContain('Siyah renk');
  expect(s.match(/₺/g)).toHaveLength(7);
  expect(s).toContain('/urun/sihirli-kupa');
});
it('kısa metin sınırı aşmaz ve bağlantıyı korur', () => {
  const s = kisaMetin(u, '', 500);
  expect(s.length).toBeLessThanOrEqual(500);
  expect(s).toContain('/urun/sihirli-kupa');
});
it('Telegram metni HTML kaçışlı ve 1024 altındadır', () => {
  const s = telegramMetni(u, '');
  expect(s).not.toContain('<içecek>');
  expect(s.length).toBeLessThanOrEqual(1024);
});
it('hikâye adresi 1080×1920, ad + 7 kademe + site katmanı içerir', () => {
  const url = hikayeUrl('demo', 'karta-baski/urunler/x', u);
  expect(url).toContain('w_1080,h_1920');
  expect(url).toContain('l_karta-baski:urunler:x/c_fit,w_1080,h_840');
  // Yazılar fotoğrafın üstüne binmez: ad fotoğrafın üstünde, fiyatlar altında
  expect(url).not.toMatch(/co_[^/]+\/fl_layer_apply,g_center/);
  const textY = Array.from(url.matchAll(/l_text:[^/]+\/fl_layer_apply,g_north,y_(\d+)/g), (m) => Number(m[1]));
  expect(textY).toHaveLength(9);
  expect(textY[0]).toBeLessThan(HIKAYE.fotoUst - 60);
  expect(Math.min(...textY.slice(1))).toBeGreaterThanOrEqual(HIKAYE.fotoUst + HIKAYE.fotoBoy);
  expect(Math.max(...textY)).toBeLessThanOrEqual(1700);
  expect(url.match(/l_text:/g)).toHaveLength(9);
  expect(url.endsWith('/karta-baski/urunler/x')).toBe(true);
});

it('parantezden önceki iki nokta gösterimde atılır', () => {
  const v = { ...u, tiers: [{ label: 'Özel Tasarım: (1 adet)', price: '300 ₺' }] };
  expect(uzunMetin(v, '')).toContain('• Özel Tasarım (1 adet): 300 ₺');
  expect(decodeURIComponent(hikayeUrl('demo', 'karta-baski/urunler/x', v))).toContain('Özel Tasarım (1 adet): 300 ₺');
});
