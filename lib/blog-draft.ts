// Blog taslağı üretimi (saf, testli): konu + ürün verisi → yazı. İki yol vardır:
//  1) Şablon tabanlı (ücretsiz, her zaman çalışır): konu bankasındaki hazır bölümler + ürün bölümü.
//  2) LLM (GEMINI_API_KEY varsa): `buildLlmPrompt` ile istenir, `parseLlmDraft` ile doğrulanır; geçersizse şablona düşülür.
// Ürün listesi her iki yolda da KOD tarafından eklenir (model fiyat/ürün uydurmasın).
import type { Product } from '@/types';
import type { FaqItem } from './posts-types';
import type { BlogTopic } from './blog-topics';
import { GENERAL_FAQ } from './faq-schema';
import { slugifyHeading } from './markdown';
import { formatPriceRange, displayTitle } from './format';
import { getActive, getCategory, getFeatured, getPriceMax, getPriceMin, getSlug, getTitle } from './product-utils';

export interface BlogDraft {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  faq: FaqItem[];
  productIds: string[];
  categories: string[];
  coverImage?: string;
  source: 'template' | 'gemini';
}

const COVER_RE = /^karta-baski\/[A-Za-z0-9_\-/]{3,120}$/;

/** Konunun tercih ettiği kategorilerden (yoksa öne çıkanlardan) en fazla `max` aktif ürün. */
export function pickProductsForTopic(topic: BlogTopic, products: Product[], max = 4): Product[] {
  const active = products.filter((p) => getActive(p));
  const wanted = new Set<string>(topic.categories);
  const score = (p: Product) => (wanted.has(getCategory(p)) ? 2 : 0) + (getFeatured(p) ? 1 : 0);
  return [...active]
    .filter((p) => wanted.size === 0 || wanted.has(getCategory(p)))
    .sort((a, b) => score(b) - score(a) || (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, max);
}

function productSection(products: Product[]): string {
  if (products.length === 0) return '';
  const lines = products.map((p) => {
    const price = formatPriceRange(getPriceMin(p), getPriceMax(p));
    return `- [${displayTitle(getTitle(p))}](/urun/${getSlug(p)}) — ${getCategory(p)}, ${price}`;
  });
  return `## Konuyla ilgili modeller\n\nBu yazıdaki fikirler için uygun olan bazı modellerimiz:\n\n${lines.join('\n')}`;
}

function orderSection(topic: BlogTopic): string {
  const corporate = topic.categories.includes('Kurumsal');
  return [
    '## Sipariş nasıl verilir?',
    '',
    `Beğendiğiniz modeli seçip WhatsApp üzerinden tasarım fikrinizi bize iletmeniz yeterli. Önizlemeyi onayladıktan sonra siparişiniz yaklaşık 3 iş günü içinde kargoya verilir. Ayrıntılar için [nasıl sipariş verilir](/nasil-siparis-verilir) sayfasına göz atabilirsiniz.${corporate ? ' Toplu siparişler için [kurumsal sipariş](/kurumsal) sayfasından bilgi alabilirsiniz.' : ''}`,
  ].join('\n');
}

/** Slug: başlıktan, en fazla 80 karakter; `existing` ile çakışırsa -2, -3 eklenir. */
export function makeSlug(title: string, existing: Iterable<string> = []): string {
  const taken = new Set(existing);
  let base = slugifyHeading(title).slice(0, 80).replace(/-+$/g, '');
  if (base.length < 3) base = 'yazi';
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const s = `${base}-${i}`;
    if (!taken.has(s)) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function mergeFaq(topicFaq: FaqItem[], extra: FaqItem[] = []): FaqItem[] {
  const seen = new Set<string>();
  const out: FaqItem[] = [];
  for (const f of [...topicFaq, ...extra]) {
    const key = f.q.trim().toLocaleLowerCase('tr-TR');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ q: f.q.trim(), a: f.a.trim() });
  }
  return out.slice(0, 6);
}

function coverFor(products: Product[]): string | undefined {
  for (const p of products) {
    const id = p.images?.[0];
    if (id && COVER_RE.test(id)) return id;
  }
  return undefined;
}

