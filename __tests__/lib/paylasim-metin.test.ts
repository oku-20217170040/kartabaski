import { hikayeUrl, kisaMetin, telegramMetni, uzunMetin } from '@/lib/paylasim/metin';
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
  expect(url).toContain('l_karta-baski:urunler:x/c_fit');
  expect(url.match(/l_text:/g)).toHaveLength(9);
  expect(url.endsWith('/karta-baski/urunler/x')).toBe(true);
});
