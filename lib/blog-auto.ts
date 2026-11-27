import 'server-only';

// Blog otomasyonu (cron tarafından çağrılır): planlı yazıyı yayınlar; açıksa kuyruk azalınca yeni taslak üretir.
//  - Yayın sıklığı: lib/blog-cadence.ts (günde en fazla 2, aralarında en az 4 saat, TSİ 07:00'den sonra).
//  - Konu: lib/blog-topics.ts (özel gün yaklaşıyorsa o gün öne alınır, yoksa sabit/kategori/anahtar kelime konuları).
//  - Üretim: GEMINI_API_KEY varsa Gemini, yoksa şablon (lib/blog-draft.ts). Ürün verisi kodla eklenir.
//  - Ortam: cron yalnız BLOG_AUTO_GENERATE=1 ise taslak üretir (varsayılan kapalı; admin'deki elle üretim hep açık).
//    BLOG_AUTO_PUBLISH=0 üretilen taslakları planlamaz (admin onayı bekler).
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { listPosts, savePost, type PostInput } from './posts';
import { runScheduledPublish } from './post-schedule';
import { getProductsServer } from './products-server';
import { getSeoSettings } from './seo-store';
import { notifyAdmin } from './notify';
import { SITE_URL } from './site';
import { geminiConfigured, generateWithGemini } from './blog-llm';
import { findTopic, pickNextTopic } from './blog-topics';
import { buildLlmPrompt, buildTemplateDraft, makeSlug, parseLlmDraft, pickProductsForTopic, type BlogDraft } from './blog-draft';
import {
  BLOG_GRACE_MS, BLOG_QUEUE_MIN, blogAutoGenerateEnabled, blogGenDue, blogSlotDue, nextAutoSlot, nextBlogState,
  type BlogStepState,
} from './blog-cadence';
import { trDayKey } from './tr-time';
import type { Post } from './posts-types';

const stateRef = () => adminDb.collection('settings').doc('blog_state');

interface BlogState extends BlogStepState {
  genDay?: string; // son üretim denemesinin TSİ günü
  usedTopics?: string[];
  lastGenAt?: number;
  lastGenSlug?: string;
  lastGenSource?: string;
  lastError?: string;
}

const isQueued = (p: Post) => !p.published && (p.scheduledAt ?? 0) > 0;
const byScheduled = (a: Post, b: Post) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0);
const earliest = (posts: Post[]) => posts.reduce((m, p) => (m === 0 || (p.scheduledAt ?? 0) < m ? p.scheduledAt ?? 0 : m), 0);

export interface GeneratedDraft {
  post: Post;
  topicId: string;
  source: BlogDraft['source'];
  urgent: boolean;
  scheduledAt?: number;
}

/**
 * Sıradaki konudan (ya da `topicId` ile seçilen konudan) bir taslak üretip kaydeder.
 * Planlama açıksa (varsayılan) taslak yayın takvimine eklenir. Konu kalmadıysa null.
 */
