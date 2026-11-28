// Tasarım ekranının süs çizimlerini node_modules'taki açık lisanslı setlerden public/suslar altına yazar:
// ph = Phosphor (MIT, tek renk, boyanabilir), fl = Fluent Emoji Flat (MIT, renkli).
// `npm run dev` ve `npm run build` öncesinde çalışır; çıktılar git'e girmez.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const load = (pkg, file) => JSON.parse(readFileSync(path.join(process.cwd(), 'node_modules', '@iconify-json', pkg, file), 'utf8'));
const out = path.join(process.cwd(), 'public', 'suslar');
const SKIN_TONE = /-(light|medium-light|medium|medium-dark|dark)$/;

function write(set, data, names) {
  const dir = path.join(out, set);
  mkdirSync(dir, { recursive: true });
  for (const [file, name] of names) {
    const icon = data.icons[name];
    const width = icon.width ?? data.width ?? 16;
    const height = icon.height ?? data.height ?? 16;
    writeFileSync(path.join(dir, `${file}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${width} ${height}" width="1024" height="1024">${icon.body}</svg>`);
  }
}

rmSync(out, { recursive: true, force: true });

const ph = load('ph', 'icons.json');
// Marka logoları baskıya sunulmaz.
const phNames = Object.keys(ph.icons)
  .filter((n) => n.endsWith('-fill') && !n.includes('-logo'))
  .map((n) => [n.slice(0, -'-fill'.length), n])
  .sort(([a], [b]) => a.localeCompare(b, 'en'));
write('ph', ph, phNames);

const fl = load('fluent-emoji-flat', 'icons.json');
const { categories } = load('fluent-emoji-flat', 'metadata.json');
const usable = (n) => fl.icons[n] && !SKIN_TONE.test(n);
const grouped = Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.filter(usable)]).filter(([, v]) => v.length));
write('fl', fl, [...new Set(Object.values(grouped).flat())].map((n) => [n, n]));

writeFileSync(path.join(out, 'liste.json'), JSON.stringify({ ph: phNames.map(([n]) => n), fl: grouped }));
console.log(`süsler: ${phNames.length} tek renk, ${new Set(Object.values(grouped).flat()).size} renkli`);
