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

/** Hikâye yerleşimi (1080×1920): ad üstte, fotoğraf ortada temiz, fiyatlar altta. Alt/üst Instagram arayüzüne pay bırakılır. */
export const HIKAYE = { baslikUst: 220, fotoUst: 330, fotoBoy: 840, fiyatUst: 1200, satir: 62 } as const;

export function hikayeUrl(cloud: string, imageId: string, u: PaylasimUrun): string {
  if (!cloud) throw new Error('Cloudinary cloud adı tanımlı değil');
  const text = (value: string, style: string, color: string, bg: string, y: number) =>
    `l_text:${style}:%20${overlayText(value)}%20,co_${color},b_rgb:${bg}/fl_layer_apply,g_north,y_${y}`;
  const rows = u.tiers.slice(0, MAX_KADEME);
  // Zemin: aynı fotoğrafın bulanık kopyası. Fotoğrafın tamamı kendi alanında durur; hiçbir yazı üstüne binmez.
  const layers = [
    'f_jpg,q_85,c_fill,g_auto,w_1080,h_1920', 'e_blur:1500',
    `l_${imageId.replace(/\//g, ':')}/c_fit,w_1080,h_${HIKAYE.fotoBoy}/c_pad,w_1080,h_${HIKAYE.fotoBoy},b_rgb:00000000/fl_layer_apply,g_north,y_${HIKAYE.fotoUst}`,
    text(clip(u.title, 30), 'Roboto_56_bold', 'white', '1D47C4', HIKAYE.baslikUst),
    ...rows.map((t, i) => text(clip(`${etiket(t.label)}: ${t.price}`, 40), 'Roboto_40_bold', 'rgb:121214', 'ffffff', HIKAYE.fiyatUst + i * HIKAYE.satir)),
    text('kartabaski.com', 'Roboto_40_bold', 'rgb:121214', 'FFC51B', HIKAYE.fiyatUst + rows.length * HIKAYE.satir),
  ];
  return `https://res.cloudinary.com/${cloud}/image/upload/${layers.join('/')}/${imageId}`;
}
