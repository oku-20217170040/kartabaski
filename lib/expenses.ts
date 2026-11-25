import 'server-only';

import { adminDb } from './firebase-admin';
import type { ExpenseRecord } from './expense-types';
import { dueMonths, type RecurringExpense } from './recurring';

const COL = 'expenses';

export async function listExpenses(): Promise<ExpenseRecord[]> {
  const snap = await adminDb.collection(COL).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        date: Number(x.date) || 0,
        category: x.category,
        amountTRY: Number(x.amountTRY) || 0,
        ...(x.note ? { note: String(x.note) } : {}),
        ...(x.recurringId ? { recurringId: String(x.recurringId) } : {}),
      } as ExpenseRecord;
    })
    .sort((a, b) => b.date - a.date);
}

export async function saveExpense(data: Omit<ExpenseRecord, 'id'>, id?: string): Promise<string> {
  const payload = { ...data, updatedAt: Date.now() };
  if (id) {
    await adminDb.collection(COL).doc(id).set(payload, { merge: true });
    return id;
  }
  const ref = await adminDb.collection(COL).add({ ...payload, createdAt: Date.now() });
  return ref.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await adminDb.collection(COL).doc(id).delete();
}

// ── Aylık tekrarlayan giderler ───────────────────────────────────────────────

const REC = 'recurring_expenses';

export async function listRecurring(): Promise<RecurringExpense[]> {
  const snap = await adminDb.collection(REC).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RecurringExpense, 'id'>) }))
    .sort((a, b) => a.startMonth.localeCompare(b.startMonth));
}

export async function saveRecurring(data: Omit<RecurringExpense, 'id'>, id?: string): Promise<string> {
  if (id) {
    await adminDb.collection(REC).doc(id).set({ ...data, updatedAt: Date.now() }, { merge: true });
    return id;
  }
  const ref = await adminDb.collection(REC).add({ ...data, createdAt: Date.now() });
  return ref.id;
}

/** Şablonu siler; daha önce oluşmuş giderler muhasebede kalır. */
export async function deleteRecurring(id: string): Promise<void> {
  await adminDb.collection(REC).doc(id).delete();
}

/**
 * Aktif şablonlardan vadesi gelmiş ayların giderlerini oluşturur.
 * Kimlik sabit (şablon+ay) ve create() kullanılır: aynı ay iki kez yazılmaz, mevcut kayıt ezilmez
 * (tutarı sonradan değişen şablon geçmiş ayları değiştirmez). Oluşturulan kayıt sayısını döner.
 */
export async function generateRecurringExpenses(now: Date = new Date()): Promise<number> {
  const templates = (await listRecurring()).filter((t) => t.active);
  let created = 0;
  for (const t of templates) {
    for (const due of dueMonths(t, now)) {
      try {
        await adminDb.collection(COL).doc(`rec_${t.id}_${due.month}`).create({
          date: due.date,
          category: t.category,
          amountTRY: t.amountTRY,
          ...(t.note ? { note: t.note } : {}),
          recurringId: t.id,
          createdAt: Date.now(),
        });
        created++;
      } catch {
        // zaten var (ALREADY_EXISTS): atla
      }
    }
  }
  return created;
}
