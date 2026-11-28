# Paylaşım Sistemi Aşama 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ürün karuselleri (günde 2) ve fiyatlı hikâyeler (günde 3) tek panelden yönetilen, önizleme modunda açılan bir sistemle paylaşılsın.

**Architecture:** `lib/paylasim/` altında saf modüller (fiyat, kapak, sıra, zaman, plan, metin) ve üç sunucu modülü (depo, yayin, tur). Mevcut platform yayıncıları kullanılır; `/api/cron/main` içine tek `paylasim` adımı eklenir. `mode: 'canli'` olunca eski ürün otomasyonları susar.

**Tech Stack:** Next.js 14 App Router, Firebase Admin (Firestore), Cloudinary dönüşümleri, Jest. Yeni bağımlılık yok.

Tasarım: `docs/superpowers/specs/2026-11-28-paylasim-sistemi-design.md`. Aşama 2-4 (müşteri paylaşımı, rehber, Pinterest fotoğraf akışı) ayrı planlardır.

## Global Constraints

- Depo herkese açık: anahtar, kimlik, müşteri/kişi bilgisi, adres yazılmaz. Marka yalnız online mağaza.
- Kullanıcıya görünen metinler Türkçe, "siz" diliyle, emoji yalnız sosyal metinlerde (panelde ikon bileşeni).
- Commit mesajları Türkçe; sonu `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Saatler Türkiye saati. Varsayılan: karusel `11:00`, `18:00`; hikâye `09:00`, `14:00`, `20:00`.
- Karusel en fazla 10 görsel (Pinterest 5); hedef başına en fazla 3 deneme; TikTok 24 saatte en fazla 5 taslak.
- Varsayılan mod `onizleme`: hiçbir şey yayınlanmaz.
- Panel 360 px'te taşmaz, dokunma hedefi ≥44 px; renk için `var(--…)`, bileşende sabit hex yok.
- Testte gerçek paylaşım yapılmaz.
- `.claude/` ve `scripts/` commit edilmez.

## Tasarıma göre dört küçük değişiklik (Task 9'da belgeye işlenir)

1. `priceTiersApproved: boolean` yerine `priceTiersSource: string`: onay anındaki açıklama fiyat satırlarının özeti. Açıklama değişirse onay kendiliğinden düşer.
2. Hikâyede satır sınırı: ad + en fazla 7 kademe + kartabaski.com (bazı ürünlerde 5'ten fazla kademe var; kesilirse toplu fiyat kaybolur).
3. Aşama 1'de mevcut "Merkez" ve "Hızlı Paylaşım" ekranları kalır; Hızlı Paylaşım aşama 2'de panele taşınır.
4. "Yayınlanan" sekmesinde platform başına sonuç ve hata görünür; gönderi bağlantıları aşama 1'de yoktur.

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `lib/paylasim/types.ts` | Ortak tipler ve sabitler |
| `lib/paylasim/fiyat.ts` | Fiyat satırı ayrıştırma ve onay |
| `lib/paylasim/kapak.ts` | Düz zemin ölçümü (BMP) |
| `lib/paylasim/sira.ts` | Görsel seçimi, karusel ve hikâye sırası |
| `lib/paylasim/zaman.ts` | Yayın saatleri |
| `lib/paylasim/plan.ts` | Planlayıcı ve durum hesabı |
| `lib/paylasim/metin.ts` | Açıklamalar ve hikâye görsel adresi |
| `lib/paylasim/depo.ts` | Firestore (sunucu) |
| `lib/paylasim/yayin.ts` | Platform yayıncıları (sunucu) |
| `lib/paylasim/tur.ts` | Cron turu (sunucu) |
| `lib/actions-paylasim.ts` | Panel sunucu eylemleri |
| `app/admin/paylasim/page.tsx`, `paylasim.css` | Tek panel |

---

### Task 1: Tipler ve fiyat kademeleri

**Files:**
- Create: `lib/paylasim/types.ts`, `lib/paylasim/fiyat.ts`, `__tests__/lib/paylasim-fiyat.test.ts`
- Modify: `lib/schemas.ts` (ProductSchema), `types/index.ts` (Product)

**Interfaces:**
- Produces: aşağıdaki tipler; `parsePriceLines(description): Kademe[]`, `priceSourceKey(description): string`, `approvedTiers(p): Kademe[] | null`

- [ ] **Step 1: Tipleri yaz** — `lib/paylasim/types.ts`

```ts
import type { SocialPlatform } from '../social-types';

export type PaylasimTur = 'karusel' | 'hikaye';
export type HedefDurum = 'bekliyor' | 'gonderiliyor' | 'tamam' | 'hata' | 'atlandi' | 'belirsiz';
export interface Hedef { status: HedefDurum; attempts: number; remoteId?: string; error?: string; at?: number }
export type PaylasimDurum = 'bekliyor' | 'yayinlandi' | 'kismi' | 'hata' | 'iptal';

export interface Paylasim {
  key: string;
  kind: PaylasimTur;
  productId: string;
  color: string; // '' = karışık karusel ya da hikâye
  imageIds: string[];
  at: number;
  status: PaylasimDurum;
  caption: string; // '' = yayın anında otomatik
  targets: Partial<Record<SocialPlatform, Hedef>>;
  createdAt: number;
}

export interface Kademe { label: string; price: string }
export interface UrunRenk { name: string; images: string[] }

/** Paylaşıma uygun ürün: aktif, görselli, fiyatı onaylı. */
export interface PaylasimUrun {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc: string;
  deliveryDays: number;
  createdAt: number;
  images: string[];
  colors: UrunRenk[];
  tiers: Kademe[];
}

export interface Ayar {
  mode: 'onizleme' | 'canli';
  paused: boolean;
  platforms: Record<SocialPlatform, boolean>;
  kinds: Record<PaylasimTur, boolean>; // içerik türü aç/kapat
  carouselTimes: string[];
  storyTimes: string[];
  covers: Record<string, string>; // grup anahtarı → görsel kimliği
}

export const VARSAYILAN_AYAR: Ayar = {
  mode: 'onizleme',
  paused: false,
  platforms: { instagram: true, facebook: true, threads: true, telegram: true, pinterest: true, tiktok: true },
  kinds: { karusel: true, hikaye: true },
  carouselTimes: ['11:00', '18:00'],
  storyTimes: ['09:00', '14:00', '20:00'],
  covers: {},
};

export const PLATFORMLAR: Record<PaylasimTur, SocialPlatform[]> = {
  karusel: ['instagram', 'facebook', 'threads', 'telegram', 'pinterest', 'tiktok'],
  hikaye: ['instagram', 'facebook', 'pinterest', 'tiktok'],
};

export const KARUSEL_MAX = 10;
export const MAX_DENEME = 3;
export const UFUK_GUN = 3;
export const MAX_KADEME = 7;
```

- [ ] **Step 2: Başarısız testi yaz** — `__tests__/lib/paylasim-fiyat.test.ts`

```ts
import { approvedTiers, parsePriceLines, priceSourceKey } from '@/lib/paylasim/fiyat';

const DESC = [
  'Kişiye özel baskı.',
  '✔ Kurumsal siparişlerde en rekabetçi fiyat (85₺/adet)',
  '• Özel Tasarım: (1 adet) 300 ₺',
  '• 2’li set Tasarımlı: 400 ₺',
  "• 6'lı Set Tasarımlı (1 adet):  295₺",
  '• 6’lı set Tasarımsız: 1.150 ₺',
  '• 45 adet ve üzeri: 130₺/adet',
].join('\n');

describe('parsePriceLines', () => {
  it('kademe satırlarını yazıldığı gibi alır, slogan satırını almaz', () => {
    expect(parsePriceLines(DESC)).toEqual([
      { label: 'Özel Tasarım: (1 adet)', price: '300 ₺' },
      { label: '2’li set Tasarımlı', price: '400 ₺' },
      { label: "6'lı Set Tasarımlı (1 adet)", price: '295 ₺' },
      { label: '6’lı set Tasarımsız', price: '1.150 ₺' },
      { label: '45 adet ve üzeri', price: '130 ₺/adet' },
    ]);
  });
  it('fiyat satırı yoksa boş döner', () => {
    expect(parsePriceLines('Sade bir kupa.')).toEqual([]);
  });
});

describe('approvedTiers', () => {
  const tiers = [{ label: '1 adet', price: '300 ₺' }];
  it('onay anındaki satırlar değişmediyse kademeleri döndürür', () => {
    expect(approvedTiers({ description: DESC, priceTiers: tiers, priceTiersSource: priceSourceKey(DESC) })).toEqual(tiers);
  });
  it('açıklamadaki fiyat değişince onay düşer', () => {
    const changed = DESC.replace('300 ₺', '320 ₺');
    expect(approvedTiers({ description: changed, priceTiers: tiers, priceTiersSource: priceSourceKey(DESC) })).toBeNull();
  });
  it('kademe ya da onay yoksa null', () => {
    expect(approvedTiers({ description: DESC })).toBeNull();
    expect(approvedTiers({ description: DESC, priceTiers: [], priceTiersSource: priceSourceKey(DESC) })).toBeNull();
  });
});
```

- [ ] **Step 3:** `npx jest paylasim-fiyat` → FAIL (`Cannot find module`).

- [ ] **Step 4: Uygula** — `lib/paylasim/fiyat.ts`

```ts
// Fiyat kademeleri: açıklamadaki satırlardan öneri; yayın yalnız onaylı kademelerle (testli, saf).
import { hashStr } from '../social-content-utils';
import { MAX_KADEME, type Kademe } from './types';

