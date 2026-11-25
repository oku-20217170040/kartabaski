// Tarayıcıda fotoğrafı küçültür: uzun kenar en fazla `max` px, JPEG.
// Telefon fotoğrafları 4-8 MB olabilir; yüklemeden önce yaklaşık 300 KB'a iner (Cloudinary yükü azalır).
export async function compressImage(file: File, max = 1600, quality = 0.82): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // HEIC vb. çözülemezse özgün dosya gider (sunucu doğrular)
  }
}
