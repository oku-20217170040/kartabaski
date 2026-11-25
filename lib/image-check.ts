/** Yüklenen görselin sosyal medya ve vitrin için kullanılabilir olup olmadığını denetleyen saf yardımcılar. */

export const MIN_IMAGE_SIDE = 300;

/** Cloudinary'nin yükleme yanıtından (width/height) görselin sorunlu olup olmadığını söyler; sorun yoksa null. */
export function uploadedImageProblem(meta: { width?: unknown; height?: unknown }): string | null {
  const w = Number(meta.width);
  const h = Number(meta.height);
  if (!(w > 0) || !(h > 0)) return 'Görselin boyutu okunamadı; dosya bozuk olabilir.';
  if (Math.min(w, h) < MIN_IMAGE_SIDE) return `Görsel çok küçük (${w}×${h}); en az ${MIN_IMAGE_SIDE} piksel olmalı.`;
  return null;
}

/** Sosyal medya akışlarının (Meta, Pinterest, Telegram) kullandığı dönüşümle görselin teslim adresi. */
export function deliveryProbeUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_jpg,q_auto,w_1080,c_limit/${publicId}`;
}
