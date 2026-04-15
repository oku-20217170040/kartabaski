'server-only';

import { adminDb } from './firebase-admin';
import { ConfiguratorCup, ConfiguratorDesign } from '@/types';

const CUPS_COL    = 'configurator_cups';
const DESIGNS_COL = 'configurator_designs';

// ── Bardak CRUD ───────────────────────────────────────────────────────────────

export async function getCups(): Promise<ConfiguratorCup[]> {
  const snap = await adminDb.collection(CUPS_COL).orderBy('order').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConfiguratorCup));
}

export async function createCup(data: Omit<ConfiguratorCup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await adminDb.collection(CUPS_COL).add({
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateCup(id: string, data: Partial<ConfiguratorCup>): Promise<void> {
  await adminDb.collection(CUPS_COL).doc(id).update({ ...data, updatedAt: Date.now() });
}

export async function deleteCup(id: string): Promise<void> {
  await adminDb.collection(CUPS_COL).doc(id).delete();
}

// ── Tasarım CRUD ──────────────────────────────────────────────────────────────

export async function getDesigns(): Promise<ConfiguratorDesign[]> {
  const snap = await adminDb.collection(DESIGNS_COL).orderBy('order').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConfiguratorDesign));
}

export async function createDesign(data: Omit<ConfiguratorDesign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await adminDb.collection(DESIGNS_COL).add({
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateDesign(id: string, data: Partial<ConfiguratorDesign>): Promise<void> {
  await adminDb.collection(DESIGNS_COL).doc(id).update({ ...data, updatedAt: Date.now() });
}

export async function deleteDesign(id: string): Promise<void> {
  await adminDb.collection(DESIGNS_COL).doc(id).delete();
}
