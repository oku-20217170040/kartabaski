// Search Console verisi için tarayıcıda da kullanılabilen biçimleme yardımcıları (Node `crypto` içermez).

export interface GscRow { key: string; clicks: number; impressions: number; ctr: number; position: number }

export const fmtCtr = (ctr: number) => `${(ctr * 100).toFixed(1).replace('.', ',')}%`;
export const fmtPos = (p: number) => p.toFixed(1).replace('.', ',');

/** Yüzde değişim (önceki 0 ise null: "yeni" olarak gösterilir). */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return (cur - prev) / prev;
}
