import 'server-only';

import { adminDb } from './firebase-admin';
import { sendTelegramText } from './notify';
import { listOrders } from './orders';
import { buildMachineReport, computeMachine, toSnapshotFields, weeklyDue, type MachineSnapshot } from './machine';

// Özet günde en fazla bir kez hesaplanıp tek belgeye (machine_stats/main) yazılır; cron her turda
// yalnızca bu belgeyi okur (Spark kotasını korur). Haftalık rapor pazartesi 09:00 TSİ sonrası bir kez gider.
const ref = () => adminDb.collection('machine_stats').doc('main');
const FRESH_MS = 20 * 3600 * 1000;

export async function getMachineSnapshot(): Promise<MachineSnapshot | null> {
  const snap = (await ref().get()).data() as MachineSnapshot | undefined;
  return snap?.updatedAt ? snap : null;
}

export async function machineReportText(now = Date.now(), days = 7): Promise<string> {
  return buildMachineReport(computeMachine({ orders: await listOrders(), now, days }), days);
}

export interface MachineRun { ran: boolean; weekly?: boolean; reason?: string }

/** Cron turunda çağrılır: günlük özeti tazeler, zamanı geldiyse haftalık raporu Telegram'a yollar. */
export async function runMachineStep(now = Date.now(), force = false): Promise<MachineRun> {
  const cur = (await ref().get()).data() as MachineSnapshot | undefined;
  const stale = force || !cur || now - Number(cur.updatedAt || 0) >= FRESH_MS;
  const weekly = weeklyDue(now, cur?.lastWeeklyAt);
  if (!stale && !weekly) return { ran: false, reason: 'güncel' };

  const orders = await listOrders();
  if (stale) {
    await ref().set(toSnapshotFields(computeMachine({ orders, now }), now), { merge: true });
  }
  if (weekly) {
    // Gönderilemese de işaretlenir: her cron turunda tekrar denenmesin
    await ref().set({ lastWeeklyAt: now }, { merge: true });
    await sendTelegramText(buildMachineReport(computeMachine({ orders, now, days: 7 }), 7));
  }
  return { ran: true, weekly };
}
