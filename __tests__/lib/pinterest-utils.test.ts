import {
  normalizeName, boardNameFor, findBoard, missingBoards, altBoardName, isBoardNameTaken, pinTitle, pinDescription, blogPinDescription,
  buildPinterestAuthUrl, REQUIRED_BOARDS, BLOG_BOARD, PIN_TITLE_MAX, PIN_DESC_MAX,
} from '@/lib/pinterest-utils';
import { CATEGORIES } from '@/types';

describe('normalizeName / boardNameFor', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(normalizeName('Büyük Kupa')).toBe('buyuk kupa');
    expect(normalizeName('Seramik Kahve Fincanı')).toBe('seramik kahve fincani');
  });
  it('her kategori kendi adıyla panoya gider, bilinmeyen kategori Özel Tasarım olur', () => {
    for (const c of CATEGORIES) expect(boardNameFor(c)).toBe(c);
    expect(boardNameFor('LATTE FİNCANI')).toBe('Latte Fincanı');
    expect(boardNameFor('Bilinmiyor')).toBe('Özel Tasarım');
  });
  it('gerekli panolar kategoriler + blog panosudur', () => {
    expect(REQUIRED_BOARDS).toEqual([...CATEGORIES, BLOG_BOARD]);
  });
});

describe('findBoard / missingBoards', () => {
  const boards = [{ id: '1', name: 'Lüks Kupa' }, { id: '2', name: 'Kurumsal - KAR-TA BASKI' }, { id: '3', name: 'Kupa Rehberi' }];
  it('tam eşleşme ve "ad - ek" biçimini bulur', () => {
    expect(findBoard(boards, 'Lüks Kupa')?.id).toBe('1');
    expect(findBoard(boards, 'Kurumsal')?.id).toBe('2');
    expect(findBoard(boards, 'Latte Fincanı')).toBeNull();
  });
  it('eksik panoları döndürür', () => {
    const missing = missingBoards(boards);
    expect(missing).not.toContain('Lüks Kupa');
    expect(missing).not.toContain('Kurumsal');
    expect(missing).not.toContain(BLOG_BOARD);
    expect(missing).toContain('Latte Fincanı');
  });
  it('yedek ad ve ad çakışması hatası', () => {
    expect(altBoardName('Lüks Kupa')).toBe('Lüks Kupa - KAR-TA BASKI');
    expect(isBoardNameTaken('You already have a board with this name (kod 58)')).toBe(true);
    expect(isBoardNameTaken('başka hata')).toBe(false);
  });
});

describe('pinTitle / pinDescription', () => {
  it('başlığı 100 karakterde keser', () => {
    expect(pinTitle('A'.repeat(300)).length).toBeLessThanOrEqual(PIN_TITLE_MAX);
    expect(pinTitle('  Kupa  ')).toBe('Kupa');
  });
  it('açıklama 800 karakteri geçmez, alt bilgi ve hashtag kalır', () => {
    const d = pinDescription({ priceText: '150₺ – 350₺', category: 'Pro Kupa', description: 'Açıklama '.repeat(300), deliveryDays: 3, phoneDisplay: '0545 826 65 08' });
    expect(d.length).toBeLessThanOrEqual(PIN_DESC_MAX);
    expect(d).toContain('150₺ – 350₺');
    expect(d).toContain('WhatsApp ile sipariş: 0545 826 65 08');
    expect(d).toContain('#kartabaski');
    expect(d).not.toMatch(/Ümit|Esenyurt|nakliye/i);
  });
  it('kısa açıklama aynen girer; boşsa gövde atlanır', () => {
    const base = { priceText: '150₺', category: 'Lüks Kupa', phoneDisplay: '0545' };
    expect(pinDescription({ ...base, description: 'Hediye için ideal.' })).toContain('Hediye için ideal.');
    expect(pinDescription({ ...base, description: '' })).not.toContain('\n\n\n');
  });
  it('blog pini açıklaması sınırı aşmaz', () => {
    const d = blogPinDescription({ excerpt: 'Özet '.repeat(400), tags: ['kupa rehberi'] });
    expect(d.length).toBeLessThanOrEqual(PIN_DESC_MAX);
    expect(d).toContain('#kupabaskı');
  });
});

describe('buildPinterestAuthUrl', () => {
  it('gerekli parametreleri içerir', () => {
    const u = new URL(buildPinterestAuthUrl({ appId: 'APP', redirectUri: 'https://www.kartabaski.com/api/pinterest/callback', state: 'abc' }));
    expect(u.origin + u.pathname).toBe('https://www.pinterest.com/oauth/');
    expect(u.searchParams.get('client_id')).toBe('APP');
    expect(u.searchParams.get('redirect_uri')).toBe('https://www.kartabaski.com/api/pinterest/callback');
    expect(u.searchParams.get('state')).toBe('abc');
    expect(u.searchParams.get('scope')).toContain('pins:write');
  });
});