const LINE = /^(.*?(?::|\)))\s*:?\s*([\d.]+(?:,\d{1,2})?)\s*(?:₺|TL)(\s*\/\s*adet)?$/i;

export function parsePriceLines(description: string): Kademe[] {
  const out: Kademe[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^[\s•✔*-]+/, '').replace(/[\\*\s]+$/, '').trim();
    const m = line.match(LINE);
    if (!m) continue;
    const label = m[1].replace(/\s*:$/, '').trim();
    if (label) out.push({ label, price: `${m[2]} ₺${m[3] ? '/adet' : ''}` });
  }
  return out.slice(0, MAX_KADEME);
}

export const priceSourceKey = (description: string): string =>
  String(hashStr(parsePriceLines(description).map((k) => `${k.label}|${k.price}`).join(';')));

export function approvedTiers(p: { description: string; priceTiers?: Kademe[]; priceTiersSource?: string }): Kademe[] | null {
  if (!p.priceTiers?.length || p.priceTiersSource !== priceSourceKey(p.description)) return null;
  return p.priceTiers.slice(0, MAX_KADEME);
}
```

- [ ] **Step 5: Ürün alanlarını ekle.** `lib/schemas.ts` içinde `seoTags` satırının altına:

```ts
  priceTiers:   z.array(z.object({ label: z.string(), price: z.string() })).optional().catch(undefined),
  priceTiersSource: z.string().optional().catch(undefined),
```

`types/index.ts` `Product` içine:

```ts
  priceTiers?: { label: string; price: string }[]; // paylaşımlarda gösterilen onaylı fiyat satırları
  priceTiersSource?: string; // onay anındaki açıklama fiyat satırlarının özeti
```

- [ ] **Step 6:** `npx jest paylasim-fiyat` → PASS. Commit: `git add lib/paylasim __tests__/lib/paylasim-fiyat.test.ts lib/schemas.ts types/index.ts` — "Paylaşım: tipler ve fiyat kademeleri".

---

### Task 2: Kapak ölçümü ve sıra

**Files:**
- Create: `lib/paylasim/kapak.ts`, `lib/paylasim/sira.ts`, `__tests__/lib/paylasim-sira.test.ts`

**Interfaces:**
- Consumes: `PaylasimUrun`, `KARUSEL_MAX`
- Produces: `whiteProbeUrl(cloud,id)`, `borderWhiteRatio(bytes): number`, `isPlain(bytes): boolean`; `type Beyaz = Record<string, boolean>`; `productImages(u)`, `groupKey(productId,color)`, `carouselKey(productId,color)`, `mixImages(u,cover,white,max?)`, `colorImages(u,color,cover,white,max?)`, `carouselCandidates(products, used: Set<string>): {productId,color}[]`, `storyPick(products, imageUsedAt, productUsedAt, white): {productId,imageId} | null`

- [ ] **Step 1: Test** — `__tests__/lib/paylasim-sira.test.ts`

```ts
import { borderWhiteRatio, isPlain } from '@/lib/paylasim/kapak';
import { carouselCandidates, carouselKey, colorImages, mixImages, storyPick } from '@/lib/paylasim/sira';
import type { PaylasimUrun } from '@/lib/paylasim/types';

/** 24 bit BMP üretir: kenar `edge`, iç `inner` gri tonu. */
function bmp(w: number, h: number, edge: number, inner: number): Uint8Array {
  const row = Math.floor((24 * w + 31) / 32) * 4;
  const b = new Uint8Array(54 + row * h);
  const dv = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d;
  dv.setUint32(10, 54, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(28, 24, true);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? edge : inner;
    b.fill(v, 54 + y * row + x * 3, 54 + y * row + x * 3 + 3);
  }
  return b;
}

const urun = (id: string, createdAt: number, colors: [string, string[]][], images: string[] = []): PaylasimUrun => ({
  id, title: id, slug: id, category: 'Lüks Kupa', shortDesc: '', deliveryDays: 3, createdAt, images,
  colors: colors.map(([name, list]) => ({ name, images: list })), tiers: [{ label: '1 adet', price: '250 ₺' }],
});

describe('kapak', () => {
  it('beyaz kenarlı görsel düz zemindir', () => {
    expect(borderWhiteRatio(bmp(8, 8, 250, 20))).toBe(1);
    expect(isPlain(bmp(8, 8, 120, 255))).toBe(false);
  });
  it('BMP olmayan veri hata verir', () => {
    expect(() => borderWhiteRatio(new Uint8Array(60))).toThrow('BMP');
  });
});

describe('görsel seçimi', () => {
  const u = urun('a', 1, [['Siyah', ['s1', 's2', 's3']], ['Mavi', ['m1', 'm2']]], ['ana']);
  it('karışık karusel temalı kapakla başlar, renkleri sırayla dolaşır, tekrar etmez', () => {
    const ids = mixImages(u, undefined, { ana: true, s1: true, s2: false }, 5);
    expect(ids).toEqual(['s2', 's1', 'm1', 'm2', 's3']);
  });
  it('elle seçilen kapak geçerlidir', () => {
    expect(colorImages(u, 'Mavi', 'm2', {})).toEqual(['m2', 'm1']);
  });
});

describe('carouselCandidates', () => {
  const a = urun('a', 1, [['Siyah', ['s1']], ['Mavi', ['m1']]]);
  const b = urun('b', 2, [['Sarı', ['y1']]]);
  it('önce karışık tur (yeni ürün başta), sonra ürünler arası dönüşümlü renk turu', () => {
    expect(carouselCandidates([a, b], new Set()).map((c) => carouselKey(c.productId, c.color))).toEqual([
      'k|b|mix', 'k|a|mix', 'k|b|r|Sarı', 'k|a|r|Siyah', 'k|a|r|Mavi',
    ]);
  });
  it('kullanılmış anahtar yeniden gelmez', () => {
    expect(carouselCandidates([b], new Set(['k|b|mix', 'k|b|r|Sarı']))).toEqual([]);
  });
});

describe('storyPick', () => {
  const a = urun('a', 1, [['Siyah', ['s1', 's2']]]);
  const b = urun('b', 2, [['Sarı', ['y1']]]);
  it('en uzun süredir paylaşılmayan ürün ve görsel', () => {
    expect(storyPick([a, b], { s1: 5 }, { b: 10, a: 1 }, {})).toEqual({ productId: 'a', imageId: 's2' });
  });
});
```

- [ ] **Step 2:** `npx jest paylasim-sira` → FAIL.

- [ ] **Step 3: Uygula** — `lib/paylasim/kapak.ts`

```ts
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
```

`lib/paylasim/sira.ts`

```ts
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
```

- [ ] **Step 4:** `npx jest paylasim-sira` → PASS. Commit "Paylaşım: kapak ölçümü ve sıra".

---

### Task 3: Zaman, planlayıcı ve durum

**Files:**
- Create: `lib/paylasim/zaman.ts`, `lib/paylasim/plan.ts`, `__tests__/lib/paylasim-plan.test.ts`

**Interfaces:**
- Produces: `slotTimes(times, now, days): number[]`, `isDue(at, now)`, `isMissed(at, now)`; `planla(input: PlanGirdi): PlanSonuc` (`{ create, move, cancel, close, remove }`); `durumHesapla(targets, platforms): PaylasimDurum`

- [ ] **Step 1: Test** — `__tests__/lib/paylasim-plan.test.ts`

```ts
import { durumHesapla, planla } from '@/lib/paylasim/plan';
import { isDue, slotTimes } from '@/lib/paylasim/zaman';
import { VARSAYILAN_AYAR, type Paylasim, type PaylasimUrun } from '@/lib/paylasim/types';
import { trTime } from '@/lib/tr-time';

const NOW = trTime('2026-11-28', 12);
const u: PaylasimUrun = {
  id: 'a', title: 'A', slug: 'a', category: 'Lüks Kupa', shortDesc: '', deliveryDays: 3, createdAt: 1, images: ['i1'],
  colors: [{ name: 'Siyah', images: ['s1'] }], tiers: [{ label: '1 adet', price: '250 ₺' }],
};
const base = { products: [u], items: [] as Paylasim[], ayar: VARSAYILAN_AYAR, imageUsedAt: {}, white: {}, now: NOW };
const item = (over: Partial<Paylasim>): Paylasim => ({
  key: 'k|a|mix', kind: 'karusel', productId: 'a', color: '', imageIds: ['i1'], at: NOW, status: 'bekliyor', caption: '', targets: {}, createdAt: 1, ...over,
});

describe('zaman', () => {
  it('yalnız gelecek saatleri verir', () => {
    expect(slotTimes(['11:00', '18:00'], NOW, 2)).toEqual([trTime('2026-11-28', 18), trTime('2026-11-29', 11), trTime('2026-11-29', 18)]);
  });
  it('vakti geçen paylaşım yalnız aynı gün içinde yayınlanır', () => {
    expect(isDue(trTime('2026-11-28', 11), NOW)).toBe(true);
    expect(isDue(trTime('2026-11-27', 18), NOW)).toBe(false);
  });
});

