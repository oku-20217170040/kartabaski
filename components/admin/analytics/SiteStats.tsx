'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAnalyticsAction, getProductTitlesAction } from '@/lib/actions-analytics';
import type { DailyStats } from '@/lib/analytics-types';
import { unpathKey, sourceLabel } from '@/lib/analytics-utils';
import { isNoTrack, setNoTrack } from '@/lib/analytics-client';
import {
  avgSeconds, bounceRate, fmtInt, fmtShare, formatDuration, groupSeries, returningShare, sumDays, topEntries, type Grouping,
} from '@/lib/analytics-stats';
import {
  aiBreakdown, blogRows, dayRows, delta, funnel, groupSources, mergeByLabel, productRows, splitPeriods, weekdayAverages,
} from '@/lib/analytics-view';
import { errorMessage } from '@/components/admin/Toast';
import { IconRefresh } from '@/components/admin/icons';
import { BarList, Delta, GroupBar, HourBars, TrendChart, ValueBars } from './Charts';

const RANGES = [7, 30, 90, 365] as const;
const rangeLabel = (d: number) => (d === 365 ? '1 yıl' : `${d} gün`);
const groupFor = (d: number): Grouping => (d <= 30 ? 'day' : d <= 90 ? 'week' : 'month');
const WA_SRC: Record<string, string> = { hero: 'Ana sayfa (üst düğme)', float: 'Yüzen WhatsApp düğmesi', urun: 'Ürün sayfası', sepet: 'Sepet' };
const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

function countryName(code: string): string {
  if (code === 'BILINMIYOR') return 'Bilinmiyor';
  try { return new Intl.DisplayNames(['tr'], { type: 'region' }).of(code) ?? code; } catch { return code; }
}

const list = (m: Record<string, number>, n = 8, map?: (k: string) => string) =>
  topEntries(map ? mergeByLabel(m, map) : m, n).map(([k, v]) => ({ label: k, value: v }));

