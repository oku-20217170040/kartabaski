import { buildPatch, classifyReferrer, resolveSource, sourceGroup, sourceLabel, AI_SOURCES } from '@/lib/analytics-utils';

const HOST = 'www.kartabaski.com';

describe('classifyReferrer — yapay zeka ve Threads', () => {
  it.each([
    ['https://chatgpt.com/', 'ChatGPT'],
    ['https://chat.openai.com/c/1', 'ChatGPT'],
    ['https://claude.ai/chat/abc', 'Claude'],
    ['https://gemini.google.com/app', 'Gemini'],
    ['https://www.perplexity.ai/search?q=x', 'Perplexity'],
    ['https://copilot.microsoft.com/', 'Copilot'],
    ['https://chat.deepseek.com/', 'DeepSeek'],
    ['https://grok.com/', 'Grok'],
    ['https://www.meta.ai/', 'Meta AI'],
    ['https://chat.mistral.ai/', 'Mistral'],
    ['https://www.threads.net/@kartabaskit', 'Threads'],
    ['https://www.threads.com/@kartabaskit', 'Threads'],
  ])('%s → %s', (ref, name) => {
    expect(classifyReferrer(ref, HOST)).toBe(name);
  });

  it('Gemini artık Google sayılmaz, ama google.com.tr hâlâ Google', () => {
    expect(classifyReferrer('https://gemini.google.com/', HOST)).not.toBe('Google');
    expect(classifyReferrer('https://www.google.com.tr/', HOST)).toBe('Google');
  });
});

describe('resolveSource', () => {
  it('referrer varsa onu kullanır', () => {
    expect(resolveSource('https://claude.ai/', 'instagram', 'Chrome', HOST)).toBe('Claude');
  });
  it('referrer yoksa utm_source ile tanır', () => {
    expect(resolveSource(undefined, 'chatgpt.com', 'Chrome', HOST)).toBe('ChatGPT');
    expect(resolveSource(undefined, 'threads', 'Safari', HOST)).toBe('Threads');
  });
  it('referrer ve utm yoksa uygulama içi tarayıcıdan tanır', () => {
    expect(resolveSource(undefined, undefined, 'Instagram (uygulama içi)', HOST)).toBe('Instagram');
    expect(resolveSource(undefined, undefined, 'Facebook (uygulama içi)', HOST)).toBe('Facebook');
    expect(resolveSource(undefined, undefined, 'TikTok (uygulama içi)', HOST)).toBe('TikTok');
  });
  it('hiçbiri yoksa Doğrudan; bilinmeyen utm de Doğrudan kalır (kampanya ayrıca sayılır)', () => {
    expect(resolveSource(undefined, undefined, 'Chrome', HOST)).toBe('Doğrudan');
    expect(resolveSource(undefined, 'kis-kampanyasi', 'Chrome', HOST)).toBe('Doğrudan');
  });
});

describe('sourceLabel ve sourceGroup', () => {
  it('eski kayıtlardaki ham alan adlarını ve utm anahtarlarını adlandırır', () => {
    expect(sourceLabel('chatgpt.com')).toBe('ChatGPT');
    expect(sourceLabel('chatgpt_com')).toBe('ChatGPT');
    expect(sourceLabel('claude.ai')).toBe('Claude');
    expect(sourceLabel('perplexity_ai')).toBe('Perplexity');
    expect(sourceLabel('instagram')).toBe('Instagram');
    expect(sourceLabel('Google')).toBe('Google');
    expect(sourceLabel('ornek-site.com')).toBe('ornek-site.com');
  });
  it('kaynakları gruplar', () => {
    expect(sourceGroup('Doğrudan')).toBe('Doğrudan');
    expect(sourceGroup('Google')).toBe('Arama motoru');
    expect(sourceGroup('Threads')).toBe('Sosyal medya');
    for (const ai of AI_SOURCES) expect(sourceGroup(ai)).toBe('Yapay zeka');
    expect(sourceGroup('ornek-site.com')).toBe('Diğer siteler');
  });
});

describe('buildPatch — kaynak ve tekil ürün görüntüleme', () => {
  const ctx = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0', ownHost: HOST, hour: 12 };

  it('uygulama içi Instagram ziyareti Doğrudan değil Instagram sayılır', () => {
    const p = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/', n: 1 }, ctx) as Record<string, Record<string, number>>;
    expect(p.ref).toEqual({ Instagram: 1 });
  });

  it('tekil ürün görüntülemesi yalnızca pu işaretliyse sayılır', () => {
    const first = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/urun/masa-1', n: 2, pu: true }, ctx) as Record<string, Record<string, number>>;
    const again = buildPatch({ t: 'pv', vid: 'abcdefgh1', path: '/urun/masa-1', n: 3 }, ctx) as Record<string, Record<string, number>>;
    expect(first.prod).toEqual({ 'masa-1': 1 });
    expect(first.prodU).toEqual({ 'masa-1': 1 });
    expect(again.prod).toEqual({ 'masa-1': 1 });
    expect(again.prodU).toBeUndefined();
  });
});
