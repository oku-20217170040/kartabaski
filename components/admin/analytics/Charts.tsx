'use client';

import type { SeriesPoint } from '@/lib/analytics-stats';
import { fmtInt } from '@/lib/analytics-stats';

/** Eksen değeri: büyük sayılarda yuvarlak (ör. 1.234 → 1,2 B). */
const axis = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)} B` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} B` : fmtInt(n));

/** Sayfa görüntüleme (açık çubuk) ve ziyaretçi (yeşil çubuk) trendi; sol eksende değerler, en yoğun gün işaretli. */
export function TrendChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) return <p className="st-muted">Veri yok.</p>;
  const max = Math.max(1, ...points.map((p) => p.pv));
  const w = 100 / points.length;
  const dense = points.length > 16;
  const every = Math.ceil(points.length / 12); // en fazla ~12 tarih etiketi
  const peak = points.reduce((b, p, i) => (p.uv > points[b].uv ? i : b), 0);

  return (
    <div className="st-trend">
      <div className="st-axis"><span>{axis(max)}</span><span>{axis(max / 2)}</span><span>0</span></div>
      <div>
        <div className="st-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Ziyaret trendi">
            {[0, 50].map((y) => <line key={y} className="st-grid" x1="0" x2="100" y1={y + 0.5} y2={y + 0.5} />)}
            {points.map((p, i) => {
              const hPv = (p.pv / max) * 98;
              const hUv = (p.uv / max) * 98;
              const gap = w * (dense ? 0.12 : 0.22);
              return (
                <g key={i}>
                  <title>{`${p.label} ${p.sub}: ${fmtInt(p.uv)} ziyaretçi · ${fmtInt(p.pv)} görüntüleme · ${fmtInt(p.sess)} oturum`}</title>
                  <rect className="st-bar-pv" x={i * w + gap} width={Math.max(w - gap * 2, 0.2)} y={100 - hPv} height={hPv} />
                  <rect className={`st-bar-uv ${i === peak && p.uv > 0 ? 'st-peak' : ''}`} x={i * w + gap} width={Math.max(w - gap * 2, 0.2)} y={100 - hUv} height={hUv} />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="st-xlabels" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
          {points.map((p, i) => <span key={i}>{i % every === 0 || i === points.length - 1 ? <>{p.label}<small>{p.sub}</small></> : ''}</span>)}
        </div>
        <div className="st-legend">
          <span><i className="st-dot st-dot-uv" />Ziyaretçi</span>
          <span><i className="st-dot st-dot-pv" />Sayfa görüntüleme</span>
          {points[peak].uv > 0 && <span className="st-muted">En yoğun: {points[peak].label} {points[peak].sub} ({fmtInt(points[peak].uv)} ziyaretçi)</span>}
        </div>
      </div>
    </div>
  );
}

export interface ValuePoint { label: string; sub?: string; value: number; title?: string }

/** Tek seri çubuk grafik (Google tıklama/gösterim, haftanın günleri vb.); sol eksende değerler. */
export function ValueBars({ points, color = 'accent', height = 160 }: { points: ValuePoint[]; color?: 'accent' | 'blue'; height?: number }) {
  if (points.length === 0 || points.every((p) => p.value === 0)) return <p className="st-muted">Bu aralıkta veri yok.</p>;
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 100 / points.length;
  const every = Math.ceil(points.length / 12);
  return (
    <div className="st-trend">
      <div className="st-axis" style={{ height }}><span>{axis(max)}</span><span>{axis(max / 2)}</span><span>0</span></div>
      <div>
        <div className="st-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" style={{ height }}>
            {[0, 50].map((y) => <line key={y} className="st-grid" x1="0" x2="100" y1={y + 0.5} y2={y + 0.5} />)}
            {points.map((p, i) => {
              const h = (p.value / max) * 98;
              const gap = w * (points.length > 16 ? 0.12 : 0.22);
              return (
                <rect key={i} className={color === 'blue' ? 'st-bar-alt' : 'st-bar-uv'} x={i * w + gap} width={Math.max(w - gap * 2, 0.2)} y={100 - h} height={h}>
                  <title>{p.title ?? `${p.label}${p.sub ? ` ${p.sub}` : ''}: ${fmtInt(p.value)}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        <div className="st-xlabels" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
          {points.map((p, i) => <span key={i}>{i % every === 0 || i === points.length - 1 ? <>{p.label}{p.sub && <small>{p.sub}</small>}</> : ''}</span>)}
        </div>
      </div>
    </div>
  );
}

/** Önceki döneme göre değişim rozeti: ▲ %12 (yeşil) / ▼ %8 (kırmızı). `invert`: düşüş iyi (ör. hemen çıkma, sıra). */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="st-delta flat">yeni</span>;
  const pct = Math.round(value * 100);
  if (pct === 0) return <span className="st-delta flat">±%0</span>;
  const good = invert ? pct < 0 : pct > 0;
  return <span className={`st-delta ${good ? 'up' : 'down'}`}>{pct > 0 ? '▲' : '▼'} %{Math.abs(pct)}</span>;
}

const GROUP_CLASS: Record<string, string> = {
  'Arama motoru': 'st-g0',
  'Sosyal medya': 'st-g1',
  'Yapay zeka': 'st-g2',
  'Doğrudan': 'st-g3',
  'Diğer siteler': 'st-g4',
};

/** Kaynak gruplarının tek yığılmış çubukta payları ve açıklaması. */
export function GroupBar({ items }: { items: { group: string; value: number }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <p className="st-muted">Henüz veri yok.</p>;
  return (
    <div>
      <div className="st-stack">
        {items.filter((i) => i.value > 0).map((i) => (
          <div key={i.group} className={GROUP_CLASS[i.group] ?? 'st-g4'} style={{ width: `${(i.value / total) * 100}%` }} title={`${i.group}: ${fmtInt(i.value)} oturum`} />
        ))}
      </div>
      <div className="st-stack-legend">
        {items.map((i) => (
          <div key={i.group}>
            <i className={GROUP_CLASS[i.group] ?? 'st-g4'} />
            <span>{i.group}</span>
            <b>{fmtInt(i.value)}</b>
            <small>%{Math.round((i.value / total) * 100)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface BarItem { label: string; value: number; hint?: string }

/** Yatay çubuklu sıralı liste (kaynak, cihaz, şehir, arama…). */
export function BarList({ items, total, empty = 'Henüz veri yok.' }: { items: BarItem[]; total?: number; empty?: string }) {
  if (items.length === 0) return <p className="st-muted">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="st-list">
      {items.map((it) => (
        <div key={it.label} className="st-row" title={it.hint}>
          <div className="st-row-top">
            <span className="st-label">{it.label}</span>
            <span className="st-val">
              {fmtInt(it.value)}
              {sum > 0 && <small> · %{Math.round((it.value / sum) * 100)}</small>}
            </span>
          </div>
          <div className="st-track"><div className="st-fill" style={{ width: `${(it.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Günün saatlerine göre sayfa görüntüleme dağılımı (0-23). */
export function HourBars({ hours }: { hours: Record<string, number> }) {
  const vals = Array.from({ length: 24 }, (_, h) => hours[String(h)] || 0);
  const max = Math.max(1, ...vals);
  const peak = vals.indexOf(Math.max(...vals));
  return (
    <div>
      <div className="st-hours">
        {vals.map((v, h) => (
          <div key={h} className="st-hour" title={`${String(h).padStart(2, '0')}:00 — ${fmtInt(v)} görüntüleme`}>
            <div className={`st-hour-bar ${h === peak && v > 0 ? 'peak' : ''}`} style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%` }} />
            <span>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>
          </div>
        ))}
      </div>
      {Math.max(...vals) > 0 && <p className="st-hint">En yoğun saat: {String(peak).padStart(2, '0')}:00 (Türkiye saati)</p>}
    </div>
  );
}