export default function SiteStats() {
  const [days, setDays] = useState<number>(30);
  const [raw, setRaw] = useState<DailyStats[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [noTrack, setNoTrackState] = useState(false);

  useEffect(() => { setNoTrackState(isNoTrack()); getProductTitlesAction().then(setTitles).catch(() => {}); }, []);

  // 7 ve 30 günde önceki dönemle karşılaştırmak için iki kat gün okunur (90/365'te okuma kotası için okunmaz)
  const compare = days <= 30;
  const load = (d: number) => {
    setLoading(true);
    setError('');
    getAnalyticsAction(d <= 30 ? d * 2 : d)
      .then(setRaw)
      .catch((e) => setError(errorMessage(e, 'Veriler yüklenemedi.')))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const { cur, prev } = useMemo(() => splitPeriods(raw, days), [raw, days]);
  const sum = useMemo(() => sumDays(cur), [cur]);
  const psum = useMemo(() => (compare && prev ? sumDays(prev) : null), [compare, prev]);
  const series = useMemo(() => groupSeries(cur, groupFor(days)), [cur, days]);
  const rows = useMemo(() => dayRows(cur), [cur]);
  const today = cur[cur.length - 1];
  const yesterday = cur[cur.length - 2];
  const title = (slug: string) => titles[slug] ?? slug;

  const sources = useMemo(() => groupSources(sum.ref), [sum.ref]);
  const ai = useMemo(() => aiBreakdown(sum.ref, sum.utm), [sum.ref, sum.utm]);
  const aiTotal = ai.reduce((s, x) => s + x.value, 0);
  const prods = useMemo(() => productRows(sum, 15), [sum]);
  const blogs = useMemo(() => blogRows(sum, 10), [sum]);
  const steps = useMemo(() => funnel(sum), [sum]);
  const hasUnique = prods.some((p) => p.unique > 0);
  const wa = sum.ev.whatsapp || 0;
  const cartAdd = sum.ev.cart_add || 0;
  const d = (k: number, p: number | undefined) => (psum ? delta(k, p ?? 0) : undefined);

  return (
    <>
      <div className="st-toolbar">
        <div className="st-tabs">
          {RANGES.map((r) => <button key={r} className={days === r ? 'on' : ''} onClick={() => { setDays(r); setOpenDay(null); }}>{rangeLabel(r)}</button>)}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => load(days)} disabled={loading}><IconRefresh size={16} /> Yenile</button>
        {compare && <span className="st-muted">Yüzdeler: önceki {rangeLabel(days)} ile karşılaştırma</span>}
      </div>

      {error && <div className="st-error">{error}</div>}
      {loading && <div className="st-loading"><div className="spinner" /></div>}

      {!loading && !error && sum.pv === 0 && (
        <div className="card adm-section"><h2 className="adm-section-title">Bu aralıkta veri yok</h2><p className="st-muted">Ziyaretçi geldikçe burada görünür. Bu cihaz sayılmıyorsa aşağıdan açabilirsiniz.</p></div>
      )}

      {!loading && !error && sum.pv > 0 && (
        <>
          {/* ── Özet ── */}
          <div className="st-stats">
            <div className="card st-stat">
              <small>Bugün</small><strong>{fmtInt(today?.uv || 0)}</strong>
              <em>ziyaretçi · dün {fmtInt(yesterday?.uv || 0)} {yesterday && <Delta value={delta(today?.uv || 0, yesterday.uv)} />}</em>
            </div>
            <div className="card st-stat">
              <small>Ziyaretçi ({rangeLabel(days)})</small><strong>{fmtInt(sum.uv)}</strong>
              <em>günde ort. {fmtInt(sum.uv / Math.max(cur.length, 1))} {psum && <Delta value={d(sum.uv, psum.uv) ?? null} />}</em>
            </div>
            <div className="card st-stat">
              <small>Sayfa görüntüleme</small><strong>{fmtInt(sum.pv)}</strong>
              <em>oturum başına {sum.sess ? (sum.pv / sum.sess).toFixed(1).replace('.', ',') : '0'} sayfa {psum && <Delta value={d(sum.pv, psum.pv) ?? null} />}</em>
            </div>
            <div className="card st-stat">
              <small>Sayfada kalma</small><strong>{formatDuration(avgSeconds(sum))}</strong>
              <em>sayfa başına ort. {psum && <Delta value={d(avgSeconds(sum), avgSeconds(psum)) ?? null} />}</em>
            </div>
            <div className="card st-stat">
              <small>Hemen çıkma</small><strong>{fmtShare(bounceRate(sum))}</strong>
              <em>tek sayfa bakıp çıkan {psum && <Delta value={d(bounceRate(sum), bounceRate(psum)) ?? null} invert />}</em>
            </div>
            <div className="card st-stat st-pos">
              <small>WhatsApp tıklaması</small><strong>{fmtInt(wa)}</strong>
              <em>{sum.sess ? fmtShare(wa / sum.sess) : '%0'} oturumda {psum && <Delta value={d(wa, psum.ev.whatsapp) ?? null} />}</em>
            </div>
            <div className="card st-stat st-pos">
              <small>Sepete ekleme</small><strong>{fmtInt(cartAdd)}</strong>
              <em>{fmtInt(sum.ev.cart_send || 0)} sepet gönderildi {psum && <Delta value={d(cartAdd, psum.ev.cart_add) ?? null} />}</em>
            </div>
            <div className="card st-stat">
              <small>Geri dönen ziyaretçi</small><strong>{fmtShare(returningShare(sum))}</strong>
              <em>{fmtInt(sum.newV)} yeni ziyaretçi</em>
            </div>
          </div>

          {/* ── Trend ── */}
          <div className="card adm-section">
            <h2 className="adm-section-title">Ziyaret trendi <span className="st-muted st-h2sub">{groupFor(days) === 'day' ? 'günlük' : groupFor(days) === 'week' ? 'haftalık' : 'aylık'}</span></h2>
            <TrendChart points={series} />
          </div>

          {/* ── Hunisi ── */}
          <div className="card adm-section">
            <h2 className="adm-section-title">Ziyaretten siparişe <span className="st-muted st-h2sub">{rangeLabel(days)}</span></h2>
            <BarList items={steps.filter((s) => s.value > 0)} total={0} empty="Henüz etkileşim yok." />
            <p className="st-hint">Sipariş WhatsApp&apos;tan tamamlanır: WhatsApp tıklaması ve sepet gönderimi ürünlerin gerçek ilgi göstergesidir.</p>
          </div>

          {/* ── Gün gün ── */}
          <div className="card adm-section">
            <h2 className="adm-section-title">Gün gün <span className="st-muted st-h2sub">satıra dokun: o günün kaynakları, ürünleri ve cihazları</span></h2>
            <div className="st-table-wrap st-days">
              <table className="st-table">
                <thead><tr><th>Gün</th><th className="num">Ziyaretçi</th><th className="num">Yeni</th><th className="num">Görüntüleme</th><th className="num">Ort. süre</th><th className="num">Hemen çıkma</th><th className="num">WhatsApp</th><th className="num">Sepet</th><th>En çok kaynak</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const day = cur.find((x) => x.day === r.day)!;
                    const open = openDay === r.day;
                    return [
                      <tr key={r.day} className={`st-dayrow ${open ? 'open' : ''}`} onClick={() => setOpenDay(open ? null : r.day)}>
                        <td><b>{fmtDay(r.day)}</b> <small className="st-muted">{r.weekday}</small></td>
                        <td className="num">{fmtInt(r.uv)}</td>
                        <td className="num">{fmtInt(r.newV)}</td>
                        <td className="num">{fmtInt(r.pv)}</td>
                        <td className="num">{r.avgSec ? formatDuration(r.avgSec) : '—'}</td>
                        <td className="num">{r.sess ? fmtShare(r.bounce) : '—'}</td>
                        <td className="num">{r.wa || '—'}</td>
                        <td className="num">{r.cart || '—'}</td>
                        <td>{r.topSource ?? '—'}</td>
                      </tr>,
                      open && (
                        <tr key={`${r.day}-d`} className="st-daydetail">
                          <td colSpan={9}>
                            <div className="st-detail-grid">
                              <div><h3>Kaynaklar</h3><BarList items={list(day.ref, 6, sourceLabel)} /></div>
                              <div><h3>Bakılan ürünler</h3><BarList items={topEntries(day.prod, 6).map(([k, v]) => ({ label: title(k), value: v }))} empty="Ürün görüntülenmedi." /></div>
                              <div><h3>Cihaz</h3><BarList items={list(day.dev)} /><h3 className="st-h3-gap">Şehir</h3><BarList items={list(day.city, 5, (k) => (k === 'bilinmiyor' ? 'Bilinmiyor' : k))} empty="—" /></div>
                              <div><h3>Sayfalar</h3><BarList items={list(day.page, 6, unpathKey)} /><h3 className="st-h3-gap">Aramalar</h3><BarList items={list(day.q, 5)} empty="Arama yok." /></div>
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <p className="st-hint">Kişi bazında kayıt tutulmaz (KVKK: çerez yok, IP saklanmaz); her gün için toplam sayılar ve dağılımlar görünür.</p>
          </div>

          {/* ── Ürünler ── */}
          <div className="card adm-section">
            <h2 className="adm-section-title">En çok bakılan ürünler</h2>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead><tr><th>Ürün</th><th className="num">Görüntüleme</th>{hasUnique && <th className="num">Tekil</th>}<th className="num">Ort. süre</th><th className="num">WhatsApp</th><th className="num">Sepet</th><th className="num">İlgi oranı</th></tr></thead>
                <tbody>
                  {prods.map((p) => (
                    <tr key={p.slug}>
                      <td><a href={`/urun/${p.slug}`} target="_blank" rel="noreferrer"><b>{title(p.slug)}</b></a></td>
                      <td className="num">{fmtInt(p.views)}</td>
                      {hasUnique && <td className="num">{p.unique ? fmtInt(p.unique) : '—'}</td>}
                      <td className="num">{p.avgSec ? formatDuration(p.avgSec) : '—'}</td>
                      <td className="num">{p.wa || '—'}</td>
                      <td className="num">{p.cart || '—'}</td>
                      <td className="num">{p.rate ? fmtShare(p.rate) : '—'}</td>
                    </tr>
                  ))}
                  {prods.length === 0 && <tr><td colSpan={7} className="st-muted">Henüz ürün sayfası görüntülenmedi.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="st-hint">
              <b>Nasıl ölçülür:</b> Görüntüleme = ürün sayfasının her açılışı (aynı kişi yenilerse tekrar sayılır). Tekil = aynı cihazda aynı gün bir kez.
              Botlar, arama motoru tarayıcıları ve sayılmayan cihazlar dahil değildir. İlgi oranı = (WhatsApp + sepete ekleme) ÷ görüntüleme.
            </p>
          </div>

          {/* ── Kaynaklar ── */}
          <div className="card adm-section">
            <h2 className="adm-section-title">Ziyaretçiler nereden geliyor? <span className="st-muted st-h2sub">oturum</span></h2>
            <GroupBar items={sources} />
          </div>
          <div className="st-cols">
            <div className="card adm-section"><h2 className="adm-section-title">Kaynak ayrıntısı</h2><BarList items={list(sum.ref, 12, sourceLabel)} /></div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Yapay zeka asistanları</h2>
              <div className="st-ai">
                {ai.map((x) => <div key={x.name} className={x.value ? 'on' : ''}><span>{x.name}</span><b>{x.value ? fmtInt(x.value) : '—'}</b></div>)}
              </div>
              <p className="st-hint">
                {aiTotal === 0 ? 'Bu aralıkta yapay zeka asistanından gelen ziyaret yok. ' : ''}
                ChatGPT bağlantılara kendi etiketini (utm_source) ekler; diğerleri yalnızca geldikleri site adresini iletir. Uygulamayla açılan bağlantılarda adres hiç iletilmeyebilir; o ziyaretler &quot;Doğrudan&quot;da kalır.
              </p>
            </div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Kampanya etiketleri <span className="st-muted st-h2sub">utm_source</span></h2>
              <BarList items={list(sum.utm, 10, sourceLabel)} empty="Etiketli bağlantıdan gelen yok." />
              <p className="st-hint">Bağlantıya eklenen ?utm_source=… etiketidir (ör. Instagram biyografisi, paylaşım ve reklamlar). Etiketsiz gelenler &quot;Kaynak ayrıntısı&quot;nda.</p>
            </div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Etkileşimler</h2>
              <BarList
                total={0}
                items={[
                  { label: 'WhatsApp tıklaması', value: sum.ev.whatsapp || 0 },
                  { label: 'Sepete ekleme', value: sum.ev.cart_add || 0 },
                  { label: 'Sepet gönderildi', value: sum.ev.cart_send || 0 },
                  { label: 'Blog okuma', value: sum.ev.blog_read || 0 },
                  { label: 'Site içi arama', value: sum.ev.search || 0 },
                  { label: 'Filtre kullanımı', value: sum.ev.filter || 0 },
                ].filter((i) => i.value > 0)}
                empty="Henüz etkileşim yok."
              />
              {topEntries(sum.wasrc, 5).length > 0 && (
                <>
                  <h3 className="st-h3">WhatsApp hangi düğmeden?</h3>
                  <BarList items={topEntries(sum.wasrc, 5).map(([k, v]) => ({ label: WA_SRC[k] ?? k, value: v }))} />
                </>
              )}
            </div>
          </div>

          {/* ── Ziyaretçi profili ── */}
          <div className="st-cols st-cols-3">
            <div className="card adm-section"><h2 className="adm-section-title">Cihaz</h2><BarList items={list(sum.dev)} /></div>
            <div className="card adm-section"><h2 className="adm-section-title">İşletim sistemi</h2><BarList items={list(sum.os)} /></div>
            <div className="card adm-section"><h2 className="adm-section-title">Tarayıcı</h2><BarList items={list(sum.br)} /></div>
          </div>
          <div className="st-cols">
            <div className="card adm-section">
              <h2 className="adm-section-title">Şehir <span className="st-muted st-h2sub">tahmini</span></h2>
              <BarList items={list(sum.city, 12, (k) => (k === 'bilinmiyor' ? 'Bilinmiyor' : k))} empty="Henüz şehir verisi yok." />
              <p className="st-hint">İnternet adresinden tahmin edilir; mobil hatlarda yanıltıcı olabilir. Sunucu konum başlığı iletmiyorsa &quot;Bilinmiyor&quot; görünür.</p>
            </div>
            <div className="card adm-section"><h2 className="adm-section-title">Ülke</h2><BarList items={list(sum.country, 8, countryName)} /></div>
          </div>

          {/* ── İçerik ── */}
          <div className="st-cols st-cols-3">
            <div className="card adm-section"><h2 className="adm-section-title">En çok gezilen sayfalar</h2><BarList items={list(sum.page, 10, unpathKey)} /></div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Blog okuma</h2>
              <BarList items={blogs.map((b) => ({ label: b.slug, value: b.views }))} empty="Henüz blog yazısı okunmadı." />
            </div>
            <div className="card adm-section"><h2 className="adm-section-title">Sitede yapılan aramalar</h2><BarList items={list(sum.q, 12)} empty="Henüz arama yapılmadı." /></div>
          </div>
          <div className="st-cols">
            <div className="card adm-section"><h2 className="adm-section-title">Sonuç bulunamayan aramalar</h2><BarList items={list(sum.qz, 10)} empty="Sonuçsuz arama yok." /></div>
            <div className="card adm-section"><h2 className="adm-section-title">Kullanılan filtreler</h2><BarList items={list(sum.flt, 10)} empty="Henüz filtre kullanılmadı." /></div>
          </div>

          {/* ── Zaman ── */}
          <div className="st-cols">
            <div className="card adm-section"><h2 className="adm-section-title">Günün saatleri</h2><HourBars hours={sum.hr} /></div>
            <div className="card adm-section">
              <h2 className="adm-section-title">Haftanın günleri <span className="st-muted st-h2sub">ortalama ziyaretçi</span></h2>
              <ValueBars points={weekdayAverages(cur).map((w) => ({ label: w.label.slice(0, 3), value: Math.round(w.value * 10) / 10, title: `${w.label}: ort. ${w.value.toFixed(1).replace('.', ',')} ziyaretçi` }))} height={130} />
            </div>
          </div>
        </>
      )}

      <div className="card adm-section">
        <h2 className="adm-section-title">Gizlilik ve bu cihaz</h2>
        <p className="st-muted st-p">
          İstatistikler çerezsiz ve anonim toplanır: IP adresi kaydedilmez, konum izni istenmez. Kendi ziyaretlerinizin sayılmaması için bu cihazı hariç tutabilirsiniz.
        </p>
        <div className="st-device">
          <button className="btn btn-secondary btn-sm" onClick={() => { setNoTrack(!noTrack); setNoTrackState(!noTrack); }}>
            {noTrack ? 'Bu cihazın ziyaretlerini saymaya başla' : 'Bu cihazı sayma'}
          </button>
          <span className="st-muted">{noTrack ? 'Bu cihaz şu an sayılmıyor.' : 'Bu cihaz sayılıyor.'}</span>
        </div>
      </div>
    </>
  );
}
