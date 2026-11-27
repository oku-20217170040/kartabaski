// Arama motorları ve yapay zekâ botları için metin yardımcıları (saf, testli).

// Madde imleri ve süs işaretleri arama sonucunda anlam taşımaz.
const DECORATION = /[•▪●★☆✓✔✅❌️]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g;

/** Satır satır yazılmış ürün açıklamasının parçaları: süsler atılır, boş satır kalmaz. */
export function textParts(raw: string): string[] {
  return raw
    .split(/\r?\n|\s\|\s/)
    .map((line) => line.replace(DECORATION, '').replace(/\*\*|^#+\s*|^[-–]\s+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const sentence = (part: string) => (/[.!?:]$/.test(part) ? part : `${part}.`);

/** Açıklamanın düz metin hali. */
export const plainText = (raw: string, max = 600): string => clipWords(textParts(raw).map(sentence).join(' '), max);

/** Kelime ortasından kesmeden kısaltır. */
export function clipWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max / 2 ? space : cut.length).replace(/[\s,;:.]+$/, '')}…`;
}

/**
 * Ürün sayfasının arama açıklaması: ad, ürün bilgisinden sığdığı kadar özellik ve fiyat.
 * Yalnız ürün kaydındaki bilgiler kullanılır.
 */
export function productMetaDescription(input: { title: string; text: string; price?: string }, max = 158): string {
  const head = `${input.title}: kişiye özel baskı.`;
  const tail = input.price ? ` Fiyat: ${input.price}.` : '';
  let body = '';
  for (const part of textParts(input.text)) {
    const next = `${body} ${sentence(part.replace(/\s*\([^)]*\)/g, ''))}`;
    if (head.length + next.length + tail.length > max) break;
    body = next;
  }
  return clipWords(`${head}${body}${tail}`, max);
}

export const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);