describe('planla', () => {
  it('karuselleri sırayla boş saatlere, hikâyeleri her saate koyar', () => {
    const r = planla(base);
    const k = r.create.filter((p) => p.kind === 'karusel');
    expect(k.map((p) => p.key)).toEqual(['k|a|mix', 'k|a|r|Siyah']);
    expect(k[0].at).toBe(trTime('2026-11-28', 18));
    expect(r.create.filter((p) => p.kind === 'hikaye')[0].key).toBe('h|2026-11-28 14:00');
  });
  it('önceki günden kalan karusel yeni saate taşınır, hikâye iptal edilir', () => {
    const old = trTime('2026-11-27', 18);
    const r = planla({ ...base, items: [item({ at: old }), item({ key: 'h|eski', kind: 'hikaye', at: old })] });
    expect(r.move).toEqual([{ key: 'k|a|mix', at: trTime('2026-11-28', 18) }]);
    expect(r.cancel).toEqual(['h|eski']);
  });
  it('yarım kalıp günü geçen paylaşım sonucuyla kapanır', () => {
    const old = item({ at: trTime('2026-11-27', 18), targets: { instagram: { status: 'tamam', attempts: 1 } } });
    expect(planla({ ...base, items: [old] }).close).toEqual([{ key: 'k|a|mix', status: 'kismi' }]);
  });
  it('uygunluğunu yitiren ürünün bekleyen paylaşımı kaldırılır', () => {
    expect(planla({ ...base, products: [], items: [item({ at: trTime('2026-11-28', 18) })] }).remove).toEqual(['k|a|mix']);
  });
  it('yayınlanmış ya da iptal edilmiş karusel yeniden üretilmez', () => {
    const r = planla({ ...base, items: [item({ status: 'yayinlandi' }), item({ key: 'k|a|r|Siyah', color: 'Siyah', status: 'iptal' })] });
    expect(r.create.filter((p) => p.kind === 'karusel')).toEqual([]);
  });
});

describe('durumHesapla', () => {
  const ok = { status: 'tamam' as const, attempts: 1 };
  const bad = { status: 'hata' as const, attempts: 3 };
  it('hepsi bittiyse sonuca göre', () => {
    expect(durumHesapla({ instagram: ok, facebook: { status: 'atlandi', attempts: 0 } }, ['instagram', 'facebook'])).toBe('yayinlandi');
    expect(durumHesapla({ instagram: ok, facebook: bad }, ['instagram', 'facebook'])).toBe('kismi');
    expect(durumHesapla({ instagram: bad }, ['instagram'])).toBe('hata');
  });
  it('denenecek hedef kaldıysa bekliyor', () => {
    expect(durumHesapla({ instagram: ok }, ['instagram', 'facebook'])).toBe('bekliyor');
  });
});
```

- [ ] **Step 2:** `npx jest paylasim-plan` → FAIL.

- [ ] **Step 3: Uygula** — `lib/paylasim/zaman.ts`

```ts
import { DAY_MS, trDayKey, trTime } from '../tr-time';

export function slotTimes(times: string[], now: number, days: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < days; d++) {
    const day = trDayKey(now + d * DAY_MS);
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const at = trTime(day, h, m);
      if (at > now) out.push(at);
    }
  }
  return out.sort((a, b) => a - b);
}

export const isDue = (at: number, now: number) => at <= now && trDayKey(at) === trDayKey(now);
export const isMissed = (at: number, now: number) => at <= now && trDayKey(at) !== trDayKey(now);
```

`lib/paylasim/plan.ts`

```ts
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

export function durumHesapla(targets: Partial<Record<SocialPlatform, Hedef>>, platforms: SocialPlatform[]): PaylasimDurum {
  const list = platforms.map((p) => targets[p]);
  const open = list.some((t) => !t || t.status === 'gonderiliyor' || t.status === 'bekliyor' || (t.status === 'hata' && t.attempts < MAX_DENEME));
  if (open) return 'bekliyor';
  const ok = list.filter((t) => t!.status === 'tamam').length;
  const bad = list.filter((t) => t!.status === 'hata' || t!.status === 'belirsiz').length;
  if (!bad) return 'yayinlandi';
  return ok ? 'kismi' : 'hata';
}
```

- [ ] **Step 4:** `npx jest paylasim-plan` → PASS. Commit "Paylaşım: zaman ve planlayıcı".

---

### Task 4: Metinler, hikâye görseli ve Facebook hikâyesi

**Files:**
- Create: `lib/paylasim/metin.ts`, `__tests__/lib/paylasim-metin.test.ts`
- Modify: `lib/facebook-page.ts` (sona ekle), `__tests__/lib/facebook-page.test.ts`

**Interfaces:**
- Not: "Yayınlanan" sekmesinde platform kalıcı bağlantısı aşama 1'de gösterilmez; sonuç ve hata gösterilir.
- Consumes: `PaylasimUrun`; `overlayText` (`lib/instagram-utils`), `clip`, `hashtagsFor`, `productUrl` (`lib/social-content-utils`)
- Produces: `uzunMetin(u,color)`, `kisaMetin(u,color,max)`, `telegramMetni(u,color)`, `hikayeUrl(cloud,imageId,u)`, `publishFacebookStory(imageUrl, cfg?)`

- [ ] **Step 1: Test** — `__tests__/lib/paylasim-metin.test.ts`

```ts
import { hikayeUrl, kisaMetin, telegramMetni, uzunMetin } from '@/lib/paylasim/metin';
import type { PaylasimUrun } from '@/lib/paylasim/types';

const u: PaylasimUrun = {
  id: 'a', title: 'Sihirli Kupa', slug: 'sihirli-kupa', category: 'Sihirli Kupa', shortDesc: 'Sıcak <içecek> ile açılır.',
  deliveryDays: 3, createdAt: 1, images: ['karta-baski/urunler/x'], colors: [],
  tiers: Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}’li uzun set açıklaması tasarımlı`, price: `${300 - i} ₺` })),
};

it('uzun açıklamada tüm kademeler, renk ve bağlantı vardır', () => {
  const s = uzunMetin(u, 'Siyah');
  expect(s).toContain('Siyah renk');
  expect(s.match(/₺/g)).toHaveLength(7);
  expect(s).toContain('/urun/sihirli-kupa');
});
it('kısa metin sınırı aşmaz ve bağlantıyı korur', () => {
  const s = kisaMetin(u, '', 500);
  expect(s.length).toBeLessThanOrEqual(500);
  expect(s).toContain('/urun/sihirli-kupa');
});
it('Telegram metni HTML kaçışlı ve 1024 altındadır', () => {
  const s = telegramMetni(u, '');
  expect(s).not.toContain('<içecek>');
  expect(s.length).toBeLessThanOrEqual(1024);
});
it('hikâye adresi 1080×1920, ad + 7 kademe + site katmanı içerir', () => {
  const url = hikayeUrl('demo', 'karta-baski/urunler/x', u);
  expect(url).toContain('w_1080,h_1920');
  expect(url.match(/l_text:/g)).toHaveLength(9);
  expect(url.endsWith('/karta-baski/urunler/x')).toBe(true);
});
```

`__tests__/lib/facebook-page.test.ts` içine (`publishFacebookStory` import listesine eklenir):

```ts
describe('sayfa hikâyesi', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('yayınlanmamış fotoğraf yükleyip photo_stories çağırır', async () => {
    const f = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'sayfa' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'foto1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, post_id: 'h1' }) });
    global.fetch = f as unknown as typeof fetch;
    await expect(publishFacebookStory('https://img/x.jpg', { pageId: '123', token: 's' })).resolves.toBe('h1');
    expect((f.mock.calls[1][1].body as URLSearchParams).get('published')).toBe('false');
    expect(String(f.mock.calls[2][0])).toContain('123/photo_stories');
    expect((f.mock.calls[2][1].body as URLSearchParams).get('photo_id')).toBe('foto1');
  });
});
```

- [ ] **Step 2:** `npx jest paylasim-metin facebook-page` → FAIL.

- [ ] **Step 3: Uygula** — `lib/paylasim/metin.ts`

