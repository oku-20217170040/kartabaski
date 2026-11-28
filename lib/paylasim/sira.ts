// Görsel seçimi ve paylaşım sırası (testli, saf).
import { KARUSEL_MAX, type PaylasimUrun } from './types';

export type Beyaz = Record<string, boolean>; // true = düz beyaz zemin, false = temalı, yok = ölçülmedi

const unique = (list: string[]) => Array.from(new Set(list.filter(Boolean)));
const safe = (s: string) => s.replace(/\//g, '-');

export const productImages = (u: PaylasimUrun): string[] => unique([...u.images, ...u.colors.flatMap((c) => c.images)]);
export const groupKey = (productId: string, color: string) => (color ? `${productId}:${color}` : productId);
export const carouselKey = (productId: string, color: string) =>
  color ? `k|${productId}|r|${safe(color)}` : `k|${productId}|mix`;

function pickCover(ids: string[], cover: string | undefined, white: Beyaz): string | undefined {
  if (cover && ids.includes(cover)) return cover;
  return ids.find((id) => white[id] === false) ?? ids[0];
}

export function mixImages(u: PaylasimUrun, cover: string | undefined, white: Beyaz, max = KARUSEL_MAX): string[] {
  const first = pickCover(productImages(u), cover, white);
  if (!first) return [];
  const groups = u.colors.some((c) => c.images.length) ? u.colors.map((c) => c.images) : [u.images];
  const out = [first];
  for (let i = 0; out.length < max && groups.some((g) => i < g.length); i++) {
    for (const g of groups) {
      if (out.length < max && g[i] && !out.includes(g[i])) out.push(g[i]);
    }
  }
  return out;
}

export function colorImages(u: PaylasimUrun, color: string, cover: string | undefined, white: Beyaz, max = KARUSEL_MAX): string[] {
  const ids = unique(u.colors.find((c) => c.name === color)?.images ?? []);
  const first = pickCover(ids, cover, white);
  return first ? [first, ...ids.filter((x) => x !== first)].slice(0, max) : [];
}

export interface Aday { productId: string; color: string }

export function carouselCandidates(products: PaylasimUrun[], used: Set<string>): Aday[] {
  const sorted = [...products].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  const mix = sorted
    .filter((u) => productImages(u).length && !used.has(carouselKey(u.id, '')))
    .map((u) => ({ productId: u.id, color: '' }));
  const lists = sorted.map((u) =>
    u.colors
      .filter((c) => c.images.length && !used.has(carouselKey(u.id, c.name)))
      .map((c) => ({ productId: u.id, color: c.name }))
  );
  const colors: Aday[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) colors.push(l[i]);
  return [...mix, ...colors];
}

export function storyPick(
  products: PaylasimUrun[],
  imageUsedAt: Record<string, number>,
  productUsedAt: Record<string, number>,
  white: Beyaz
): { productId: string; imageId: string } | null {
  const u = products
    .filter((p) => productImages(p).length)
    .sort((a, b) => (productUsedAt[a.id] ?? 0) - (productUsedAt[b.id] ?? 0) || a.id.localeCompare(b.id))[0];
  if (!u) return null;
  const all = productImages(u);
  const themed = all.filter((id) => white[id] !== true);
  const pool = themed.length ? themed : all;
  const imageId = [...pool].sort((a, b) => (imageUsedAt[a] ?? 0) - (imageUsedAt[b] ?? 0))[0];
  return { productId: u.id, imageId };
}
