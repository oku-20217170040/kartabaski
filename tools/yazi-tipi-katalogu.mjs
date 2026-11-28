// Tasarım ekranının yazı tipi listesini üretir: lib/tasarim/yazi-tipleri.json
// Kaynak: Fontsource (açık lisanslı aileler). Her ailenin dosyası indirilip karakter tablosu
// okunur; Türkçe harflerin tamamı olmayan aile listeye girmez.
// Kullanım: node tools/yazi-tipi-katalogu.mjs   (yalnız liste yenilenecekse; çıktı git'e girer)
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const OUT = path.join(process.cwd(), 'lib', 'tasarim', 'yazi-tipleri.json');
const CATEGORIES = { 'sans-serif': 's', serif: 'r', display: 'd', handwriting: 'h', monospace: 'm' };
/** Yazı yazmaya yaramayan aileler (barkod, karartma, çizgi grafik). */
const SKIP = /^(libre barcode|redacted|flow |linefont|wavefont|adobe blank|yakuhan|material |noto (sans|serif) (symbols|math|signwriting))/i;
const REQUIRED = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?\'-&ÇçĞğİıÖöŞşÜü'].map((c) => c.codePointAt(0));
const CONCURRENCY = 24;

const fileUrl = (id, subset, weight) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${id}@5/files/${id}-${subset}-${weight}-normal.woff2`;

async function download(url, tries = 4) {
  for (let i = 0; ; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (i >= tries) throw error;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

/** WOFF2 içinden `cmap` tablosunu çıkarır (cmap dönüştürülmeden saklanır). */
function cmapOf(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('woff2 değil');
  const count = buf.readUInt16BE(12);
  const compressed = buf.readUInt32BE(20);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i += 1) {
      const byte = buf[at++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('bozuk uzunluk');
  };
  const tables = [];
  for (let i = 0; i < count; i += 1) {
    const flags = buf[at++];
    const index = flags & 0x3f;
    const version = flags >> 6;
    let tag = index === 0 ? 'cmap' : index === 10 ? 'glyf' : index === 11 ? 'loca' : String(index);
    if (index === 63) { tag = buf.toString('latin1', at, at + 4); at += 4; }
    const original = base128();
    // glyf ve loca'da 0 = dönüştürülmüş; diğer tablolarda 0 = olduğu gibi.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : original });
  }
  const data = brotliDecompressSync(buf.subarray(at, at + compressed));
  let offset = 0;
  for (const t of tables) {
    if (t.tag === 'cmap') return data.subarray(offset, offset + t.length);
    offset += t.length;
  }
  throw new Error('cmap yok');
}

/** Tabloda karşılığı olan istenen karakterler. */
function coveredBy(cmap, wanted) {
  const found = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i += 1) {
    const start = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(start);
    if (format === 4) {
      const segments = cmap.readUInt16BE(start + 6) / 2;
      const ends = start + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (const code of wanted) {
        for (let s = 0; s < segments; s += 1) {
          if (code > cmap.readUInt16BE(ends + s * 2)) continue;
          const first = cmap.readUInt16BE(starts + s * 2);
          if (code < first) break;
          const delta = cmap.readUInt16BE(deltas + s * 2);
          const range = cmap.readUInt16BE(ranges + s * 2);
          let glyph = (code + delta) & 0xffff;
          if (range) {
            const where = ranges + s * 2 + range + (code - first) * 2;
            const raw = where + 1 < cmap.length ? cmap.readUInt16BE(where) : 0;
            glyph = raw ? (raw + delta) & 0xffff : 0;
          }
          if (glyph) found.add(code);
          break;
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(start + 12);
      for (let g = 0; g < groups; g += 1) {
        const at = start + 16 + g * 12;
        const from = cmap.readUInt32BE(at);
        const to = cmap.readUInt32BE(at + 4);
        for (const code of wanted) if (code >= from && code <= to) found.add(code);
      }
    }
  }
  return found;
}

/** Normal ve kalın ağırlık: baskıda ince çizgi silik çıktığı için 400 varsa 400, yoksa en yakını. */
function weights(list) {
  const normal = list.includes(400) ? 400 : [...list].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400))[0];
  const bold = [700, 800, 600, 900].find((w) => w > normal && list.includes(w));
  return { normal, bold };
}

const list = await (await fetch('https://api.fontsource.org/v1/fonts')).json();
const candidates = list.filter((f) => CATEGORIES[f.category] && f.subsets.includes('latin') && f.subsets.includes('latin-ext')
  && f.defSubset === 'latin' && f.styles.includes('normal') && !SKIP.test(f.family) && /^[a-z0-9-]{1,60}$/.test(f.id));
console.log(`${list.length} aileden ${candidates.length} aday`);

const kept = [];
const rejected = [];
let next = 0;
let done = 0;
async function worker() {
  while (next < candidates.length) {
    const f = candidates[next++];
    const { normal, bold } = weights(f.weights);
    try {
      const files = await Promise.all(['latin', 'latin-ext'].map((s) => download(fileUrl(f.id, s, normal))));
      if (files.some((x) => !x)) rejected.push([f.id, 'dosya yok']);
      else {
        const found = new Set(files.flatMap((x) => [...coveredBy(cmapOf(x), REQUIRED)]));
        const missing = REQUIRED.filter((c) => !found.has(c));
        if (missing.length) rejected.push([f.id, `eksik: ${String.fromCodePoint(...missing).slice(0, 20)}`]);
        else {
          kept.push({
            id: f.id, ad: f.family, k: CATEGORIES[f.category], n: normal,
            ...(bold ? { b: bold } : {}), ...(f.styles.includes('italic') ? { i: 1 } : {}),
          });
        }
      }
    } catch (error) {
      rejected.push([f.id, String(error.message ?? error)]);
    }
    done += 1;
    if (done % 200 === 0) console.log(`${done}/${candidates.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

kept.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `[\n${kept.map((f) => JSON.stringify(f)).join(',\n')}\n]\n`);
console.log(`yazıldı: ${kept.length} aile → ${OUT}`);
console.log(`elenen: ${rejected.length}`);
for (const [id, why] of rejected.slice(0, 60)) console.log(` - ${id}: ${why}`);
