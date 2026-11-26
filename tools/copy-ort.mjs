// Arka plan silmenin tarayıcı çalışma dosyalarını node_modules'tan public/ort altına kopyalar.
// `npm run dev` ve `npm run build` öncesinde çalışır; kopyalar git'e girmez.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const from = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
const to = path.join(process.cwd(), 'public', 'ort');

mkdirSync(to, { recursive: true });
for (const file of ['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  copyFileSync(path.join(from, file), path.join(to, file));
}
