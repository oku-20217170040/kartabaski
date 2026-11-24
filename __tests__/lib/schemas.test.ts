import { ProductSchema } from '@/lib/schemas';

const parse = (category: unknown) => ProductSchema.parse({ id: '1', category }).category;

describe('kategori eşleme', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('geçerli kategori korunur', () => expect(parse('Lüks Kupa')).toBe('Lüks Kupa'));
  it('eski adlar yeni adlara çevrilir', () => {
    expect(parse('Seramik Nescafe Fincanı')).toBe('Seramik Kahve Fincanı');
    expect(parse('Nescafe Fincanı')).toBe('Kahve Fincanı');
    expect(console.warn).not.toHaveBeenCalled();
  });
  it('bilinmeyen kategori Özel Tasarım olur ve uyarı basar', () => {
    expect(parse('Bilinmeyen')).toBe('Özel Tasarım');
    expect(console.warn).toHaveBeenCalled();
  });
  it('eksik kategori Özel Tasarım olur', () => expect(parse(undefined)).toBe('Özel Tasarım'));
});
