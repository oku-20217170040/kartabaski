// Teslimat adresi: liste verisi, arama ve tek satıra çevirme (istemci ve sunucu ortak, saf).

export interface Province { id: number; ad: string; ilceler: { id: number; ad: string }[] }
/** [ad, posta kodu, köy mü] */
export type PlaceRow = [string, string, 0 | 1];

export const POSTAL_RE = /^\d{5}$/;

/** Listedeki satırın görünen adı. */
export const placeName = ([name, , village]: PlaceRow) => `${name} ${village ? 'Köyü' : 'Mahallesi'}`;

const LETTERS: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };

/** Arama için: Türkçe küçük harf, aksansız ("Şişli" ile "sisli" eşleşir). */
export const searchKey = (value: string) =>
  value.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => LETTERS[c]).replace(/\s+/g, ' ').trim();

/** Aramayla eşleşenler; adı aramayla başlayanlar önde. */
export function filterOptions<T extends { label: string }>(options: T[], query: string): T[] {
  const q = searchKey(query);
  if (!q) return options;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const o of options) {
    const key = searchKey(o.label);
    if (key.startsWith(q)) starts.push(o);
    else if (key.includes(q)) contains.push(o);
  }
  return [...starts, ...contains];
}

export interface AddressParts {
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNo: string;
  doorNo?: string;
  postalCode: string;
}

/** Kargo etiketine yazılan tek satır adres. Eksik parça atlanır. */
export function formatAddress(a: Partial<AddressParts>): string {
  const building = [a.buildingNo?.trim() ? `No: ${a.buildingNo.trim()}` : '', a.doorNo?.trim() ? `Daire: ${a.doorNo.trim()}` : ''].filter(Boolean).join(' ');
  const street = [a.street?.trim(), building].filter(Boolean).join(' ');
  const region = [a.district?.trim(), a.city?.trim()].filter(Boolean).join(' / ');
  const tail = [a.postalCode?.trim(), region].filter(Boolean).join(' ');
  return [a.neighborhood?.trim(), street, tail].filter(Boolean).join(', ');
}
