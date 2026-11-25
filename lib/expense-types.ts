// Giderler `expenses` koleksiyonunda tutulur (yalnızca Admin SDK).
export const EXPENSE_CATEGORIES = [
  'Kira',
  'Boş kupa / fincan',
  'Süblimasyon kağıdı',
  'Mürekkep',
  'Kutu / ambalaj',
  'Kargo',
  'Reklam',
  'Elektrik / Su / İnternet',
  'Makine bakım / onarım',
  'Vergi / Harç',
  'Diğer',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseRecord {
  id: string;
  date: number;          // gider tarihi (ms)
  category: ExpenseCategory;
  amountTRY: number;
  note?: string;
  recurringId?: string; // aylık tekrarlayan şablondan otomatik oluşturulduysa
}