function finalize(topic: BlogTopic, products: Product[], base: { title: string; excerpt: string; body: string; tags: string[]; faq: FaqItem[] }, source: BlogDraft['source']): BlogDraft {
  const blocks = [base.body.trim(), productSection(products), orderSection(topic)].filter(Boolean);
  const cats = new Set<string>(topic.categories);
  for (const p of products) { const c = getCategory(p); if (c) cats.add(c); }
  return {
    title: base.title.slice(0, 140),
    excerpt: base.excerpt.slice(0, 320),
    content: blocks.join('\n\n'),
    tags: Array.from(new Set(base.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 10),
    faq: base.faq,
    productIds: products.map((p) => p.id),
    categories: Array.from(cats),
    coverImage: coverFor(products),
    source,
  };
}

/** Şablon tabanlı taslak: konu bankasındaki bölümler + ürün bölümü + sipariş bölümü. */
export function buildTemplateDraft(topic: BlogTopic, products: Product[]): BlogDraft {
  const body = [topic.intro, ...topic.sections.map((s) => `## ${s.h}\n\n${s.p}`)].join('\n\n');
  return finalize(
    topic,
    products,
    { title: topic.title, excerpt: topic.excerpt, body, tags: topic.tags, faq: mergeFaq(topic.faq, GENERAL_FAQ.slice(0, 1)) },
    'template',
  );
}

// ── LLM yolu ─────────────────────────────────────────────────────────────────

/** Gemini'ye gönderilecek istem. Marka gerçekleri sabittir; fiyat ve ürün listesi kodla eklenir. */
export function buildLlmPrompt(topic: BlogTopic, products: Product[], extraKeywords: string[] = []): string {
  const outline = topic.sections.map((s) => `- ${s.h}`).join('\n');
  const prod = products.map((p) => `- ${displayTitle(getTitle(p))} (${getCategory(p)})`).join('\n') || '- (ürün verisi yok)';
  const kws = Array.from(new Set([...topic.tags, ...extraKeywords])).slice(0, 12).join(', ');
  return [
    'Sen, Türkiye\'de kişiye özel kupa ve fincan baskısı yapan KAR-TA BASKI için çalışan deneyimli bir Türkçe SEO içerik yazarısın.',
    `Konu: ${topic.title}`,
    `Hedef anahtar kelimeler: ${kws}`,
    'Önerilen bölüm başlıkları:',
    outline,
    'Markanın değişmez gerçekleri (bunların dışında somut iddia, fiyat, oran ya da istatistik UYDURMA):',
    '- Minimum sipariş adedi yok; tek adet de basılır. Toplu/kurumsal siparişte adede göre özel fiyat verilir.',
    '- Siparişler yalnızca WhatsApp üzerinden alınır; sepet ya da online ödeme sayfası yoktur.',
    '- Tasarım ücretsiz hazırlanır; baskıdan önce dijital önizleme gönderilir, onay olmadan baskı yapılmaz.',
    '- Onaydan sonra yaklaşık 3 iş günü içinde kargoya verilir; Türkiye geneline gönderim yapılır.',
    '- Baskı tekniği sublimasyondur; elde yıkama önerilir. Sihirli kupa ısıya duyarlıdır, bulaşık makinesine girmemelidir.',
    'Bu ürünlerden bahsedebilirsin ama ürün adı dışında fiyat/özellik yazma (liste yazının sonuna otomatik eklenecek):',
    prod,
    'Kurallar: Doğal, samimi ve bilgilendirici bir dil kullan; 650–900 kelime; yalnızca "##" ve "###" başlıkları (H1 yok); kısa paragraflar ve gerektiğinde "- " madde listeleri; HTML ya da emoji kullanma; başlıklara anahtar kelimeyi doğal biçimde yerleştir.',
    'Yalnızca şu JSON nesnesini döndür (başka metin yok): {"title": string (en çok 70 karakter), "excerpt": string (140-160 karakter, meta açıklama), "content": string (Markdown), "tags": string[] (en çok 8), "faq": [{"q": string, "a": string}] (3-4 soru, cevaplar 1-3 cümle)}',
  ].join('\n');
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

/** Gemini yanıtını doğrular; kabul edilemezse null (çağıran şablona düşer). */
export function parseLlmDraft(raw: string, topic: BlogTopic, products: Product[]): BlogDraft | null {
  let obj: unknown;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const content = typeof o.content === 'string' ? stripTags(o.content).replace(/^#\s+.*\n+/, '') : '';
  if (content.length < 1200 || (content.match(/^##\s+/gm) ?? []).length < 3) return null;

  const rawTitle = typeof o.title === 'string' ? stripTags(o.title) : '';
  // Özel gün konularında başlık (yıl, gün adı) kod tarafından sabit tutulur.
  const title = topic.kind !== 'occasion' && rawTitle.length >= 20 && rawTitle.length <= 110 ? rawTitle : topic.title;
  const excerptRaw = typeof o.excerpt === 'string' ? stripTags(o.excerpt) : '';
  const excerpt = excerptRaw.length >= 60 ? excerptRaw : topic.excerpt;
  const tags = Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string').map(stripTags).filter((t) => t && t.length <= 30) : [];
  const faqRaw = Array.isArray(o.faq) ? o.faq : [];
  const faq: FaqItem[] = faqRaw
    .map((f) => (f && typeof f === 'object' ? { q: stripTags(String((f as { q?: unknown }).q ?? '')), a: stripTags(String((f as { a?: unknown }).a ?? '')) } : null))
    .filter((f): f is FaqItem => !!f && f.q.length >= 3 && f.q.length <= 220 && f.a.length >= 3 && f.a.length <= 1200);

  return finalize(
    topic,
    products,
    { title, excerpt, body: content, tags: tags.length ? [...tags, ...topic.tags.slice(0, 2)] : topic.tags, faq: mergeFaq(faq.length ? faq : topic.faq) },
    'gemini',
  );
}
