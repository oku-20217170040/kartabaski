import { fmtTL } from '@/lib/finance-format';
import type { GroupRow } from '@/lib/finance-stats';

/** Kategori / kanal dökümü: yatay çubuklar (ciro payı, kâr ve adet bilgisiyle). */
export default function BarList({ rows, empty, hideMeta = false }: { rows: GroupRow[]; empty: string; hideMeta?: boolean }) {
  if (rows.length === 0) return <p className="fin-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div className="fin-barlist">
      {rows.map((r) => (
        <div key={r.name} className="fin-barlist-row">
          <span className="fin-barlist-name">{r.name}</span>
          <span className="fin-barlist-val">{fmtTL(r.revenue)}</span>
          <div className="fin-barlist-track"><div className="fin-barlist-fill" style={{ width: `${Math.round((r.revenue / max) * 100)}%` }} /></div>
          {!hideMeta && <span className="fin-barlist-meta">{r.units} adet · {r.count} satır · kâr {fmtTL(r.profit)}</span>}
        </div>
      ))}
    </div>
  );
}
