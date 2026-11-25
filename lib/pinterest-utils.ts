// Pinterest için saf yardımcılar (testli). Pin başlığı en fazla 100, açıklaması en fazla 800 karakterdir.
import { CATEGORIES } from '@/types';
import { socialHashtags } from './telegram-channel-utils';

export const PIN_TITLE_MAX = 100;
export const PIN_DESC_MAX = 800;
export const PIN_MAX_IMAGES = 5; // çok görselli (karusel) pin en fazla 5 görsel alır

export interface PinterestBoard { id: string; name: string }

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Büyük Kupa" → "buyuk kupa". */
export function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Blog yazıları için pano adı. */
export const BLOG_BOARD = 'Kupa Rehberi';

/** Otomasyonun kullandığı pano adları: her kupa kategorisi + blog panosu. Hesapta yoksa gerektiğinde oluşturulur. */
export const REQUIRED_BOARDS: string[] = [...CATEGORIES, BLOG_BOARD];

/** Bir kategori için hedef pano adı (kategori adı; bilinmeyen kategori "Özel Tasarım"). */
export function boardNameFor(category: string): string {
  const n = normalizeName(category);
  return CATEGORIES.find((c) => normalizeName(c) === n) ?? 'Özel Tasarım';
}

/** Ad çakışmasında kullanılan yedek pano adı ("Lüks Kupa - KAR-TA BASKI"). */
export const altBoardName = (name: string) => `${name} - KAR-TA BASKI`;

/** Pinterest "bu adda pano zaten var" (kod 58) hatası mı? Sandbox'ta liste boş görünse de ad çakışabilir. */
export const isBoardNameTaken = (message: string) => /kod 58|already have a board/i.test(message);

/** İstenen adda pano var mı (sadeleştirilmiş tam eşleşme; "Lüks Kupa - KAR-TA BASKI" gibi ekli ad da bulunmuş sayılır). */
export function findBoard(boards: PinterestBoard[], wanted: string): PinterestBoard | null {
  const n = normalizeName(wanted);
  const named = boards.map((b) => ({ b, n: normalizeName(b.name) }));
  return (named.find((x) => x.n === n) ?? named.find((x) => x.n.startsWith(`${n} `)))?.b ?? null;
}

/** Hesapta bulunmayan istenen panolar. */
export function missingBoards(existing: PinterestBoard[], wanted: string[] = REQUIRED_BOARDS): string[] {
  return wanted.filter((w) => !findBoard(existing, w));
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s);

export function pinTitle(title: string): string {
  return cut(title.trim(), PIN_TITLE_MAX);
}

/** Fiyat + açıklama + teslimat/WhatsApp CTA + hashtag; 800 karakteri geçmez, alt bilgi (CTA ve etiketler) her zaman kalır. */
export function pinDescription(opts: {
  priceText: string;
  category: string;
  description: string;
  deliveryDays?: number;
  phoneDisplay: string;
}): string {
  const header = `${opts.priceText} · ${opts.category}`;
  const tags = socialHashtags(opts.category, [], 6).join(' ');
  const footer = `\n\nKişiye özel baskı${opts.deliveryDays ? ` · ${opts.deliveryDays} iş günü teslimat` : ''}\nWhatsApp ile sipariş: ${opts.phoneDisplay}\n${tags}`;
  const desc = opts.description.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  const room = PIN_DESC_MAX - header.length - footer.length - 2;
  const body = cut(desc, Math.max(0, room));
  return `${header}${body ? `\n\n${body}` : ''}${footer}`;
}

/** Blog pini açıklaması: özet + okuma çağrısı + hashtag. */
export function blogPinDescription(opts: { excerpt: string; tags?: string[] }): string {
  const tags = socialHashtags('', opts.tags ?? [], 6).join(' ');
  const footer = `\n\nYazının tamamı için bağlantıya tıklayın.\n${tags}`;
  const body = cut(opts.excerpt.replace(/\s+/g, ' ').trim(), Math.max(0, PIN_DESC_MAX - footer.length - 2));
  return `${body}${footer}`.trim();
}

export const PINTEREST_AUTH_URL = 'https://www.pinterest.com/oauth/';
export const PINTEREST_SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';

/** Yetkilendirme adresi: state, geri dönüşte CSRF kontrolü için çerezle karşılaştırılır. */
export function buildPinterestAuthUrl(opts: { appId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: PINTEREST_SCOPES,
    state: opts.state,
  });
  return `${PINTEREST_AUTH_URL}?${q.toString()}`;
}
