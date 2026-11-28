// Paylaşım açıklamaları ve hikâye görsel adresi (testli, saf).
import { PHONE_DISPLAY } from '../constants';
import { overlayText } from '../instagram-utils';
import { clip, hashtagsFor, productUrl } from '../social-content-utils';
import { MAX_KADEME, type PaylasimUrun } from './types';

const baslik = (u: PaylasimUrun, color: string) => `☕ ${clip(u.title, 90)}${color ? ` (${color} renk)` : ''}`;
/** "Özel Tasarım: (1 adet)" gibi etiketlerde parantezden önceki iki nokta gösterimde atılır (onay bozulmaz). */
const etiket = (label: string) => label.replace(/\s*:\s*(?=\()/g, ' ');
const satirlar = (u: PaylasimUrun) => u.tiers.map((t) => `• ${etiket(t.label)}: ${t.price}`);

export function uzunMetin(u: PaylasimUrun, color: string): string {
  const ozet = clip(u.shortDesc, 200);
  return [
    baslik(u, color), '',
    ...(ozet ? [ozet, ''] : []),
    ...satirlar(u), '',
    `📦 Teslimat: yaklaşık ${u.deliveryDays} iş günü`,
    `📲 Sipariş için WhatsApp: ${PHONE_DISPLAY}`,
    `👉 ${productUrl(u.slug)}`, '',
    hashtagsFor(u.category).join(' '),
  ].join('\n');
}

/** Sınırlı alanlar (Threads, Pinterest, TikTok): sığana kadar son kademeler düşer, bağlantı kalır. */
export function kisaMetin(u: PaylasimUrun, color: string, max: number): string {
  const rows = satirlar(u);
  const build = (n: number) => [baslik(u, color), ...rows.slice(0, n), `👉 ${productUrl(u.slug)}`].join('\n');
  let n = rows.length;
  while (n > 0 && build(n).length > max) n--;
  const text = build(n);
  return text.length <= max ? text : text.slice(0, max);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function telegramMetni(u: PaylasimUrun, color: string): string {
  const rows = satirlar(u).map(esc);
  const build = (ozet: string) =>
    [`<b>${esc(baslik(u, color))}</b>`, ...(ozet ? ['', ozet] : []), '', ...rows, '', `👉 ${productUrl(u.slug)}`].join('\n');
  const full = build(esc(clip(u.shortDesc, 200)));
  return full.length <= 1024 ? full : build('');
}

export function hikayeUrl(cloud: string, imageId: string, u: PaylasimUrun): string {
  if (!cloud) throw new Error('Cloudinary cloud adı tanımlı değil');
  const lines = [
    { text: clip(u.title, 30), style: 'Roboto_56_bold', color: 'white', bg: '1D47C4' },
    ...u.tiers.slice(0, MAX_KADEME).map((t) => ({ text: clip(`${etiket(t.label)}: ${t.price}`, 40), style: 'Roboto_42_bold', color: 'rgb:121214', bg: 'ffffffe6' })),
    { text: 'kartabaski.com', style: 'Roboto_40_bold', color: 'rgb:121214', bg: 'FFC51B' },
  ];
  const layers = lines.map((l, i) => {
    const y = Math.round((i - (lines.length - 1) / 2) * 84);
    return `l_text:${l.style}:%20${overlayText(l.text)}%20,co_${l.color},b_rgb:${l.bg}/fl_layer_apply,g_center,y_${y}`;
  });
  // Zemin: aynı fotoğrafın bulanık kopyası; üstüne fotoğrafın tamamı (kupa kırpılmaz), sonra yazılar.
  const base = [
    'f_jpg,q_85,c_fill,g_auto,w_1080,h_1920', 'e_blur:1500',
    `l_${imageId.replace(/\//g, ':')}/c_fit,w_1080,h_1920/fl_layer_apply,g_center`,
  ];
  return `https://res.cloudinary.com/${cloud}/image/upload/${[...base, ...layers].join('/')}/${imageId}`;
}
