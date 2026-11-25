// Instagram günlük planı için saf yardımcılar (Firestore/API yok → test edilebilir).
//
// Kurallar:
// - Gönderi (karusel): bir kupa modelinin tüm fotoğrafları (en fazla 10; tek fotoğraf → tekli gönderi).
// - Hikâye: tek fotoğraf; ürün adı ve fiyat bandı Cloudinary katmanıyla eklenir.
// - Özel gün yaklaşırken ilk karusel kampanya gönderisine dönüşür (birkaç modelin kapağı).
// - Yeni blog yazısı için ayrı bir "blog" taslağı üretilir (kapak görseli + özet).
// - Hiçbir ürün "satıldı" olmaz: model pasife alınırsa taslak yayın anında iptal edilir.
import {
  daySlots, rankCandidates, nextWindowTime, MAX_CAROUSEL_IMAGES, type IgItem, type IgPost,
} from './instagram-utils';
import {
  isShareable, buildProductCaption, campaignCaption, pickCampaignProducts, blogCaption,
  type ActiveCampaign, type BlogLite, type SocialProductRow,
} from './social-content-utils';

export type PlanDraft = Omit<IgPost, 'id'>;

export interface PlanInput {
  day: string;
  now: number;
  rows: SocialProductRow[]; // tüm ürünler (uygunluk burada süzülür)
  recent: Map<string, number>; // productId → son paylaşım zamanı
  feedCount: number;
  storyCount: number;
  windowStart: number;
  windowEnd: number;
  campaign?: ActiveCampaign | null; // yalnızca bu tur kampanya gönderisi isteniyorsa verilir
  minLeadMs?: number;
}

const toItem = (r: SocialProductRow, imageId: string): IgItem => ({
  productId: r.id,
  title: r.title,
  priceMin: r.priceMin,
  priceMax: r.priceMax,
  imageId,
  category: r.category,
});

/** Günün taslaklarını üretir. Uygun ürün yoksa boş döner. */
export function buildPlan(i: PlanInput): PlanDraft[] {
  const cands = i.rows.filter(isShareable);
  if (!cands.length) return [];
  const ranked = rankCandidates(cands, i.recent, i.day);
  const slots = daySlots(i.day, i.now, {
    feedCount: i.feedCount, storyCount: i.storyCount, windowStart: i.windowStart, windowEnd: i.windowEnd, minLeadMs: i.minLeadMs,
  });
  const used = new Set<string>();
  let storyPool = ranked;
  let campaignLeft = i.campaign ?? null;
  const out: PlanDraft[] = [];
  const base = { status: 'taslak' as const, createdAt: i.now, day: i.day };

  for (const slot of slots) {
    if (slot.kind === 'carousel') {
      if (campaignLeft) {
        const picks = pickCampaignProducts(cands, campaignLeft.campaign, 5);
        if (picks.length >= 2) {
          picks.forEach((p) => used.add(p.id));
          out.push({
            ...base, kind: 'carousel', publishAt: slot.at, theme: campaignLeft.key,
            items: picks.map((p) => toItem(p, p.imageIds[0])),
            caption: campaignCaption(campaignLeft, picks, 'instagram'),
          });
          campaignLeft = null;
          continue;
        }
      }
      // Çok fotoğraflı ve yakın zamanda kullanılmamış model öncelikli
      const cand = ranked.find((c) => !used.has(c.id) && c.imageIds.length > 1) ?? ranked.find((c) => !used.has(c.id)) ?? ranked[0];
      used.add(cand.id);
      out.push({
        ...base, kind: 'carousel', publishAt: slot.at,
        items: cand.imageIds.slice(0, MAX_CAROUSEL_IMAGES).map((img) => toItem(cand, img)),
        caption: buildProductCaption(cand, 'instagram'),
      });
    } else {
      const next = storyPool.find((c) => !used.has(c.id)) ?? storyPool[0];
      used.add(next.id);
      storyPool = storyPool.filter((c) => c.id !== next.id);
      if (!storyPool.length) storyPool = ranked;
      out.push({ ...base, kind: 'story', publishAt: slot.at, items: [toItem(next, next.imageIds[0])], caption: '' });
    }
  }
  return out;
}

/** Yeni blog yazısı için tek görselli taslak. `fallbackImage`: yazının kapağı yoksa kullanılacak ürün görseli. */
export function buildBlogDraft(
  post: BlogLite,
  o: { now: number; day: string; windowStart: number; windowEnd: number; leadMs: number; fallbackImage?: string }
): PlanDraft | null {
  const imageId = post.coverImage || o.fallbackImage;
  if (!imageId || imageId.startsWith('http')) return null;
  const publishAt = nextWindowTime(o.now, o.leadMs, o.windowStart, o.windowEnd);
  return {
    kind: 'blog', status: 'taslak', publishAt, createdAt: o.now, day: o.day, refId: post.id,
    items: [{ productId: `blog:${post.id}`, title: post.title, priceMin: 0, priceMax: 0, imageId, category: 'Blog' }],
    caption: blogCaption(post, 'instagram'),
  };
}

/** Taslak kuyruğu özeti (panel sayaçları). */
export function summarize(posts: Pick<IgPost, 'status' | 'kind'>[]) {
  const s = { draft: 0, published: 0, failed: 0, stories: 0, feeds: 0 };
  for (const p of posts) {
    if (p.status === 'taslak') s.draft++;
    else if (p.status === 'yayinlandi') s.published++;
    else if (p.status === 'hata') s.failed++;
    if (p.kind === 'story') s.stories++; else s.feeds++;
  }
  return s;
}
