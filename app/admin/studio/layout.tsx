// Elle "hemen çalıştır": sahneler sırayla üretilir (sağlayıcı + Cloudinary yükleme) → uzun sunucu action süresi.
export const maxDuration = 300;

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