export async function generateBlogDraft(opts: { now?: number; existing?: Post[]; topicId?: string; state?: BlogState } = {}): Promise<GeneratedDraft | null> {
  const now = opts.now ?? Date.now();
  const [seo, existing, stateSnap] = await Promise.all([
    getSeoSettings(),
    opts.existing ? Promise.resolve(opts.existing) : listPosts(false),
    opts.state ? Promise.resolve(null) : stateRef().get(),
  ]);
  const state = opts.state ?? ((stateSnap?.data() ?? {}) as BlogState);
  const usedIds = state.usedTopics ?? [];

  const picked = opts.topicId
    ? (() => { const t = findTopic(opts.topicId!, now, seo.keywordTargets); return t ? { topic: t, urgent: false } : null; })()
    : pickNextTopic(now, { usedIds, keywordTargets: seo.keywordTargets });
  if (!picked) return null;
  const { topic, urgent } = picked;

  const products = pickProductsForTopic(topic, await getProductsServer(), 4);

  let draft: BlogDraft | null = null;
  if (geminiConfigured()) {
    const raw = await generateWithGemini(buildLlmPrompt(topic, products, seo.keywordTargets.slice(0, 4)));
    draft = raw ? parseLlmDraft(raw, topic, products) : null;
  }
  if (!draft) draft = buildTemplateDraft(topic, products);

  const slug = makeSlug(topic.kind === 'occasion' ? topic.title : draft.title, existing.map((p) => p.slug));
  const autoPublish = process.env.BLOG_AUTO_PUBLISH !== '0';
  const lastScheduled = existing.filter(isQueued).reduce((m, p) => Math.max(m, p.scheduledAt ?? 0), 0);
  const scheduledAt = autoPublish ? nextAutoSlot(now, lastScheduled, urgent) : undefined;

  const input: PostInput = {
    slug,
    title: draft.title,
    excerpt: draft.excerpt,
    content: draft.content,
    ...(draft.coverImage ? { coverImage: draft.coverImage } : {}),
    tags: draft.tags,
    faq: draft.faq,
    productIds: draft.productIds,
    categories: draft.categories,
    published: false,
    ...(scheduledAt ? { scheduledAt } : {}),
    auto: true,
  };
  const id = await savePost(input);
  await stateRef().set(
    {
      usedTopics: FieldValue.arrayUnion(topic.id),
      lastGenAt: now,
      lastGenSlug: slug,
      lastGenSource: draft.source,
      lastError: FieldValue.delete(),
    },
    { merge: true },
  );
  await notifyAdmin(
    'Yeni blog taslağı hazırlandı',
    `${draft.title}\n${scheduledAt ? `Planlı yayın: ${new Date(scheduledAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : 'Taslak olarak bekliyor (admin onayı gerekli)'}\n${SITE_URL}/admin/blog/${id}\nKaynak: ${draft.source === 'gemini' ? 'Gemini' : 'şablon'}${urgent ? ' · özel gün öncelikli' : ''}`,
  );

  const now2 = Date.now();
  return {
    post: { id, ...input, publishedAt: 0, updatedAt: now2 } as Post,
    topicId: topic.id,
    source: draft.source,
    urgent,
    scheduledAt,
  };
}

/**
 * Cron turu: planlı yazıyı yayınlar (sıklık kuralı izin verirse). Otomatik üretim açıksa ayrıca günde bir kez
 * kuyruğa bakıp kuyruk BLOG_QUEUE_MIN'den azsa yeni taslak üretir. Koleksiyon yalnızca bu iki işten biri
 * gerekliyse okunur.
 */
export async function runBlogStep(now = Date.now()): Promise<{ ran: boolean; reason?: string; slug?: string }> {
  const snap = await stateRef().get();
  const d = (snap.data() ?? {}) as BlogState;
  const s: BlogStepState = { blogDay: d.blogDay, blogCount: d.blogCount, blogLastAt: d.blogLastAt, blogNextAt: d.blogNextAt };

  const slotDue = blogSlotDue(now, s);
  const genDue = blogAutoGenerateEnabled() && blogGenDue(now, d.genDay);
  if (!slotDue && !genDue) return { ran: false, reason: 'günlük blog kotası dolu, saat erken ya da sıradaki yazının vakti gelmedi' };

  const all = await listPosts(false);
  const queue = all.filter(isQueued).sort(byScheduled);

  let publishedSlug: string | undefined;
  let remaining = queue;
  if (slotDue) {
    const res = await runScheduledPublish(now, queue); // yayın hatası burada fırlar: durum yazılmaz, sonraki turda tekrar denenir
    if (res.slug) {
      publishedSlug = res.slug;
      remaining = queue.filter((p) => p.slug !== res.slug);
    }
  }

  let generated: GeneratedDraft | null = null;
  if (genDue) {
    // Önce işaretle: üretim hata verse bile günde tek deneme (LLM/kota israfı olmasın).
    await stateRef().set({ genDay: trDayKey(now) }, { merge: true });
    if (remaining.length < BLOG_QUEUE_MIN) {
      try {
        generated = await generateBlogDraft({ now, existing: all, state: { ...d, genDay: trDayKey(now) } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[blog-auto] taslak üretilemedi:', err);
        await stateRef().set({ lastError: msg.slice(0, 300) }, { merge: true }).catch(() => undefined);
        await notifyAdmin('Blog taslağı üretilemedi', msg.slice(0, 300));
      }
      // Acil (özel gün) taslak bu turda yayına girebiliyorsa beklemeden yayınla
      if (generated?.scheduledAt && slotDue && !publishedSlug && generated.scheduledAt <= now + BLOG_GRACE_MS) {
        const res = await runScheduledPublish(now, [generated.post]);
        if (res.slug) { publishedSlug = res.slug; generated = { ...generated, scheduledAt: undefined }; }
      }
    }
  }

  // Sıradaki planlı yazı tarihi (yayınlanan çıkar, yeni üretilen varsa ekle)
  const pending = generated?.scheduledAt ? [...remaining, { ...generated.post, scheduledAt: generated.scheduledAt }] : remaining;
  const nextAt = earliest(pending);
  if (slotDue) await stateRef().set(nextBlogState(now, s, !!publishedSlug, nextAt), { merge: true });
  else if (generated) await stateRef().set({ blogNextAt: nextAt }, { merge: true });

  const slug = publishedSlug ?? generated?.post.slug;
  if (slug) return { ran: true, slug };
  return { ran: false, reason: genDue && !generated ? 'kuyruk yeterli ya da üretilecek konu kalmadı' : 'vakti gelen planlı yazı yok' };
}

export interface BlogAutoStatus {
  geminiConfigured: boolean;
  autoGenerate: boolean;
  autoPublish: boolean;
  lastGenAt?: number;
  lastGenSlug?: string;
  lastGenSource?: string;
  lastError?: string;
  usedTopics: number;
  nextTopic?: { title: string; urgent: boolean };
}

/** Admin paneli için otomasyon özeti (tek belge + SEO ayarı okur). */
export async function getBlogAutoStatus(now = Date.now()): Promise<BlogAutoStatus> {
  const [snap, seo] = await Promise.all([stateRef().get(), getSeoSettings()]);
  const d = (snap.data() ?? {}) as BlogState;
  const next = pickNextTopic(now, { usedIds: d.usedTopics ?? [], keywordTargets: seo.keywordTargets });
  return {
    geminiConfigured: geminiConfigured(),
    autoGenerate: blogAutoGenerateEnabled(),
    autoPublish: process.env.BLOG_AUTO_PUBLISH !== '0',
    lastGenAt: d.lastGenAt,
    lastGenSlug: d.lastGenSlug,
    lastGenSource: d.lastGenSource,
    lastError: d.lastError,
    usedTopics: d.usedTopics?.length ?? 0,
    nextTopic: next ? { title: next.topic.title, urgent: next.urgent } : undefined,
  };
}
