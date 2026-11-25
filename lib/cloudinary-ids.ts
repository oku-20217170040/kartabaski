// Cloudinary public_id doğrulaması: yalnızca güvenli karakterler, URL/yol kaçışı yok.
const PUBLIC_ID_RE = /^[A-Za-z0-9_\-/.]{1,200}$/;

export function sanitizePublicIds(input: unknown, max = 30): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((id): id is string => typeof id === 'string' && PUBLIC_ID_RE.test(id) && !id.includes('..') && !id.startsWith('/'))
    .slice(0, max);
}
