// "Düz beyaz zemin mi?" ölçümü: Cloudinary'den 32×32 BMP istenir, kenar pikselleri sayılır (bağımlılık yok).
export const whiteProbeUrl = (cloud: string, imageId: string): string =>
  `https://res.cloudinary.com/${cloud}/image/upload/c_scale,w_32,h_32,f_bmp/${imageId}`;

export function borderWhiteRatio(bytes: Uint8Array): number {
  if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error('BMP bekleniyordu');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = dv.getUint32(10, true);
  const width = dv.getInt32(18, true);
  const height = Math.abs(dv.getInt32(22, true));
  const bpp = dv.getUint16(28, true);
  if (bpp !== 24 && bpp !== 32) throw new Error(`BMP derinliği desteklenmiyor: ${bpp}`);
  const row = Math.floor((bpp * width + 31) / 32) * 4;
  let white = 0;
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      const i = offset + y * row + x * (bpp / 8);
      total++;
      if (bytes[i] >= 235 && bytes[i + 1] >= 235 && bytes[i + 2] >= 235) white++;
    }
  }
  return total ? white / total : 0;
}

export const isPlain = (bytes: Uint8Array): boolean => borderWhiteRatio(bytes) >= 0.8;
