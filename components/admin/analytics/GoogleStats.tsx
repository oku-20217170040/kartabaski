'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSearchPerformanceAction } from '@/lib/actions-analytics';
import type { SearchPerformance } from '@/lib/search-console';
import { IconRefresh } from '@/components/admin/icons';
import { fmtCtr, fmtPos, pctChange, type GscRow } from '@/lib/search-console-format';
import { fmtInt } from '@/lib/analytics-stats';
import { BarList, Delta, ValueBars } from './Charts';

// Google Search Console verisi: Google aramalarında nasıl göründüğümüz (2-3 gün gecikmeli).
const RANGES = [7, 28, 90] as const;
const DEVICE: Record<string, string> = { MOBILE: 'Mobil', DESKTOP: 'Masaüstü', TABLET: 'Tablet' };
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
// Search Console ülke kodları ISO alpha-3 (tur, deu…); yaygın olanlar Türkçe gösterilir
const COUNTRY: Record<string, string> = { tur: 'Türkiye', deu: 'Almanya', usa: 'ABD', gbr: 'Birleşik Krallık', nld: 'Hollanda', fra: 'Fransa', aze: 'Azerbaycan', irq: 'Irak', syr: 'Suriye', rus: 'Rusya', ukr: 'Ukrayna', bgr: 'Bulgaristan' };

const pageLabel = (url: string) => { try { return decodeURIComponent(new URL(url).pathname) || '/'; } catch { return url; } };