```ts
// Paylaşım açıklamaları ve hikâye görsel adresi (testli, saf).
import { PHONE_DISPLAY } from '../constants';
import { overlayText } from '../instagram-utils';
import { clip, hashtagsFor, productUrl } from '../social-content-utils';
import { MAX_KADEME, type PaylasimUrun } from './types';

const baslik = (u: PaylasimUrun, color: string) => `☕ ${clip(u.title, 90)}${color ? ` (${color} renk)` : ''}`;
const satirlar = (u: PaylasimUrun) => u.tiers.map((t) => `• ${t.label}: ${t.price}`);

export function uzunMetin(u: PaylasimUrun, color: string): string {
  const ozet = clip(u.shortDesc, 200);
  return [
    baslik(u, color), '',
    ...(ozet ? [ozet, ''] : []),
    ...satirlar(u), '',
    `📦 Teslimat: yaklaşık ${u.deliveryDays} iş günü`,
    `📲 Sipariş için WhatsApp: ${PHONE_DISPLAY}`,
    `👉 ${productUrl(u.slug)}`, '',
    hashtagsFor(u.category).join(' '),
  ].join('\n');
}

/** Sınırlı alanlar (Threads, Pinterest, TikTok): sığana kadar son kademeler düşer, bağlantı kalır. */
export function kisaMetin(u: PaylasimUrun, color: string, max: number): string {
  const rows = satirlar(u);
  const build = (n: number) => [baslik(u, color), ...rows.slice(0, n), `👉 ${productUrl(u.slug)}`].join('\n');
  let n = rows.length;
  while (n > 0 && build(n).length > max) n--;
  const text = build(n);
  return text.length <= max ? text : text.slice(0, max);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function telegramMetni(u: PaylasimUrun, color: string): string {
  const rows = satirlar(u).map(esc);
  const build = (ozet: string) =>
    [`<b>${esc(baslik(u, color))}</b>`, ...(ozet ? ['', ozet] : []), '', ...rows, '', `👉 ${productUrl(u.slug)}`].join('\n');
  const full = build(esc(clip(u.shortDesc, 200)));
  return full.length <= 1024 ? full : build('');
}

export function hikayeUrl(cloud: string, imageId: string, u: PaylasimUrun): string {
  if (!cloud) throw new Error('Cloudinary cloud adı tanımlı değil');
  const lines = [
    { text: clip(u.title, 30), style: 'Roboto_56_bold', color: 'white', bg: '1D47C4' },
    ...u.tiers.slice(0, MAX_KADEME).map((t) => ({ text: clip(`${t.label}: ${t.price}`, 40), style: 'Roboto_42_bold', color: 'rgb:121214', bg: 'ffffffe6' })),
    { text: 'kartabaski.com', style: 'Roboto_40_bold', color: 'rgb:121214', bg: 'FFC51B' },
  ];
  const layers = lines.map((l, i) => {
    const y = Math.round((i - (lines.length - 1) / 2) * 84);
    return `l_text:${l.style}:${overlayText(l.text)},co_${l.color},b_rgb:${l.bg}/fl_layer_apply,g_center,y_${y}`;
  });
  return `https://res.cloudinary.com/${cloud}/image/upload/${['f_jpg,q_85,c_pad,b_rgb:ffffff,w_1080,h_1920', ...layers].join('/')}/${imageId}`;
}
```

(Buradaki hex değerler Cloudinary adresine gider; `app/site.css` içindeki `--brand`, `--ink`, `--sun` ile aynıdır.)

`lib/facebook-page.ts` sonuna:

```ts
/** Sayfa hikâyesi: görsel yayınlanmadan yüklenir, sonra hikâye olarak paylaşılır. */
export async function publishFacebookStory(imageUrl: string, cfg: FacebookConfig | null = getFacebookConfig()): Promise<string> {
  if (!cfg) throw new Error('FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN tanımlı değil');
  const { pageId, token } = await withPageToken(cfg);
  const photo = await graphPost(`${pageId}/photos`, buildPhotoParams(imageUrl, '', token, false));
  const r = await graphPost(`${pageId}/photo_stories`, new URLSearchParams({ photo_id: String(photo.id), access_token: token }));
  return String(r.post_id ?? photo.id);
}
```

Dosya başlığındaki "Hikâyeler kapsam dışı" cümlesi silinir.

- [ ] **Step 4:** `npx jest paylasim-metin facebook-page` → PASS. Commit "Paylaşım: metinler, hikâye görseli, Facebook hikâyesi".

---

### Task 5: Firestore deposu

**Files:**
- Create: `lib/paylasim/depo.ts`

**Interfaces:**
- Produces: `getAyar(fresh?)`, `saveAyar(patch)`, `yeniSistemAktif()`, `getGorsel(): {white, usedAt, tukendiBildirildi}`, `saveWhite(map)`, `setTukendi(b)`, `listItems(now)`, `getItem(key)`, `applyPlan(plan)`, `patchItem(key, patch)`, `claimTarget(key, platform, now): Promise<boolean>`, `finishTarget(key, platform, sonuc, platforms)`

- [ ] **Step 1: Yaz**

```ts
import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import type { SocialPlatform } from '../social-types';
import { durumHesapla, type PlanSonuc } from './plan';
import { MAX_DENEME, VARSAYILAN_AYAR, type Ayar, type Hedef, type Paylasim } from './types';
import type { Beyaz } from './sira';

const col = () => adminDb.collection('paylasim');
const ayarRef = () => adminDb.collection('paylasim_ayar').doc('main');
const gorselRef = () => adminDb.collection('paylasim_ayar').doc('gorsel');
const STALE_MS = 10 * 60_000;

let cache: { at: number; value: Ayar } | null = null;

