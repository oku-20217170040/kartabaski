import type { MonthBucket } from '@/lib/finance-stats';
import { fmtTL } from '@/lib/finance-format';

/** Aylık ciro / kâr / gider grafiği: saf CSS sütunlar (ek kütüphane yok). */
export default function MonthChart({ months }: { months: MonthBucket[] }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.revenue, Math.max(0, m.profit), m.expenses]));
  const h = (v: number) => `${Math.max(0, Math.round((v / max) * 100))}%`;
  const empty = months.every((m) => m.revenue === 0 && m.expenses === 0);
  return (
    <div>
      <div className="fin-chart" role="img" aria-label="Aylık ciro, kâr ve gider grafiği">
        {months.map((m) => (
          <div key={m.key} className="fin-chart-col" title={`${m.key} · ciro ${fmtTL(m.revenue)} · kâr ${fmtTL(m.profit)} · gider ${fmtTL(m.expenses)}`}>
            <div className="fin-chart-bars">
              <span className="fin-bar fin-bar-rev" style={{ height: h(m.revenue) }} />
              <span className="fin-bar fin-bar-profit" style={{ height: h(m.profit) }} />
              <span className="fin-bar fin-bar-exp" style={{ height: h(m.expenses) }} />
            </div>
            <span className="fin-chart-label">{m.label}</span>
          </div>
        ))}
      </div>
      {empty && <p className="fin-hint">Bu aralıkta henüz kayıt yok.</p>}
      <div className="fin-legend">
        <span><i className="fin-bar-rev" />Ciro</span>
        <span><i className="fin-bar-profit" />Brüt kâr</span>
        <span><i className="fin-bar-exp" />Gider</span>
      </div>
    </div>
  );
}
