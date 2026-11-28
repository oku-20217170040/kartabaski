import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import type { SocialPlatform } from '../social-types';
import { durumHesapla, yenilenecekler, type PlanSonuc } from './plan';
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

/** Henüz gönderilmemiş sırayı siler; planlayıcı yeniden doldurur. */
export async function clearPending(): Promise<void> {
  const snap = await col().where('status', '==', 'bekliyor').get();
  const keys = yenilenecekler(snap.docs.map((d) => d.data() as Paylasim));
  if (!keys.length) return;
  const batch = adminDb.batch();
  for (const key of keys) batch.delete(col().doc(key));
  await batch.commit();
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