export async function getAyar(fresh = false): Promise<Ayar> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.value;
  const d = ((await ayarRef().get()).data() ?? {}) as Partial<Ayar>;
  const value: Ayar = {
    ...VARSAYILAN_AYAR, ...d,
    platforms: { ...VARSAYILAN_AYAR.platforms, ...(d.platforms ?? {}) },
    covers: d.covers ?? {},
    kinds: { ...VARSAYILAN_AYAR.kinds, ...(d.kinds ?? {}) },
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function saveAyar(patch: Partial<Ayar>): Promise<Ayar> {
  await ayarRef().set(patch, { merge: true });
  cache = null;
  return getAyar(true);
}

/** Eski ürün otomasyonları bunu sorar. Okunamazsa eski düzen sürer. */
export async function yeniSistemAktif(): Promise<boolean> {
  try {
    return (await getAyar()).mode === 'canli';
  } catch (e) {
    console.warn('[paylasim] ayar okunamadı', e);
    return false;
  }
}

export async function getGorsel(): Promise<{ white: Beyaz; usedAt: Record<string, number>; tukendiBildirildi: boolean }> {
  const d = (await gorselRef().get()).data() ?? {};
  return { white: (d.white ?? {}) as Beyaz, usedAt: (d.usedAt ?? {}) as Record<string, number>, tukendiBildirildi: !!d.tukendiBildirildi };
}

export const saveWhite = async (white: Beyaz) => { await gorselRef().set({ white }, { merge: true }); };
export const markUsed = async (ids: string[], at: number) => {
  await gorselRef().set({ usedAt: Object.fromEntries(ids.map((id) => [id, at])) }, { merge: true });
};
export const setTukendi = async (tukendiBildirildi: boolean) => { await gorselRef().set({ tukendiBildirildi }, { merge: true }); };

/** Tüm karuseller (en fazla ~200 belge) ve son 3 günden itibaren hikâyeler. */
export async function listItems(now: number): Promise<Paylasim[]> {
  const [k, h] = await Promise.all([
    col().where('kind', '==', 'karusel').get(),
    col().where('at', '>=', now - 3 * 86400000).get(),
  ]);
  const map = new Map<string, Paylasim>();
  for (const d of [...k.docs, ...h.docs]) map.set(d.id, d.data() as Paylasim);
  return Array.from(map.values()).sort((a, b) => a.at - b.at);
}

export async function getItem(key: string): Promise<Paylasim | null> {
  return ((await col().doc(key).get()).data() as Paylasim | undefined) ?? null;
}

export async function applyPlan(p: PlanSonuc): Promise<void> {
  const batch = adminDb.batch();
  for (const key of p.remove) batch.delete(col().doc(key));
  for (const m of p.move) batch.update(col().doc(m.key), { at: m.at });
  for (const key of p.cancel) batch.update(col().doc(key), { status: 'iptal' });
  for (const c of p.close) batch.update(col().doc(c.key), { status: c.status });
  for (const it of p.create) batch.set(col().doc(it.key), it);
  if (p.remove.length + p.move.length + p.cancel.length + p.close.length + p.create.length) await batch.commit();
}

export const patchItem = async (key: string, patch: Partial<Paylasim>) => { await col().doc(key).update(patch as Record<string, unknown>); };
export const clearTarget = async (key: string, platform: SocialPlatform) => {
  await col().doc(key).update({ [`targets.${platform}`]: FieldValue.delete(), status: 'bekliyor' });
};

/** Hedefi kilitler. Yarım kalmış eski bir gönderim "belirsiz" sayılır ve kendiliğinden yeniden denenmez. */
export async function claimTarget(key: string, platform: SocialPlatform, now: number): Promise<boolean> {
  const ref = col().doc(key);
  return adminDb.runTransaction(async (tx) => {
    const it = (await tx.get(ref)).data() as Paylasim | undefined;
    if (!it || it.status === 'iptal') return false;
    const t = it.targets[platform];
    if (t?.status === 'gonderiliyor') {
      if (now - (t.at ?? 0) > STALE_MS) tx.update(ref, { [`targets.${platform}.status`]: 'belirsiz' });
      return false;
    }
    if (t && (t.status !== 'hata' && t.status !== 'bekliyor')) return false;
    if ((t?.attempts ?? 0) >= MAX_DENEME) return false;
    tx.update(ref, { [`targets.${platform}`]: { status: 'gonderiliyor', attempts: (t?.attempts ?? 0) + 1, at: now } satisfies Hedef });
    return true;
  });
}

export async function finishTarget(
  key: string, platform: SocialPlatform, result: Pick<Hedef, 'status' | 'remoteId' | 'error'>, platforms: SocialPlatform[]
): Promise<Hedef | null> {
  const ref = col().doc(key);
  return adminDb.runTransaction(async (tx) => {
    const it = (await tx.get(ref)).data() as Paylasim | undefined;
    if (!it) return null;
    const prev = it.targets[platform] ?? { status: 'bekliyor', attempts: 0 };
    const next: Hedef = { status: result.status, attempts: prev.attempts, at: Date.now(),
      ...(result.remoteId ? { remoteId: result.remoteId } : {}), ...(result.error ? { error: result.error.slice(0, 200) } : {}) };
    const targets = { ...it.targets, [platform]: next };
    tx.update(ref, { targets, status: it.status === 'iptal' ? 'iptal' : durumHesapla(targets, platforms) });
    return next;
  });
}
```

- [ ] **Step 2:** `npx tsc --noEmit -p . 2>&1 | grep -v __tests__ | grep paylasim` → çıktı yok. Commit "Paylaşım: Firestore deposu".

---

### Task 6: Yayıncılar ve cron turu

**Files:**
- Create: `lib/paylasim/yayin.ts`, `lib/paylasim/tur.ts`
- Modify: `lib/pinterest-auto.ts:71` (`async function ensureBoard` → `export async function ensureBoard`), `app/api/cron/main/route.ts`

**Interfaces:**
- Consumes: Task 1-5 çıktıları; `publishCarousel`, `publishSinglePost`, `publishStory`, `isConnected` (`lib/instagram`); `publishToFacebookPage`, `publishFacebookStory`, `getFacebookConfig`; `publishThreadsMedia`, `threadsConfigured`; `tgChannel`, `channelConfigured`; `createPin`, `listBoards`, `pinterestConfigured`; `ensureBoard`; `boardNameFor`, `pinTitle`; `sendPhotoDraft`, `tiktokConfigured`, `getTikTokState`; `tiktokPhotoUrls`; `sendTelegramText`, `notifyAdmin`
- Produces: `yayinla(platform, item, urun): Promise<{ atlandi: string } | { remoteId: string }>`, `urunleriOku()`, `runPaylasimStep(now?)`, `hemenYayinla(key)`

- [ ] **Step 1: `lib/paylasim/yayin.ts`**

```ts
import 'server-only';
import { cloudinaryUrl } from '../format';
import { SITE_URL } from '../site';
import type { SocialPlatform } from '../social-types';
import { feedImageUrl } from '../instagram-utils';
import { isConnected, publishCarousel, publishSinglePost, publishStory } from '../instagram';
import { getFacebookConfig, publishFacebookStory, publishToFacebookPage } from '../facebook-page';
import { publishThreadsMedia, threadsConfigured } from '../threads';
import { channelConfigured, tgChannel } from '../telegram-channel';
import { createPin, listBoards, pinterestConfigured } from '../pinterest';
import { ensureBoard } from '../pinterest-auto';
import { boardNameFor, pinTitle } from '../pinterest-utils';
import { getTikTokState, sendPhotoDraft, tiktokConfigured } from '../tiktok';
import { tiktokPhotoUrls } from '../tiktok-utils';
import { sendTelegramText } from '../notify';
import { clip, productUrl } from '../social-content-utils';
import { hikayeUrl, kisaMetin, telegramMetni, uzunMetin } from './metin';
import type { Paylasim, PaylasimUrun } from './types';

export type YayinSonucu = { atlandi: string } | { remoteId: string };

const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';
const jpg = (id: string) => cloudinaryUrl(id, 'f_jpg,q_auto,w_1080,c_limit');
const square = (id: string) => cloudinaryUrl(id, 'f_jpg,q_auto,w_1000,h_1000,c_pad,b_white');

export async function yayinla(platform: SocialPlatform, item: Paylasim, u: PaylasimUrun): Promise<YayinSonucu> {
  const story = item.kind === 'hikaye';
  const ids = item.imageIds;
  const storyImage = () => hikayeUrl(cloud(), ids[0], u);

  switch (platform) {
    case 'instagram': {
      if (!(await isConnected())) return { atlandi: 'bağlı değil' };
      if (story) return { remoteId: await publishStory(storyImage()) };
      const urls = ids.map((id) => feedImageUrl(cloud(), id));
      const caption = item.caption || uzunMetin(u, item.color);
      return { remoteId: urls.length === 1 ? await publishSinglePost(urls[0], caption) : await publishCarousel(urls, caption) };
    }
    case 'facebook': {
      if (!getFacebookConfig()) return { atlandi: 'bağlı değil' };
      if (story) return { remoteId: await publishFacebookStory(storyImage()) };
      return { remoteId: await publishToFacebookPage(ids.map(jpg), item.caption || uzunMetin(u, item.color)) };
    }
    case 'threads': {
      if (!threadsConfigured()) return { atlandi: 'bağlı değil' };
      const out = await publishThreadsMedia(ids.map(jpg), (item.caption || kisaMetin(u, item.color, 500)).slice(0, 500));
      return { remoteId: out.id };
    }
    case 'telegram': {
      if (!channelConfigured()) return { atlandi: 'bağlı değil' };
      const caption = telegramMetni(u, item.color);
      const out = ids.length === 1
        ? await tgChannel('sendPhoto', { photo: jpg(ids[0]), caption, parse_mode: 'HTML' })
        : await tgChannel('sendMediaGroup', {
            media: ids.slice(0, 10).map((id, i) => ({ type: 'photo', media: jpg(id), ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) })),
          });
      if (!out.ok) throw new Error(out.error ?? 'Telegram hatası');
      return { remoteId: String(out.messageId ?? 'albüm') };
    }
    case 'pinterest': {
      if (!(await pinterestConfigured())) return { atlandi: 'bağlı değil' };
      const board = await ensureBoard(await listBoards(), boardNameFor(u.category));
      return {
        remoteId: await createPin({
          boardId: board.id,
          title: pinTitle(u.title),
          description: item.caption ? clip(item.caption, 500) : kisaMetin(u, item.color, 500),
          link: productUrl(u.slug),
          imageUrls: story ? [storyImage()] : ids.slice(0, 5).map(square),
        }),
      };
    }
    case 'tiktok': {
      if (story) {
        const ok = await sendTelegramText(`TikTok hikâyesi hazır: ${u.title}\nGörseli açıp TikTok'ta hikâye olarak paylaşın:\n${storyImage()}`);
        if (!ok) return { atlandi: 'yönetici Telegram bağlı değil' };
        return { remoteId: 'elle' };
      }
      if (!tiktokConfigured() || !(await getTikTokState()).accessToken) return { atlandi: 'bağlı değil' };
      const photoUrls = tiktokPhotoUrls(SITE_URL, ids);
      if (!photoUrls.length) return { atlandi: 'uygun fotoğraf yok' };
      return {
        remoteId: await sendPhotoDraft({
          title: clip(u.title, 90),
          description: item.caption ? clip(item.caption, 2000) : kisaMetin(u, item.color, 2000),
          photoUrls,
        }),
      };
    }
  }
}
```

- [ ] **Step 2: `lib/paylasim/tur.ts`**

```ts
import 'server-only';
import { getProductsServer } from '../products-server';
import { toSocialRow } from '../social-content-utils';
import { notifyAdmin } from '../notify';
import { SITE_URL } from '../site';
import type { Product } from '@/types';
import { approvedTiers } from './fiyat';
import { isPlain, whiteProbeUrl } from './kapak';
import { planla } from './plan';
import { carouselCandidates, productImages, type Beyaz } from './sira';
import { applyPlan, claimTarget, finishTarget, getAyar, getGorsel, getItem, listItems, markUsed, saveWhite, setTukendi } from './depo';
import { yayinla } from './yayin';
import { isDue } from './zaman';
import { MAX_DENEME, PLATFORMLAR, type Ayar, type Paylasim, type PaylasimUrun } from './types';

const PROBE_PER_RUN = 60;
const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

/** Ürünü paylaşım satırına çevirir; `tiers` onaysızsa boş kalır. */
export function urunSatiri(p: Product): PaylasimUrun {
  const r = toSocialRow(p);
  const colors = (p.colors ?? []).map((c) => ({ name: c.name, images: (c.images ?? []).filter((i) => i && !i.startsWith('http')) }));
  return {
    id: r.id, title: r.title, slug: r.slug || r.id, category: r.category, shortDesc: r.shortDesc,
    deliveryDays: r.deliveryDays, createdAt: r.createdAt, images: r.imageIds, colors, tiers: approvedTiers(p) ?? [],
  };
}

export async function urunleriOku(): Promise<PaylasimUrun[]> {
  return (await getProductsServer())
    .filter((p) => p.active !== false)
    .map(urunSatiri)
    .filter((u) => u.tiers.length && productImages(u).length);
}

