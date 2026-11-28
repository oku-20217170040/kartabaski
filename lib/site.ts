/** Sitenin kanonik adresi (sonunda "/" yok). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kartabaski.com').replace(/\/+$/, '');

export const INSTAGRAM_URL = 'https://www.instagram.com/kartabaskii/';

export type SocialId = 'instagram' | 'facebook' | 'threads' | 'telegram' | 'pinterest' | 'tiktok';

/** Markanın bütün sosyal hesapları: sayfa altı, iletişim bölümü, arama verisi ve llms.txt buradan okur. */
export const SOCIAL_LINKS: { id: SocialId; name: string; url: string }[] = [
  { id: 'instagram', name: 'Instagram', url: INSTAGRAM_URL },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/kartabaski' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/@kartabaski' },
  { id: 'threads', name: 'Threads', url: 'https://www.threads.com/@kartabaskii' },
  { id: 'telegram', name: 'Telegram', url: 'https://t.me/kartabaski' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/kartabaski/' },
];

/** JSON-LD'yi <script> içine güvenle gömmek için serileştirir ('<' kaçışlanır). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\u003c');
}
