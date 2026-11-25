'use server';

import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { displayTitle } from './format';
import { listSales, saveSale, deleteSale } from './finance';
import { listExpenses, saveExpense, deleteExpense, listRecurring, saveRecurring, deleteRecurring, generateRecurringExpenses } from './expenses';
import { computeFinanceSummary, type FinanceSummary } from './finance-stats';
import { SaleInputSchema, ExpenseInputSchema, RecurringInputSchema } from './finance-schemas';
import type { SaleRecord, SaleInput } from './finance-types';
import type { ExpenseRecord } from './expense-types';
import type { RecurringExpense } from './recurring';

export interface PickerProduct { id: string; title: string; category: string; priceMin: number }

/** Genel Bakış için son 12 ayın özeti. */
export async function getFinanceSummaryAction(): Promise<FinanceSummary> {
  await requireAdmin();
  const [sales, expenses] = await Promise.all([listSales(), listExpenses()]);
  return computeFinanceSummary(sales, expenses, Date.now());
}

/** Muhasebe sayfası verisi: satışlar, giderler ve ürün seçici listesi. */
export async function getFinanceDataAction(): Promise<{ sales: SaleRecord[]; expenses: ExpenseRecord[]; products: PickerProduct[] }> {
  await requireAdmin();
  const [sales, expenses, products] = await Promise.all([listSales(), listExpenses(), getProductsServer()]);
  return {
    sales,
    expenses,
    products: products.map((p) => ({ id: p.id, title: displayTitle(p.title), category: p.category, priceMin: p.priceMin })),
  };
}

export async function saveSaleAction(data: SaleInput, id?: string): Promise<string> {
  await requireAdmin();
  const parsed = SaleInputSchema.safeParse(data);
  if (!parsed.success) throw new Error('Satış bilgileri geçersiz.');
  return saveSale(parsed.data, id);
}

export async function deleteSaleAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteSale(id);
}

export async function getExpensesAction(): Promise<ExpenseRecord[]> {
  await requireAdmin();
  return listExpenses();
}

export async function saveExpenseAction(data: Omit<ExpenseRecord, 'id'>, id?: string): Promise<string> {
  await requireAdmin();
  const parsed = ExpenseInputSchema.safeParse(data);
  if (!parsed.success) throw new Error('Gider bilgileri geçersiz.');
  return saveExpense({ ...parsed.data, amountTRY: Math.round(parsed.data.amountTRY) }, id);
}

export async function deleteExpenseAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteExpense(id);
}

export async function getRecurringAction(): Promise<RecurringExpense[]> {
  await requireAdmin();
  return listRecurring();
}

/** Şablonu kaydeder ve vadesi gelmiş ayların giderlerini oluşturur; oluşan kayıt sayısını döner. */
export async function saveRecurringAction(data: Omit<RecurringExpense, 'id'>, id?: string): Promise<number> {
  await requireAdmin();
  const parsed = RecurringInputSchema.safeParse(data);
  if (!parsed.success) throw new Error('Şablon bilgileri geçersiz.');
  await saveRecurring({ ...parsed.data, amountTRY: Math.round(parsed.data.amountTRY) }, id);
  return generateRecurringExpenses();
}

export async function deleteRecurringAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteRecurring(id);
}

export async function generateRecurringAction(): Promise<number> {
  await requireAdmin();
  return generateRecurringExpenses();
}
