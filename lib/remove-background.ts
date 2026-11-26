/**
 * Fotoğrafın arka planını tarayıcıda siler (U-2-Net küçük model, Apache-2.0, ~4,6 MB).
 * Fotoğraf hiçbir sunucuya gönderilmez. Model ve çalışma dosyaları ilk kullanımda indirilir.
 */

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MAX_SIDE = 1600;

interface OrtTensor { data: Float32Array }
interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create: (url: string) => Promise<OrtSession> };
}

declare global {
  interface Window { ort?: Ort }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => { el.remove(); reject(new Error('Arka plan silme aracı indirilemedi.')); };
    document.head.appendChild(el);
  });
}

let sessionPromise: Promise<{ ort: Ort; session: OrtSession }> | null = null;

function getSession() {
  sessionPromise ??= (async () => {
    // public/ort dosyaları derlemeden önce tools/copy-ort.mjs ile node_modules'tan kopyalanır.
    if (!window.ort) await loadScript('/ort/ort.wasm.min.js');
    const ort = window.ort;
    if (!ort) throw new Error('Arka plan silme aracı başlatılamadı.');
    ort.env.wasm.wasmPaths = '/ort/';
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create('/models/u2netp.onnx');
    return { ort, session };
  })();
  sessionPromise.catch(() => { sessionPromise = null; });
  return sessionPromise;
}

/** RGBA pikselleri modelin beklediği NCHW girdiye çevirir. */
export function toModelInput(rgba: Uint8ClampedArray, size = SIZE): Float32Array {
  let max = 1;
  for (let i = 0; i < rgba.length; i += 4) max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  const pixels = size * size;
  const out = new Float32Array(pixels * 3);
  for (let p = 0; p < pixels; p += 1) {
    for (let c = 0; c < 3; c += 1) out[c * pixels + p] = (rgba[p * 4 + c] / max - MEAN[c]) / STD[c];
  }
  return out;
}

/** Model çıktısını 0–255 saydamlığa çevirir; zayıf kalıntıları siler, kenarı toparlar. */
export function toAlpha(raw: Float32Array): Uint8ClampedArray {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i += 1) { min = Math.min(min, raw[i]); max = Math.max(max, raw[i]); }
  const range = max - min || 1;
  const out = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const v = (raw[i] - min) / range;
    const t = Math.min(1, Math.max(0, (v - 0.12) / 0.76));
    out[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return out;
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Tarayıcı görseli işleyemedi.');
  return { canvas, ctx };
}

export async function removeBackground(photo: HTMLImageElement): Promise<HTMLImageElement> {
  const { ort, session } = await getSession();

  const small = canvasOf(SIZE, SIZE);
  small.ctx.fillStyle = '#fff';
  small.ctx.fillRect(0, 0, SIZE, SIZE);
  small.ctx.drawImage(photo, 0, 0, SIZE, SIZE);
  const input = toModelInput(small.ctx.getImageData(0, 0, SIZE, SIZE).data);

  const result = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const alpha = toAlpha(result[session.outputNames[0]].data);

  const maskImage = small.ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < alpha.length; i += 1) maskImage.data[i * 4 + 3] = alpha[i];
  small.ctx.putImageData(maskImage, 0, 0);

  const scale = Math.min(1, MAX_SIDE / Math.max(photo.naturalWidth, photo.naturalHeight));
  const full = canvasOf(Math.round(photo.naturalWidth * scale), Math.round(photo.naturalHeight * scale));
  full.ctx.drawImage(photo, 0, 0, full.canvas.width, full.canvas.height);
  // Küçük maske büyütülürken yumuşar; saydamlığı fotoğrafa uygular.
  full.ctx.globalCompositeOperation = 'destination-in';
  full.ctx.drawImage(small.canvas, 0, 0, full.canvas.width, full.canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => full.canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Arka plan silinemedi.');
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return img;
}