export default function GoogleStats() {
  const [days, setDays] = useState<number>(28);
  const [data, setData] = useState<SearchPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    const r = await getSearchPerformanceAction(d).catch(() => ({ ok: false as const, error: 'Yüklenemedi' }));
    if (r.ok) { setData(r.data); setError(null); } else { setData(null); setError(r.error); }
    setLoading(false);
  }, []);
  useEffect(() => { load(days); }, [days, load]);

  const t = data?.totals;
  const p = data?.prevTotals;

  return (
    <>
      <div className="st-toolbar">
        <div className="st-tabs">
          {RANGES.map((r) => <button key={r} className={days === r ? 'on' : ''} onClick={() => setDays(r)} disabled={loading}>{r} gün</button>)}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => load(days)} disabled={loading}><IconRefresh size={16} /> Yenile</button>
        {data && <span className="st-muted">{data.startDate} → {data.endDate} · önceki {days} günle karşılaştırma</span>}
      </div>

      {loading && <div className="st-loading"><div className="spinner" /></div>}
      {error && !loading && (notConnected
        ? <div className="card adm-section"><h2 className="adm-section-title">Search Console bağlı değil</h2><p className="st-muted st-p">{error}</p><p className="st-hint">Bağlandıktan sonra hizmet hesabı e-postasını Search Console&apos;da (Ayarlar → Kullanıcılar ve izinler) kullanıcı olarak ekleyin ve Google Cloud&apos;da &quot;Search Console API&quot;yi etkinleştirin. Site: https://www.kartabaski.com</p></div>
        : <div className="st-error">{error}</div>)}

      {data && t && p && !loading && (
        <>
          <div className="st-stats">
            <div className="card st-stat st-pos"><small>Tıklama</small><strong>{fmtInt(t.clicks)}</strong><em>Google&apos;dan siteye geçiş <Delta value={pctChange(t.clicks, p.clicks)} /></em></div>
            <div className="card st-stat"><small>Gösterim</small><strong>{fmtInt(t.impressions)}</strong><em>sonuçlarda görünme <Delta value={pctChange(t.impressions, p.impressions)} /></em></div>
            <div className="card st-stat"><small>Tıklama oranı</small><strong>{fmtCtr(t.ctr)}</strong><em>gösterimden tıklamaya <Delta value={pctChange(t.ctr, p.ctr)} /></em></div>
            <div className="card st-stat"><small>Ortalama sıra</small><strong>{t.impressions ? fmtPos(t.position) : '—'}</strong><em>küçük sayı daha iyi <Delta value={pctChange(t.position, p.position)} invert /></em></div>
          </div>

          <div className="st-cols">
            <div className="card adm-section">
              <h2 className="adm-section-title">Günlük tıklama</h2>
              <ValueBars points={data.daily.map((r) => dayPoint(r, 'clicks'))} />
            </div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Günlük gösterim</h2>
              <ValueBars color="blue" points={data.daily.map((r) => dayPoint(r, 'impressions'))} />
            </div>
          </div>

          <div className="card adm-section">
            <h2 className="adm-section-title">Aranan kelimeler <span className="st-muted st-h2sub">Google&apos;da hangi aramalarla çıktık</span></h2>
            <GscTable rows={data.queries} keyLabel="Kelime" />
            <p className="st-hint">
              <b>Fırsat:</b> Gösterimi yüksek ama tıklama oranı düşük kelimelerde başlık/açıklama iyileştirmesi tıklamayı artırır. Sıra 1–3 arası ilk sayfanın üstü, 4–10 ilk sayfa.
            </p>
          </div>

          <div className="card adm-section">
            <h2 className="adm-section-title">Google&apos;da görünen sayfalar</h2>
            <GscTable rows={data.pages} keyLabel="Sayfa" fmtKey={pageLabel} />
          </div>

          <div className="st-cols">
            <div className="card adm-section"><h2 className="adm-section-title">Cihaz</h2><BarList items={data.devices.map((r) => ({ label: DEVICE[r.key] ?? r.key, value: r.clicks, hint: `${fmtInt(r.impressions)} gösterim` }))} empty="Veri yok." /></div>
            <div className="card adm-section"><h2 className="adm-section-title">Ülke</h2><BarList items={data.countries.map((r) => ({ label: COUNTRY[r.key] ?? r.key.toUpperCase(), value: r.clicks, hint: `${fmtInt(r.impressions)} gösterim` }))} empty="Veri yok." /></div>
          </div>

          <p className="st-hint">
            Kaynak: Google Search Console ({data.site}). Veri Google tarafında 1–2 gün gecikmeli oturur; en son gün (dün) gün içinde biraz eksik görünebilir. Search Console yalnızca Google aramasını sayar; &quot;Site verileri&quot; sekmesindeki Google oturumlarıyla birebir aynı olmaz
            (ör. bir kişi iki kez tıklarsa ya da reklam engelleyici sayacımızı durdurursa).
          </p>
        </>
      )}
    </>
  );
}

function dayPoint(r: GscRow, field: 'clicks' | 'impressions') {
  const [, m, d] = r.key.split('-').map(Number);
  return { label: String(d), sub: MONTHS[(m || 1) - 1], value: r[field], title: `${d} ${MONTHS[(m || 1) - 1]}: ${fmtInt(r.clicks)} tıklama · ${fmtInt(r.impressions)} gösterim · sıra ${fmtPos(r.position)}` };
}

function GscTable({ rows, keyLabel, fmtKey }: { rows: GscRow[]; keyLabel: string; fmtKey?: (k: string) => string }) {
  if (rows.length === 0) return <p className="st-muted">Bu aralıkta veri yok.</p>;
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead><tr><th>{keyLabel}</th><th className="num">Tıklama</th><th className="num">Gösterim</th><th className="num">Oran</th><th className="num">Sıra</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const opportunity = r.impressions >= 50 && r.ctr < 0.03;
            return (
              <tr key={r.key}>
                <td style={{ wordBreak: 'break-word' }}>{fmtKey ? fmtKey(r.key) : r.key}{opportunity && <span className="st-tag" title="Çok gösterim, az tıklama">fırsat</span>}</td>
                <td className="num">{fmtInt(r.clicks)}</td>
                <td className="num">{fmtInt(r.impressions)}</td>
                <td className="num">{fmtCtr(r.ctr)}</td>
                <td className="num">{fmtPos(r.position)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
