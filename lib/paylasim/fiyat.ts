// Fiyat kademeleri: açıklamadaki satırlardan öneri; yayın yalnız onaylı kademelerle (testli, saf).
import { hashStr } from '../social-content-utils';
import { MAX_KADEME, type Kademe } from './types';

const LINE = /^(.*?(?::|\)))\s*:?\s*([\d.]+(?:,\d{1,2})?)\s*(?:₺|TL)(\s*\/\s*adet)?$/i;

export function parsePriceLines(description: string): Kademe[] {
  const out: Kademe[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^[\s•✔*-]+/, '').replace(/[\\*\s]+$/, '').trim();
    const m = line.match(LINE);
    if (!m) continue;
    const label = m[1].replace(/\s*:$/, '').trim();
    if (label) out.push({ label, price: `${m[2]} ₺${m[3] ? '/adet' : ''}` });
  }
  return out.slice(0, MAX_KADEME);
}

export const priceSourceKey = (description: string): string =>
  String(hashStr(parsePriceLines(description).map((k) => `${k.label}|${k.price}`).join(';')));

export function approvedTiers(p: { description: string; priceTiers?: Kademe[]; priceTiersSource?: string }): Kademe[] | null {
  if (!p.priceTiers?.length || p.priceTiersSource !== priceSourceKey(p.description)) return null;
  return p.priceTiers.slice(0, MAX_KADEME);
}
