import type { ExpenseCategory } from './expense-types';

/** Aylık tekrarlayan gider şablonu (`recurring_expenses` koleksiyonu, yalnızca Admin SDK). */
export interface RecurringExpense {
  id: string;
  category: ExpenseCategory;
  amountTRY: number;
  dayOfMonth: number;   // 1–31 (kısa aylarda ayın son gününe iner)
  startMonth: string;   // 'YYYY-MM' — ilk gider bu aydan başlar
  note?: string;
  active: boolean;
}

export interface DueExpense {
  /** Aynı şablon + ay için tek kayıt: yinelenmeyi engelleyen sabit kimlik parçası */
  month: string;
  date: number; // gider tarihi (ms, öğlen 12:00)
}

const pad = (n: number) => String(n).padStart(2, '0');
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * Şablon için, `now` anına kadar oluşturulması gereken tüm aylar.
 * Gelecekteki günler (bu ay henüz gelmemiş gün) dahil edilmez; kaçırılan geçmiş aylar tamamlanır.
 */
export function dueMonths(t: Pick<RecurringExpense, 'dayOfMonth' | 'startMonth'>, now: Date = new Date()): DueExpense[] {
  const [sy, sm] = t.startMonth.split('-').map(Number);
  if (!sy || !sm) return [];
  const out: DueExpense[] = [];
  // En fazla 60 ay geriye (hatalı başlangıç tarihine karşı güvenlik)
  let y = sy;
  let m = sm;
  for (let i = 0; i < 60; i++) {
    const daysInMonth = new Date(y, m, 0).getDate();
    const day = Math.min(Math.max(t.dayOfMonth, 1), daysInMonth);
    const date = new Date(y, m - 1, day, 12, 0, 0);
    if (date.getTime() > now.getTime()) break;
    out.push({ month: `${y}-${pad(m)}`, date: date.getTime() });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
