// Muhasebe/makine ekranlarının ortak biçimleyicileri (saf).
const TL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

export const fmtTL = (n: number): string => `${n < 0 ? '-' : ''}${TL.format(Math.round(Math.abs(n)))} ₺`;

export const fmtPct = (n: number, digits = 0): string => `%${(n * 100).toFixed(digits).replace('.', ',')}`;

export const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/** <input type="date"> değeri (yerel gün). */
export const toDateInput = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** <input type="date"> değerini yerel öğlen 12:00 zamanına çevirir (gün kayması olmasın). */
export const fromDateInput = (s: string): number => {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return Date.now();
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
};