async function olcBeyaz(products: PaylasimUrun[], white: Beyaz): Promise<Beyaz> {
  const missing = products.flatMap(productImages).filter((id) => !(id in white)).slice(0, PROBE_PER_RUN);
  const found: Beyaz = {};
  for (const id of missing) {
    try {
      const res = await fetch(whiteProbeUrl(cloud(), id), { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (res.ok) found[id] = isPlain(new Uint8Array(await res.arrayBuffer()));
    } catch (e) {
      console.warn('[paylasim] kapak ölçümü', id, e);
    }
  }
  if (Object.keys(found).length) await saveWhite(found);
  return { ...white, ...found };
}

async function gonder(item: Paylasim, u: PaylasimUrun, ayar: Ayar, now: number, posted: string[], errors: string[]) {
  const platforms = PLATFORMLAR[item.kind].filter((p) => ayar.platforms[p]);
  for (const platform of platforms) {
    if (!(await claimTarget(item.key, platform, now))) continue;
    try {
      const out = await yayinla(platform, item, u);
      if ('atlandi' in out) {
        await finishTarget(item.key, platform, { status: 'atlandi', error: out.atlandi }, platforms);
      } else {
        await finishTarget(item.key, platform, { status: 'tamam', remoteId: out.remoteId }, platforms);
        posted.push(`${item.key}@${platform}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'bilinmeyen hata';
      const t = await finishTarget(item.key, platform, { status: 'hata', error }, platforms);
      errors.push(`${u.title.slice(0, 24)} ${platform}: ${error.slice(0, 120)}`);
      if (t && t.attempts >= MAX_DENEME) await notifyAdmin('Paylaşım başarısız', `${u.title} (${platform}): ${error}\n${SITE_URL}/admin/paylasim`);
    }
  }
}

export async function runPaylasimStep(now = Date.now()) {
  const posted: string[] = [];
  const errors: string[] = [];
  const ayar = await getAyar(true);
  if (ayar.paused) return { skipped: 'durduruldu', posted, errors, planned: 0 };

  const [products, gorsel] = await Promise.all([urunleriOku(), getGorsel()]);
  // Ürün okunamazsa (boş liste) bekleyenler silinmesin
  if (!products.length) return { skipped: 'fiyatı onaylı ürün yok', posted, errors, planned: 0 };
  const white = await olcBeyaz(products, gorsel.white);
  const plan = planla({ products, items: await listItems(now), ayar, imageUsedAt: gorsel.usedAt, white, now });
  await applyPlan(plan);

  const items = await listItems(now);
  const left = items.some((i) => i.kind === 'karusel' && i.status === 'bekliyor')
    || carouselCandidates(products, new Set(items.map((i) => i.key))).length > 0;
  if (!left && !gorsel.tukendiBildirildi) {
    await notifyAdmin('Karusel sırası bitti', `Tüm ürün karuselleri paylaşıldı.\n${SITE_URL}/admin/paylasim`);
    await setTukendi(true);
  } else if (left && gorsel.tukendiBildirildi) await setTukendi(false);

  if (ayar.mode !== 'canli') return { skipped: 'önizleme modu', posted, errors, planned: plan.create.length };

  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of items.filter((i) => i.status === 'bekliyor' && ayar.kinds[i.kind] && isDue(i.at, now)).slice(0, 3)) {
    const u = byId.get(item.productId);
    if (!u) continue;
    await gonder(item, u, ayar, now, posted, errors);
    await markUsed(item.imageIds, now);
  }
  return { posted, errors, planned: plan.create.length };
}

/** Panelden "Hemen paylaş": mod ve saat beklemez. */
export async function hemenYayinla(key: string) {
  const posted: string[] = [];
  const errors: string[] = [];
  const [item, ayar, products] = await Promise.all([getItem(key), getAyar(true), urunleriOku()]);
  if (!item || item.status === 'iptal') throw new Error('Paylaşım bulunamadı');
  const u = products.find((p) => p.id === item.productId);
  if (!u) throw new Error('Ürün paylaşıma uygun değil (pasif ya da fiyat onaysız)');
  await gonder(item, u, ayar, Date.now(), posted, errors);
  return { posted, errors };
}
```

- [ ] **Step 3: Cron adımı.** `app/api/cron/main/route.ts`: `import { runPaylasimStep } from '@/lib/paylasim/tur';` ve `['broadcast', …]` satırının altına `['paylasim', () => runPaylasimStep()],`. Üstteki sıra yorumuna "→ paylaşım sistemi" eklenir.

- [ ] **Step 4:** `npx tsc --noEmit -p . 2>&1 | grep -v __tests__ | grep -E "paylasim|cron"` → çıktı yok; `npx jest` → PASS. Commit "Paylaşım: yayıncılar ve cron turu".

---

### Task 7: Eski ürün otomasyonlarının devri

**Files:**
- Modify: `lib/instagram-posts.ts` (`ensureDailyPlan`, `publishDue`), `lib/facebook-auto.ts`, `lib/threads-auto.ts`, `lib/telegram-channel.ts`, `lib/pinterest-auto.ts`, `lib/tiktok-auto.ts`
- Create: `__tests__/lib/paylasim-devir.test.ts`

**Interfaces:**
- Consumes: `yeniSistemAktif()`
- Kural: yalnız ürün/model ve hikâye paylaşımı susar; blog, kampanya ve durum güncellemeleri sürer. Panelden elle "Şimdi paylaş" eylemleri değişmez.

- [ ] **Step 1: Test** (cron turunda TikTok örneği)

```ts
/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/paylasim/depo', () => ({ yeniSistemAktif: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/firebase-admin', () => ({ adminDb: { collection: () => ({ doc: () => ({}) }) }, adminAuth: {} }));

import { runTikTokCycle } from '@/lib/tiktok-auto';

it('yeni sistem açıkken eski TikTok turu ürün göndermez', async () => {
  await expect(runTikTokCycle()).resolves.toEqual({ posted: [], errors: [], skipped: 'ürün paylaşımları yeni paylaşım sisteminde' });
});
```

- [ ] **Step 2:** `npx jest paylasim-devir` → FAIL.

- [ ] **Step 3: Uygula.** Her dosyaya `import { yeniSistemAktif } from './paylasim/depo';`.

`tiktok-auto.ts`:

```ts
export async function runTikTokCycle(): Promise<CycleResult> {
  if (await yeniSistemAktif()) return { posted: [], errors: [], skipped: 'ürün paylaşımları yeni paylaşım sisteminde' };
  return runTikTokCycleWith();
}
```

`telegram-channel.ts` ve `pinterest-auto.ts`: ürün kuyruğundan önce `const devir = !opts.ignoreWindow && (await yeniSistemAktif());` ve `if (room > 0)` → `if (room > 0 && !devir)`. `pinterest-auto.ts` içindeki `opts` adı fonksiyon imzasındaki seçenek nesnesidir.

`threads-auto.ts`: `const open = …` satırının altına `const devir = !opts.ignoreWindow && (await yeniSistemAktif());`; "1) Yeni eklenen ürünler" koşulu `if (open && !opts.ignoreWindow && !devir)`; "3) Kota kuyruğu" başlığından önce:

```ts
    if (devir) {
      if (!result.posted.length) result.skipped = 'ürün paylaşımları yeni paylaşım sisteminde';
      return result;
    }
```

`facebook-auto.ts`: `const open = inWindow(s, now);` altına `const devir = await yeniSistemAktif();`; bölüm 1 `if (open && !devir)`; bölüm 1b döngüsü `for (const r of devir ? [] : retryableFailures(rows, st0.posted).slice(0, NEW_PER_RUN))`; bölüm 4:

```ts
  const gate = devir ? { ok: false, reason: 'ürün paylaşımları yeni paylaşım sisteminde' } : canPostNow(await loadState(), s, now);
```

`instagram-posts.ts`: `ensureDailyPlan` ilk satırı `if (await yeniSistemAktif()) return { created: 0, skipped: 'ürün paylaşımları yeni paylaşım sisteminde' };`; `publishDue` içinde:

```ts
  const devir = await yeniSistemAktif();
  const due = (await listPostsBetween(now - 12 * HOUR, now + 1)).filter((p) => isDue(p, now) && (!devir || p.kind === 'blog')).slice(0, max);
```

- [ ] **Step 4:** `npx jest` → hepsi PASS (mevcut testler depo modülünü yüklemeye çalışırsa aynı `jest.mock('@/lib/paylasim/depo', …)` satırı `mockResolvedValue(false)` ile eklenir). Commit "Paylaşım: eski ürün otomasyonlarının devri".

---

### Task 8: Tek panel

**Files:**
- Create: `lib/actions-paylasim.ts`, `app/admin/paylasim/page.tsx`, `app/admin/paylasim/paylasim.css`
- Modify: `lib/admin-nav.ts` (SOCIAL_LINKS başına), `__tests__/lib/admin-nav.test.ts` (8 → 9)

**Interfaces:**
- Produces: `getPaylasimPanelAction()`, `saveAyarAction(patch)`, `ertleAction(key)`, `iptalAction(key)`, `metinAction(key, caption)`, `gorsellerAction(key, imageIds)`, `hemenAction(key)`, `tekrarAction(key, platform)`, `kademeOnayAction(productId, tiers)`, `kapakAction(groupKey, imageId)`

- [ ] **Step 1: Menü testi.** `expect(SOCIAL_LINKS).toHaveLength(9)` ve `expect(inSocial('/admin/paylasim')).toBe(true);` → `npx jest admin-nav` FAIL. `SOCIAL_LINKS` başına `{ href: '/admin/paylasim', label: 'Paylaşım Paneli', icon: 'megaphone', desc: 'Sıra, onay ve ayarlar' },` → PASS.

- [ ] **Step 2: `lib/actions-paylasim.ts`**

```ts
'use server';

import { revalidateTag } from 'next/cache';
import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { updateProduct } from './products-admin';
import type { SocialPlatform } from './social-types';
import { parsePriceLines, priceSourceKey } from './paylasim/fiyat';
import { clearTarget, getAyar, getGorsel, getItem, listItems, patchItem, saveAyar } from './paylasim/depo';
import { productImages, groupKey } from './paylasim/sira';
import { uzunMetin } from './paylasim/metin';
import { slotTimes } from './paylasim/zaman';
import { hemenYayinla, runPaylasimStep, urunSatiri } from './paylasim/tur';
import { MAX_KADEME, type Ayar, type Kademe } from './paylasim/types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getPaylasimPanelAction() {
  await requireAdmin();
  const now = Date.now();
  const [ayar, gorsel, items, products] = await Promise.all([getAyar(true), getGorsel(), listItems(now), getProductsServer()]);
  const urunler = products.filter((p) => p.active !== false).map((p) => {
    const u = urunSatiri(p);
    return {
      id: u.id,
      title: u.title,
      approved: u.tiers.length > 0,
      tiers: u.tiers.length ? u.tiers : p.priceTiers?.length ? p.priceTiers : parsePriceLines(p.description),
      suggestion: parsePriceLines(p.description),
      images: productImages(u),
      groups: [{ key: groupKey(u.id, ''), name: 'Karışık', images: productImages(u) },
        ...u.colors.filter((c) => c.images.length).map((c) => ({ key: groupKey(u.id, c.name), name: c.name, images: c.images }))],
    };
  });
  const captions: Record<string, string> = {};
  for (const i of items) {
    const p = products.find((x) => x.id === i.productId);
    if (p && i.kind === 'karusel') captions[i.key] = i.caption || uzunMetin(urunSatiri(p), i.color);
  }
  return { ayar, white: gorsel.white, items, urunler, captions };
}

export type PanelData = Awaited<ReturnType<typeof getPaylasimPanelAction>>;

export async function saveAyarAction(patch: Partial<Ayar>) {
  await requireAdmin();
  const clean: Partial<Ayar> = {};
  if (patch.mode === 'onizleme' || patch.mode === 'canli') clean.mode = patch.mode;
  if (typeof patch.paused === 'boolean') clean.paused = patch.paused;
  if (patch.platforms) clean.platforms = patch.platforms;
  if (patch.kinds) clean.kinds = patch.kinds;
  for (const k of ['carouselTimes', 'storyTimes'] as const) {
    const v = patch[k];
    if (v) {
      const list = Array.from(new Set(v.filter((t) => TIME.test(t)))).sort();
      if (!list.length || list.length > 6) throw new Error('1 ile 6 arasında saat girin (ör. 11:00).');
      clean[k] = list;
    }
  }
  await saveAyar(clean);
  await runPaylasimStepIfPreview();
}

/** Ayar ya da onay sonrası sıranın hemen görünmesi için: yalnız önizlemede tur çalıştırılır (yayın yapmaz). */
async function runPaylasimStepIfPreview() {
  if ((await getAyar(true)).mode === 'onizleme') await runPaylasimStep();
}

export async function ertleAction(key: string) {
  await requireAdmin();
  const now = Date.now();
  const [ayar, items, item] = await Promise.all([getAyar(), listItems(now), getItem(key)]);
  if (!item || item.status !== 'bekliyor') throw new Error('Yalnız bekleyen paylaşım ertelenir.');
  if (item.kind !== 'karusel') throw new Error('Hikâye ertelenmez; iptal edebilirsiniz.');
  const taken = new Set(items.filter((i) => i.kind === 'karusel' && i.status === 'bekliyor').map((i) => i.at));
  const at = slotTimes(ayar.carouselTimes, Math.max(now, item.at), 30).find((t) => !taken.has(t));
  if (!at) throw new Error('Boş saat bulunamadı.');
  await patchItem(key, { at });
}

export async function iptalAction(key: string) { await requireAdmin(); await patchItem(key, { status: 'iptal' }); await runPaylasimStepIfPreview(); }
export async function metinAction(key: string, caption: string) { await requireAdmin(); await patchItem(key, { caption: caption.trim().slice(0, 2200) }); }
export async function gorsellerAction(key: string, imageIds: string[]) {
  await requireAdmin();
  const item = await getItem(key);
  if (!item || item.status !== 'bekliyor') throw new Error('Yalnız bekleyen paylaşım düzenlenir.');
  const p = (await getProductsServer()).find((x) => x.id === item.productId);
  const allowed = new Set(p ? productImages(urunSatiri(p)) : []);
  const ids = imageIds.filter((id) => allowed.has(id)).slice(0, item.kind === 'hikaye' ? 1 : 10);
  if (!ids.length) throw new Error('En az bir görsel seçin.');
  await patchItem(key, { imageIds: ids });
}
export async function hemenAction(key: string) { await requireAdmin(); return hemenYayinla(key); }
export async function tekrarAction(key: string, platform: SocialPlatform) { await requireAdmin(); await clearTarget(key, platform); return hemenYayinla(key); }

export async function kademeOnayAction(productId: string, tiers: Kademe[]) {
  await requireAdmin();
  const p = (await getProductsServer()).find((x) => x.id === productId);
  if (!p) throw new Error('Ürün bulunamadı.');
  const clean = tiers.map((t) => ({ label: t.label.trim(), price: t.price.trim() })).filter((t) => t.label && t.price).slice(0, MAX_KADEME);
  if (!clean.length) throw new Error('En az bir fiyat satırı girin.');
  await updateProduct(productId, { slug: p.slug, priceTiers: clean, priceTiersSource: priceSourceKey(p.description) });
  revalidateTag('products');
  await runPaylasimStepIfPreview();
}

export async function kapakAction(key: string, imageId: string) {
  await requireAdmin();
  const ayar = await getAyar(true);
  await saveAyar({ covers: { ...ayar.covers, [key]: imageId } });
}
```

- [ ] **Step 3: `app/admin/paylasim/page.tsx`** — istemci bileşeni, dört sekme (Sırada, Yayınlanan, Fiyatlar ve kapaklar, Ayarlar):

```tsx
'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import {
  ertleAction, getPaylasimPanelAction, gorsellerAction, hemenAction, iptalAction, kademeOnayAction,
  kapakAction, metinAction, saveAyarAction, tekrarAction, type PanelData,
} from '@/lib/actions-paylasim';
import { cloudinaryThumb } from '@/lib/format';
import type { Paylasim, Kademe } from '@/lib/paylasim/types';
import type { SocialPlatform } from '@/lib/social-types';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import './paylasim.css';

const TABS = ['Sırada', 'Yayınlanan', 'Fiyatlar ve kapaklar', 'Ayarlar'] as const;
const NAMES: Record<SocialPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', telegram: 'Telegram', pinterest: 'Pinterest', tiktok: 'TikTok' };
const DURUM: Record<string, string> = { bekliyor: 'Bekliyor', gonderiliyor: 'Gönderiliyor', tamam: 'Yayınlandı', hata: 'Hata', atlandi: 'Atlandı', belirsiz: 'Belirsiz, kontrol edin', yayinlandi: 'Yayınlandı', kismi: 'Kısmen', iptal: 'İptal' };
const when = (ts: number) => new Date(ts).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'short', hour: '2-digit', minute: '2-digit' });

export default function PaylasimPage() {
  const [data, setData] = useState<PanelData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Sırada');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => getPaylasimPanelAction().then(setData).catch((e) => toast.error(errorMessage(e, 'Panel yüklenemedi'))), [toast]);
  useEffect(() => { void load(); }, [load]);

  const run = async (job: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await job(); toast.success(ok); await load(); }
    catch (e) { toast.error(errorMessage(e, 'İşlem yapılamadı')); }
    finally { setBusy(false); }
  };

  if (!data) return <p className="pl-empty">Yükleniyor…</p>;
  const title = (id: string) => data.urunler.find((u) => u.id === id)?.title ?? 'Ürün';
  const waiting = data.items.filter((i) => i.status === 'bekliyor');
  const done = data.items.filter((i) => i.status === 'yayinlandi' || i.status === 'kismi' || i.status === 'hata').reverse();
  const unapproved = data.urunler.filter((u) => !u.approved).length;

  const card = (item: Paylasim) => {
    const product = data.urunler.find((u) => u.id === item.productId);
    return (
      <article key={item.key} className="pl-card">
        <header>
          <strong>{item.kind === 'hikaye' ? 'Hikâye' : 'Karusel'} · {title(item.productId)}{item.color ? ` · ${item.color}` : ''}</strong>
          <span>{when(item.at)} · {DURUM[item.status]}</span>
        </header>
        <div className="pl-images">{item.imageIds.map((id) => <img key={id} src={cloudinaryThumb(id)} alt="" loading="lazy" />)}</div>
        {Object.entries(item.targets).length > 0 && (
          <ul className="pl-targets">
            {(Object.entries(item.targets) as [SocialPlatform, NonNullable<Paylasim['targets'][SocialPlatform]>][]).map(([p, t]) => (
              <li key={p} data-status={t.status}>
                {NAMES[p]}: {DURUM[t.status]}{t.error ? ` (${t.error})` : ''}
                {(t.status === 'hata' || t.status === 'belirsiz') && (
                  <button disabled={busy} onClick={async () => { if (await confirm({ title: 'Yeniden gönderilsin mi?', message: 'Platformda yayınlanmadığından emin olun.' })) void run(() => tekrarAction(item.key, p), 'Yeniden denendi'); }}>Yeniden dene</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {item.status === 'bekliyor' && (
          <>
            {item.kind === 'karusel' && (
              <details>
                <summary>Metni düzenle</summary>
                <textarea defaultValue={data.captions[item.key]} rows={10} onBlur={(e) => { if (e.target.value !== data.captions[item.key]) void run(() => metinAction(item.key, e.target.value), 'Metin kaydedildi'); }} />
              </details>
            )}
            <details>
              <summary>Görselleri değiştir</summary>
              <div className="pl-pick">
                {product?.images.map((id) => {
                  const on = item.imageIds.includes(id);
                  const next = item.kind === 'hikaye' ? [id] : on ? item.imageIds.filter((x) => x !== id) : [...item.imageIds, id];
                  return <button key={id} aria-pressed={on} disabled={busy} onClick={() => void run(() => gorsellerAction(item.key, next), 'Görseller kaydedildi')}><img src={cloudinaryThumb(id)} alt="" loading="lazy" /></button>;
                })}
              </div>
            </details>
            <div className="pl-actions">
              <button className="is-primary" disabled={busy} onClick={async () => { if (await confirm({ title: 'Hemen paylaşılsın mı?', message: 'Bağlı tüm platformlarda yayınlanır.' })) void run(() => hemenAction(item.key), 'Gönderildi'); }}>Hemen paylaş</button>
              {item.kind === 'karusel' && <button disabled={busy} onClick={() => void run(() => ertleAction(item.key), 'Ertelendi')}>Ertele</button>}
              <button disabled={busy} onClick={async () => { if (await confirm({ title: 'İptal edilsin mi?', message: 'Bu paylaşım bir daha sıraya girmez.' })) void run(() => iptalAction(item.key), 'İptal edildi'); }}>İptal et</button>
            </div>
          </>
        )}
      </article>
    );
  };

  return (
    <div className="pl">
      <h1>Paylaşım Paneli</h1>
      <p className="pl-state">
        {data.ayar.paused ? 'Durduruldu.' : data.ayar.mode === 'canli' ? 'Canlı: zamanı gelen paylaşımlar yayınlanır.' : 'Önizleme: sıra oluşur, hiçbir şey yayınlanmaz.'}
        {unapproved > 0 && ` ${unapproved} ürün fiyat onayı bekliyor.`}
      </p>
      <nav className="pl-tabs">{TABS.map((t) => <button key={t} aria-current={t === tab} onClick={() => setTab(t)}>{t}</button>)}</nav>

      {tab === 'Sırada' && (waiting.length ? waiting.map(card) : <p className="pl-empty">Sırada paylaşım yok. Önce fiyatları onaylayın.</p>)}
      {tab === 'Yayınlanan' && (done.length ? done.map(card) : <p className="pl-empty">Henüz yayın yok.</p>)}

      {tab === 'Fiyatlar ve kapaklar' && data.urunler.map((u) => (
        <article key={u.id} className="pl-card">
          <header><strong>{u.title}</strong><span>{u.approved ? 'Onaylı' : 'Onay bekliyor'}</span></header>
          <TierEditor key={JSON.stringify(u.tiers)} tiers={u.tiers} busy={busy} onSave={(t) => void run(() => kademeOnayAction(u.id, t), 'Fiyatlar onaylandı')} />
          <details>
            <summary>Kapak seç</summary>
            {u.groups.map((g) => (
              <div key={g.key}>
                <h2>{g.name}</h2>
                <div className="pl-pick">
                  {g.images.map((id) => (
                    <button key={id} aria-pressed={data.ayar.covers[g.key] === id} disabled={busy} title={data.white[id] ? 'Düz zemin' : 'Temalı'} onClick={() => void run(() => kapakAction(g.key, id), 'Kapak kaydedildi')}>
                      <img src={cloudinaryThumb(id)} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
                {g.images.every((id) => data.white[id]) && <p>Temalı kapak yok.</p>}
              </div>
            ))}
          </details>
        </article>
      ))}

      {tab === 'Ayarlar' && (
        <article className="pl-card">
          <div className="pl-actions">
            <button disabled={busy} onClick={() => void run(() => saveAyarAction({ paused: !data.ayar.paused }), 'Kaydedildi')}>{data.ayar.paused ? 'Devam ettir' : 'Hepsini durdur'}</button>
            <button className="is-primary" disabled={busy} onClick={async () => {
              const live = data.ayar.mode === 'canli';
              if (await confirm({ title: live ? 'Önizlemeye dönülsün mü?' : 'Canlıya alınsın mı?', message: live ? 'Eski ürün otomasyonu yeniden çalışır.' : 'Zamanı gelen paylaşımlar yayınlanır; eski ürün ve hikâye otomasyonu kapanır.' })) {
                void run(() => saveAyarAction({ mode: live ? 'onizleme' : 'canli' }), 'Kaydedildi');
              }
            }}>{data.ayar.mode === 'canli' ? 'Önizlemeye dön' : 'Canlıya al'}</button>
          </div>
          {(Object.keys(NAMES) as SocialPlatform[]).map((p) => (
            <label key={p} className="pl-check">
              <input type="checkbox" checked={data.ayar.platforms[p]} disabled={busy} onChange={(e) => void run(() => saveAyarAction({ platforms: { ...data.ayar.platforms, [p]: e.target.checked } }), 'Kaydedildi')} />
              {NAMES[p]}
            </label>
          ))}
          {(['karusel', 'hikaye'] as const).map((k) => (
            <label key={k} className="pl-check">
              <input type="checkbox" checked={data.ayar.kinds[k]} disabled={busy} onChange={(e) => void run(() => saveAyarAction({ kinds: { ...data.ayar.kinds, [k]: e.target.checked } }), 'Kaydedildi')} />
              {k === 'karusel' ? 'Ürün karuselleri' : 'Fiyatlı hikâyeler'}
            </label>
          ))}
          {(['carouselTimes', 'storyTimes'] as const).map((k) => (
            <label key={k} className="pl-times">
              {k === 'carouselTimes' ? 'Karusel saatleri' : 'Hikâye saatleri'}
              <input defaultValue={data.ayar[k].join(', ')} onBlur={(e) => { if (e.target.value !== data.ayar[k].join(', ')) void run(() => saveAyarAction({ [k]: e.target.value.split(',').map((s) => s.trim()) }), 'Saatler kaydedildi'); }} />
            </label>
          ))}
          <p>Saat değişikliği, henüz oluşturulmamış paylaşımlara uygulanır.</p>
        </article>
      )}
    </div>
  );
}

function TierEditor({ tiers, busy, onSave }: { tiers: Kademe[]; busy: boolean; onSave: (t: Kademe[]) => void }) {
  const [rows, setRows] = useState<Kademe[]>(tiers.length ? tiers : [{ label: '', price: '' }]);
  const set = (i: number, patch: Partial<Kademe>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="pl-tiers">
      {rows.map((r, i) => (
        <div key={i}>
          <input aria-label="Kademe" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
          <input aria-label="Fiyat" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
          <button aria-label="Satırı sil" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Sil</button>
        </div>
      ))}
      <div className="pl-actions">
        <button disabled={rows.length >= 7} onClick={() => setRows([...rows, { label: '', price: '' }])}>Satır ekle</button>
        <button className="is-primary" disabled={busy} onClick={() => onSave(rows)}>Onayla</button>
      </div>
    </div>
  );
}
```

Önce `components/admin/Toast.tsx` ve `ConfirmDialog.tsx` açılır; `useToast`/`useConfirm` dönüş biçimi ve onay seçenek adları dosyadakiyle birebir eşlenir.

- [ ] **Step 4: `app/admin/paylasim/paylasim.css`**

```css
.admin-layout .pl { display: grid; gap: 12px; max-width: 900px; min-width: 0; }
.admin-layout .pl h2 { font-size: 15px; margin: 10px 0 6px; }
.admin-layout .pl button { min-height: 44px; padding: 0 14px; border: 1px solid var(--ink-3); border-radius: 8px; background: var(--paper); color: var(--ink); cursor: pointer; }
.admin-layout .pl button:disabled { opacity: .5; cursor: default; }
.admin-layout .pl button.is-primary, .admin-layout .pl-tabs button[aria-current="true"] { background: var(--brand); border-color: var(--brand); color: var(--paper); }
.admin-layout .pl input, .admin-layout .pl textarea { font-size: 16px; min-height: 44px; padding: 8px; border: 1px solid var(--ink-3); border-radius: 8px; width: 100%; min-width: 0; }
.admin-layout .pl summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
.pl-tabs, .pl-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pl-card { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--paper-2); border-radius: 12px; background: var(--paper); min-width: 0; }
.pl-card header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; }
.pl-images { display: flex; gap: 6px; overflow-x: auto; }
.pl-images img { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; flex: none; }
.pl-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
.admin-layout .pl .pl-pick button { padding: 2px; height: auto; }
.admin-layout .pl .pl-pick button[aria-pressed="true"] { border: 3px solid var(--brand); }
.pl-pick img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.pl-targets { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; overflow-wrap: anywhere; }
.pl-tiers { display: grid; gap: 8px; }
.pl-tiers > div:not(.pl-actions) { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; gap: 6px; }
.admin-layout .pl .pl-check { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.admin-layout .pl .pl-check input { width: 22px; min-height: 22px; }
.pl-times { display: grid; gap: 4px; }
```

- [ ] **Step 5:** `npx jest` PASS, `npm run lint` temiz, `npx tsc --noEmit -p . 2>&1 | grep -v __tests__` içinde `paylasim` yok. Commit "Paylaşım: tek panel".

---

### Task 9: Derleme, yayın ve belgeler

**Files:**
- Modify: `docs/superpowers/specs/2026-11-28-paylasim-sistemi-design.md`, `docs/ADMIN_PANEL.md`, `docs/CALISMA_GUNLUGU.md`, `docs/DEVAM_NOTLARI.md`

- [ ] **Step 1:** Tasarım belgesine yukarıdaki dört değişikliği işle; `ADMIN_PANEL.md` tablosuna `/admin/paylasim` satırı ve cron sırasına `paylasim` adımını ekle.
- [ ] **Step 2:** `npm run build` (yayından önce yerelde; `.next` temizlenmiş olarak) → hatasız.
- [ ] **Step 3:** Panel sahte veriyle 360 px ve masaüstünde kontrol edilir (gerçek sırlar kopyalanmaz); taşma yok.
- [ ] **Step 4:** PR aç, birleştir. Sunucuda yedek + imaj etiketi, `git archive HEAD | ssh … tar -x`, `docker compose up -d --build`, `healthy` kontrolü.
- [ ] **Step 5:** Canlıda: mod `onizleme` olduğunu doğrula; bir cron turunda `paylasim` adımının `önizleme modu` döndüğünü `~/.kartabaski-nobet/cron.json` içinden kontrol et. Hiçbir platformda yeni paylaşım olmamalı.
- [ ] **Step 6:** Çalışma günlüğü ve devir notları. Kullanıcıya: panelde fiyatları onaylayın, sırayı kontrol edin, "Canlıya al" sizin onayınız.
