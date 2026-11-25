// Küçük ve güvenli Markdown → HTML dönüştürücü (yeni bağımlılık yok).
// Önce tüm HTML kaçışlanır; sonra yalnızca bilinen sözdizimi etiketlenir.
import { cloudinaryUrl } from './format';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')) || u.startsWith('#') || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
  return null;
}

function imgSrc(url: string): string | null {
  const u = url.trim();
  if (/^karta-baski\/[A-Za-z0-9_\-/]+$/.test(u)) return cloudinaryUrl(u, 'f_auto,q_auto,w_1200,c_limit');
  if (u.startsWith(`https://res.cloudinary.com/${CLOUD_NAME}/`)) return u;
  return null;
}

function inline(text: string): string {
  let t = esc(text);
  // görsel: ![alt](src)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => {
    const s = imgSrc(src);
    return s ? `<img src="${s}" alt="${alt}" loading="lazy" />` : m;
  });
  // bağlantı: [metin](url)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const u = safeUrl(href);
    if (!u) return m;
    const ext = /^https?:\/\//i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${u}"${ext}>${label}</a>`;
  });
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return t;
}

export function slugifyHeading(s: string): string {
  return s
    .replace(/İ/g, 'i') // toLowerCase "İ"yi i + birleşik nokta yapar; önce düzelt
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => {
    if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; }
  };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }

    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      flushAll();
      const level = Math.min(Math.max(h[1].length, 2), 4); // sayfa H1'i başlık için ayrılmış
      out.push(`<h${level} id="${slugifyHeading(h[2])}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) { flushAll(); out.push('<hr />'); continue; }

    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara(); flushQuote();
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul ?? ol)![1]);
      continue;
    }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

/** İçindeki ## başlıklarından içindekiler listesi */
export function extractHeadings(md: string): { id: string; text: string }[] {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.match(/^##\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ id: slugifyHeading(m[1]), text: m[1].replace(/[*`]/g, '') }));
}
