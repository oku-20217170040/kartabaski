// Planlayıcı: önümüzdeki günlerin boş saatlerini doldurur (testli, saf).
import type { SocialPlatform } from '../social-types';
import { TR_OFFSET_MS } from '../tr-time';
import { carouselCandidates, carouselKey, colorImages, groupKey, mixImages, storyPick, type Beyaz } from './sira';
import { slotTimes, isMissed } from './zaman';
import { MAX_DENEME, UFUK_GUN, type Ayar, type Hedef, type Paylasim, type PaylasimDurum, type PaylasimUrun } from './types';

export interface PlanGirdi {
  products: PaylasimUrun[];
  items: Paylasim[];
  ayar: Ayar;
  imageUsedAt: Record<string, number>;
  white: Beyaz;
  now: number;
}
export interface PlanSonuc {
  create: Paylasim[];
  move: { key: string; at: number }[];
  cancel: string[];
  close: { key: string; status: 'kismi' | 'hata' }[]; // yarım kalıp günü geçenler
  remove: string[];
}

const stamp = (at: number) => new Date(at + TR_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');

export function planla({ products, items, ayar, imageUsedAt, white, now }: PlanGirdi): PlanSonuc {
  const out: PlanSonuc = { create: [], move: [], cancel: [], close: [], remove: [] };
  const byId = new Map(products.map((p) => [p.id, p]));
  const started = (p: Paylasim) => Object.values(p.targets).some((t) => t && t.attempts > 0);

  const pending: Paylasim[] = [];
  const missed: Paylasim[] = [];
  for (const it of items) {
    if (it.status !== 'bekliyor') continue;
    if (!byId.has(it.productId) && !started(it)) out.remove.push(it.key);
    else if (isMissed(it.at, now)) {
      if (started(it)) out.close.push({ key: it.key, status: Object.values(it.targets).some((t) => t?.status === 'tamam') ? 'kismi' : 'hata' });
      else if (it.kind === 'karusel') missed.push(it);
      else out.cancel.push(it.key);
    } else pending.push(it);
  }

  const taken = new Set(pending.filter((p) => p.kind === 'karusel').map((p) => p.at));
  const free = slotTimes(ayar.carouselTimes, now, UFUK_GUN).filter((t) => !taken.has(t));
  for (const it of missed.sort((a, b) => a.at - b.at)) {
    const at = free.shift();
    if (at) out.move.push({ key: it.key, at });
  }
  const used = new Set(items.filter((i) => i.kind === 'karusel' && !out.remove.includes(i.key)).map((i) => i.key));
  const queue = carouselCandidates(products, used);
  while (ayar.kinds.karusel && free.length && queue.length) {
    const { productId, color } = queue.shift()!;
    const u = byId.get(productId)!;
    const cover = ayar.covers[groupKey(productId, color)];
    out.create.push({
      key: carouselKey(productId, color), kind: 'karusel', productId, color,
      imageIds: color ? colorImages(u, color, cover, white) : mixImages(u, cover, white),
      at: free.shift()!, status: 'bekliyor', caption: '', targets: {}, createdAt: now,
    });
  }

  const stories = items.filter((i) => i.kind === 'hikaye');
  const storyKeys = new Set(stories.map((s) => s.key));
  const productUsedAt: Record<string, number> = {};
  const usedAt = { ...imageUsedAt };
  for (const s of stories) {
    if (out.remove.includes(s.key)) continue;
    productUsedAt[s.productId] = Math.max(productUsedAt[s.productId] ?? 0, s.at);
    for (const id of s.imageIds) usedAt[id] = Math.max(usedAt[id] ?? 0, s.at);
  }
  for (const at of ayar.kinds.hikaye ? slotTimes(ayar.storyTimes, now, UFUK_GUN) : []) {
    const key = `h|${stamp(at)}`;
    if (storyKeys.has(key) && !out.remove.includes(key)) continue;
    const pick = storyPick(products, usedAt, productUsedAt, white);
    if (!pick) break;
    productUsedAt[pick.productId] = at;
    usedAt[pick.imageId] = at;
    out.create.push({
      key, kind: 'hikaye', productId: pick.productId, color: '', imageIds: [pick.imageId],
      at, status: 'bekliyor', caption: '', targets: {}, createdAt: now,
    });
  }
  return out;
}

/** Sıra baştan kurulurken silinebilecekler: bekleyen ve hiçbir platforma gönderilmemiş olanlar. */
export const yenilenecekler = (items: Paylasim[]): string[] =>
  items.filter((i) => i.status === 'bekliyor' && !Object.keys(i.targets).length).map((i) => i.key);

export function durumHesapla(targets: Partial<Record<SocialPlatform, Hedef>>, platforms: SocialPlatform[]): PaylasimDurum {
  const list = platforms.map((p) => targets[p]);
  const open = list.some((t) => !t || t.status === 'gonderiliyor' || t.status === 'bekliyor' || (t.status === 'hata' && t.attempts < MAX_DENEME));
  if (open) return 'bekliyor';
  const ok = list.filter((t) => t!.status === 'tamam').length;
  const bad = list.filter((t) => t!.status === 'hata' || t!.status === 'belirsiz').length;
  if (!ok) return 'hata'; // hiçbir platforma gitmedi
  return bad ? 'kismi' : 'yayinlandi';
}
