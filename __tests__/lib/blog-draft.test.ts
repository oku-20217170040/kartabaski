import { buildTemplateDraft, buildLlmPrompt, parseLlmDraft, makeSlug, pickProductsForTopic } from '@/lib/blog-draft';
import { EVERGREEN_TOPICS, categoryTopic } from '@/lib/blog-topics';
import { renderMarkdown } from '@/lib/markdown';
import type { Product } from '@/types';

const prod = (over: Partial<Product>): Product => ({
  id: 'p1', title: 'Sihirli Mat Kupa — Kişiye Özel Baskı', slug: 'sihirli-mat-kupa', priceMin: 150, priceMax: 250,
  category: 'Sihirli Kupa', active: true, shortDesc: '', description: '', images: ['karta-baski/urunler/img1'],
  deliveryDays: 3, createdAt: 1, updatedAt: 1, ...over,
});

const sihirli = EVERGREEN_TOPICS.find((t) => t.id === 'sihirli-kupa-nasil-calisir')!;

describe('pickProductsForTopic', () => {
  it('konunun kategorisindeki aktif ürünleri seçer', () => {
    const items = [
      prod({ id: 'a' }),
      prod({ id: 'b', active: false }),
      prod({ id: 'c', category: 'Lüks Kupa' }),
      prod({ id: 'd', featured: true }),
    ];
    expect(pickProductsForTopic(sihirli, items, 4).map((p) => p.id)).toEqual(['d', 'a']);
  });
  it('kategori tercihi olmayan konuda öne çıkanlar önce gelir', () => {
    const t = { ...sihirli, categories: [] };
    const items = [prod({ id: 'a' }), prod({ id: 'b', featured: true, category: 'Lüks Kupa' })];
    expect(pickProductsForTopic(t, items, 1).map((p) => p.id)).toEqual(['b']);
  });
});

describe('buildTemplateDraft', () => {
  const draft = buildTemplateDraft(sihirli, [prod({})]);

  it('ürün ve sipariş bölümlerini ekler; ürün kimliği ve kategori işlenir', () => {
    expect(draft.source).toBe('template');
    expect(draft.content).toContain('## Konuyla ilgili modeller');
    expect(draft.content).toContain('[Sihirli Mat Kupa](/urun/sihirli-mat-kupa)');
    expect(draft.content).toContain('## Sipariş nasıl verilir?');
    expect(draft.productIds).toEqual(['p1']);
    expect(draft.categories).toContain('Sihirli Kupa');
    expect(draft.coverImage).toBe('karta-baski/urunler/img1');
  });

  it('ürün yoksa ürün bölümü eklenmez', () => {
    expect(buildTemplateDraft(sihirli, []).content).not.toContain('Konuyla ilgili modeller');
  });

  it('içerik güvenle HTML’e çevrilir ve yeterince uzundur', () => {
    expect(draft.content.length).toBeGreaterThan(1200);
    const html = renderMarkdown(draft.content);
    expect(html).toContain('<h2 id=');
    expect(html).toContain('href="/urun/sihirli-mat-kupa"');
  });

  it('SSS yinelenmez ve 6’yı geçmez', () => {
    const qs = draft.faq.map((f) => f.q);
    expect(new Set(qs).size).toBe(qs.length);
    expect(qs.length).toBeLessThanOrEqual(6);
  });

  it('kategori rehberi şablonu da eksiksiz', () => {
    const d = buildTemplateDraft(categoryTopic('Latte Fincanı'), []);
    expect(d.title).toContain('Latte Fincanı');
    expect(d.excerpt.length).toBeLessThanOrEqual(320);
  });
});

describe('makeSlug', () => {
  it('Türkçe başlığı slug yapar, çakışmada sayı ekler', () => {
    expect(makeSlug('Sihirli Kupa Nasıl Çalışır?')).toBe('sihirli-kupa-nasil-calisir');
    expect(makeSlug('Sihirli Kupa Nasıl Çalışır?', ['sihirli-kupa-nasil-calisir'])).toBe('sihirli-kupa-nasil-calisir-2');
  });
  it('80 karakteri aşmaz', () => {
    expect(makeSlug('a '.repeat(100)).length).toBeLessThanOrEqual(80);
  });
});

describe('LLM yolu', () => {
  const body = `## Birinci bölüm\n\n${'Kupa baskı hakkında anlamlı bir paragraf. '.repeat(15)}\n\n## İkinci bölüm\n\n${'Devam eden metin ve ipuçları. '.repeat(15)}\n\n## Üçüncü bölüm\n\n${'Sonuç ve öneriler. '.repeat(15)}`;
  const good = JSON.stringify({
    title: 'Sihirli Kupa Nasıl Çalışır, Hangi Tasarımlar Uygun?',
    excerpt: 'Sihirli kupanın ısıya duyarlı yüzeyi, bakım ipuçları ve hediye olarak neden tercih edildiği hakkında kısa bir rehber.',
    content: body,
    tags: ['sihirli kupa', 'hediye'],
    faq: [{ q: 'Sihirli kupa yıkanır mı?', a: 'Elde yıkamanızı öneririz.' }],
  });

  it('istem, marka gerçeklerini ve JSON biçimini içerir', () => {
    const p = buildLlmPrompt(sihirli, [prod({})]);
    expect(p).toContain('Minimum sipariş adedi yok');
    expect(p).toContain('WhatsApp');
    expect(p).toContain('"content"');
    expect(p).toContain('Sihirli Mat Kupa');
  });

  it('geçerli yanıtı taslağa çevirir, ürün bölümünü kodla ekler', () => {
    const d = parseLlmDraft(good, sihirli, [prod({})])!;
    expect(d.source).toBe('gemini');
    expect(d.title).toBe('Sihirli Kupa Nasıl Çalışır, Hangi Tasarımlar Uygun?');
    expect(d.content).toContain('## Konuyla ilgili modeller');
    expect(d.faq[0].q).toBe('Sihirli kupa yıkanır mı?');
  });

  it('kod bloğu içindeki JSON’u da okur; HTML etiketlerini temizler', () => {
    const wrapped = '```json\n' + JSON.stringify({ ...JSON.parse(good), content: body + '\n\n<script>x</script>' }) + '\n```';
    const d = parseLlmDraft(wrapped, sihirli, [])!;
    expect(d.content).not.toContain('<script>');
  });

  it('kısa, başlıksız ya da bozuk yanıtı reddeder (şablona düşülür)', () => {
    expect(parseLlmDraft('merhaba', sihirli, [])).toBeNull();
    expect(parseLlmDraft(JSON.stringify({ title: 'x', content: 'kısa' }), sihirli, [])).toBeNull();
    expect(parseLlmDraft(JSON.stringify({ content: 'a'.repeat(2000) }), sihirli, [])).toBeNull(); // ## başlık yok
  });

  it('özel gün konusunda başlık koddan gelir', () => {
    const occ = { ...sihirli, kind: 'occasion' as const, title: 'Anneler Günü İçin Kupa (2027)' };
    expect(parseLlmDraft(good, occ, [])!.title).toBe('Anneler Günü İçin Kupa (2027)');
  });
});
