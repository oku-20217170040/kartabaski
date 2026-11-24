/** Sitenin kanonik adresi (sonunda "/" yok). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kartabaski.com').replace(/\/+$/, '');

export const INSTAGRAM_URL = 'https://www.instagram.com/kartabaskii/';

/** JSON-LD'yi <script> içine güvenle gömmek için serileştirir ('<' kaçışlanır). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\u003c');
}
