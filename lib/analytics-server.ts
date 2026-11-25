import 'server-only';

import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { DailyStats } from './analytics-types';
import { istanbulParts, type Patch } from './analytics-utils';
import { dayRange, emptyDay, mergeDays, normalizeDay } from './analytics-stats';

// Günlük sayaçlar `analytics_daily/{YYYY-MM-DD}_{0..4}` belgelerine yazılır. Tek belgeye saniyede ~1 yazma
// sınırı olduğundan rastgele 5 parçaya bölünür; okurken toplanır. Analitik hatası siteyi asla etkilemez.
const COL = 'analytics_daily';
const SHARDS = 5;

function toIncrements(p: Patch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === 'number' ? FieldValue.increment(v) : toIncrements(v);
  return out;
}

export async function writePatch(day: string, patch: Patch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const shard = Math.floor(Math.random() * SHARDS);
  await adminDb.collection(COL).doc(`${day}_${shard}`).set(toIncrements(patch), { merge: true });
}

/** Sunucu tarafında kesin bilinen olaylar (talep kaydı vb.): tarayıcıya güvenmeden sayılır. */
export async function recordServerEvent(name: 'cart_send'): Promise<void> {
  try {
    await writePatch(istanbulParts().day, { ev: { [name]: 1 } });
  } catch (e) {
    console.error('[analytics] olay yazılamadı:', e);
  }
}

/** Bugün dahil son `days` günün özetleri (eksik günler boş gelir), eskiden yeniye. */
export async function readDailyStats(days: number): Promise<DailyStats[]> {
  const n = Math.min(Math.max(Math.floor(days) || 1, 1), 400);
  const range = dayRange(istanbulParts().day, n);
  const snap = await adminDb
    .collection(COL)
    .where(FieldPath.documentId(), '>=', range[0])
    .where(FieldPath.documentId(), '<=', `${range[range.length - 1]}_~`)
    .get();

  const byDay = new Map<string, DailyStats>(range.map((d) => [d, emptyDay(d)]));
  for (const doc of snap.docs) {
    const day = doc.id.slice(0, 10);
    const cur = byDay.get(day);
    if (cur) byDay.set(day, mergeDays(cur, normalizeDay(day, doc.data())));
  }
  return range.map((d) => byDay.get(d)!);
}
