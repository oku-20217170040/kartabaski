// Ürün fotoğraflarına SEO dostu Cloudinary adı üretmek için saf yardımcılar (testli).
// Yükleme sırasında Cloudinary rastgele ad verir; ürün kaydedilirken ürün adından (slug) türeyen ad verilir.

export const PRODUCT_IMAGE_FOLDER = 'karta-baski/urunler';
export const IMAGE_BRAND = 'karta-baski';
const SLUG_MAX = 60;

const baseName = (publicId: string) => publicId.slice(publicId.lastIndexOf('/') + 1);

/** Yeniden adlandırılabilir mi: ürün klasöründe ve henüz "karta-baski-" önekli ad almamış (rastgele adlı) bir görsel. */
export function canRenameImage(publicId: string): boolean {
  if (!publicId.startsWith(`${PRODUCT_IMAGE_FOLDER}/`)) return false;
  const name = baseName(publicId);
  return name.length > 0 && !name.startsWith(`${IMAGE_BRAND}-`);
}

/** Ad parçası: küçük harf, Türkçe karakterler sadeleşir, yalnızca a-z 0-9 ve tire, en fazla 60 karakter. */
export function slugPart(s: string): string {
  const cleaned = s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, SLUG_MAX).replace(/-+$/g, '');
}

/**
 * Yeni Cloudinary kimliği: karta-baski/urunler/karta-baski-{urun-adi}-{sira}-{kisa-kod}
 * Kısa kod eski rastgele adın ilk 4 harfi/rakamıdır; aynı adlı ürünlerde çakışmayı önler.
 */
export function seoImageName(slug: string, index1: number, oldPublicId: string): string {
  const base = slugPart(slug) || 'urun';
  const suffix = (baseName(oldPublicId).toLowerCase().replace(/[^a-z0-9]/g, '') + 'xxxx').slice(0, 4);
  return `${PRODUCT_IMAGE_FOLDER}/${IMAGE_BRAND}-${base}-${index1}-${suffix}`;
}
