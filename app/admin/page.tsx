'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getProducts, cloudinaryThumb } from '@/lib/products';
import { Product, CATEGORIES } from '@/types';
import { getActive, getCategory } from '@/lib/product-utils';
import { getFinanceSummaryAction } from '@/lib/actions-finance';
import { getMachineOverviewAction } from '@/lib/actions-machine';
import { getOverviewStatsAction } from '@/lib/actions-analytics';
import { getCartOverviewAction } from '@/lib/actions-cart';
import { getReviewStatsAction } from '@/lib/actions-reviews';
import { getSocialStatusAction } from '@/lib/actions-social';
import type { PlatformStatus } from '@/lib/social-types';
import {
  IconPlus, IconCart, IconCog, IconWallet, IconEye, IconMessage, IconMegaphone, IconPen, IconExternal, IconWhatsApp,
} from '@/components/admin/icons';
import './overview.css';

type Awaited2<T> = T extends Promise<infer U> ? U : T;
type Finance = Awaited2<ReturnType<typeof getFinanceSummaryAction>>;
type Machine = Awaited2<ReturnType<typeof getMachineOverviewAction>>;
type Stats = Awaited2<ReturnType<typeof getOverviewStatsAction>>;
type Cart = Awaited2<ReturnType<typeof getCartOverviewAction>>;
type Reviews = Awaited2<ReturnType<typeof getReviewStatsAction>>;

const tl = (n: number) => `₺${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))}`;
const num = (n: number) => new Intl.NumberFormat('tr-TR').format(n || 0);
const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

const STATUS_LABEL: Record<string, string> = {
  yeni: 'Yeni', tasarim: 'Tasarım', baski: 'Baskı', paketleme: 'Paketleme', kargoda: 'Kargoda', teslim: 'Teslim', iptal: 'İptal',
};

/** Saf SVG çubuk grafik (ek kütüphane yok). */
function Bars({ data, format }: { data: { label: string; value: number; value2?: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.value2 ?? 0)));
  if (data.length === 0) return <p className="adm-empty">Henüz veri yok.</p>;
  return (
    <div className="ov-bars" role="img" aria-label="Grafik">
      {data.map((d) => (
        <div key={d.label} className="ov-bar-col" title={`${d.label}: ${format(d.value)}${d.value2 !== undefined ? ` / ${format(d.value2)}` : ''}`}>
          <div className="ov-bar-track">
            <div className="ov-bar" style={{ height: `${(d.value / max) * 100}%` }} />
            {d.value2 !== undefined && <div className="ov-bar ov-bar-2" style={{ height: `${(Math.max(0, d.value2) / max) * 100}%` }} />}
          </div>
          <span className="ov-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [reviews, setReviews] = useState<Reviews | null>(null);
  const [social, setSocial] = useState<PlatformStatus[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Her modül bağımsız yüklenir: biri hata verse de diğerleri görünür
    Promise.allSettled([
      getProducts(), getFinanceSummaryAction(), getMachineOverviewAction(), getOverviewStatsAction(),
      getCartOverviewAction(), getReviewStatsAction(), getSocialStatusAction(),
    ]).then(([p, f, m, s, c, r, so]) => {
      setProducts(val(p) ?? []);
      setFinance(val(f));
      setMachine(val(m));
      setStats(val(s));
      setCart(val(c));
      setReviews(val(r));
      setSocial(val(so) as PlatformStatus[] | null);
      setLoading(false);
    });
  }, []);

  const total = products.length;
  const active = products.filter((p) => getActive(p)).length;
  const v = (x: string | number | undefined | null) => (loading ? '—' : x ?? '—');

  const thisMonth = finance?.months?.[finance.months.length - 1];
  const openJobs = machine
    ? Object.entries(machine.byStatus).filter(([k]) => k !== 'teslim' && k !== 'iptal').reduce((a, [, n]) => a + n, 0)
    : null;

  const monthBars = useMemo(
    () => (finance?.months ?? []).slice(-6).map((m) => ({ label: m.month.slice(5), value: m.revenue, value2: m.profit })),
    [finance],
  );
  const visitBars = useMemo(
    () => (stats?.series ?? []).slice(-14).map((d) => ({ label: d.day.slice(8), value: d.views })),
    [stats],
  );

  const recent = useMemo(
    () => [...products].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 5),
    [products],
  );

  const actions: { label: string; href: string; count: number | null }[] = [
    { label: 'Yeni sepet talebi', href: '/admin/sepet-talepleri', count: cart?.newCount ?? null },
    { label: 'Geciken iş', href: '/admin/makine', count: machine?.late ?? null },
    { label: 'Bugün teslim edilecek iş', href: '/admin/makine', count: machine?.dueToday ?? null },
    { label: 'Onay bekleyen yorum', href: '/admin/yorumlar', count: reviews?.pending ?? null },
    { label: 'Bağlı olmayan sosyal hesap', href: '/admin/sosyal-medya', count: social ? social.filter((s) => !s.configured).length : null },
  ];

  return (
    <div className="ov">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Genel Bakış</h1>
          <p className="adm-page-sub">Bu ayın özeti, sipariş hattı, trafik ve otomasyon durumu</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary adm-btn-icon-label">
          <IconPlus size={16} /> Yeni Ürün
        </Link>
      </div>

      <nav className="ov-quick" aria-label="Hızlı işlemler">
        <Link href="/admin/sepet-talepleri" className="btn btn-secondary btn-sm adm-btn-icon-label">
          <IconCart size={15} /> Sepet Talepleri {cart && cart.newCount > 0 && <span className="adm-badge">{cart.newCount}</span>}
        </Link>
        <Link href="/admin/makine" className="btn btn-secondary btn-sm adm-btn-icon-label"><IconCog size={15} /> Makine</Link>
        <Link href="/admin/muhasebe" className="btn btn-secondary btn-sm adm-btn-icon-label"><IconWallet size={15} /> Muhasebe</Link>
        <Link href="/admin/blog/new" className="btn btn-secondary btn-sm adm-btn-icon-label"><IconPen size={15} /> Blog Yazısı</Link>
        <Link href="/admin/sosyal-medya" className="btn btn-secondary btn-sm adm-btn-icon-label"><IconMegaphone size={15} /> Sosyal Medya</Link>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm adm-btn-icon-label">Siteyi Gör <IconExternal size={14} /></Link>
      </nav>

      <div className="adm-stat-grid ov-kpis">
        <div className="card adm-stat">
          <div className="adm-stat-value">{v(thisMonth ? tl(thisMonth.revenue) : null)}</div>
          <div className="adm-stat-label">Bu ay ciro</div>
          <div className="ov-kpi-sub">{v(thisMonth ? `brüt kâr ${tl(thisMonth.profit)}` : 'Muhasebe verisi yok')}</div>
        </div>
        <div className="card adm-stat">
          <div className={`adm-stat-value ${finance && finance.netProfit < 0 ? 'ov-neg' : ''}`}>{v(finance ? tl(finance.netProfit) : null)}</div>
          <div className="adm-stat-label">Net kâr (12 ay)</div>
          <div className="ov-kpi-sub">{v(finance ? `${num(finance.orders)} sipariş · ${num(finance.units)} adet` : '')}</div>
        </div>
        <div className="card adm-stat">
          <div className="adm-stat-value">{v(openJobs)}</div>
          <div className="adm-stat-label">Açık iş (makine)</div>
          <div className="ov-kpi-sub">{v(machine ? `${machine.late} geciken · ${machine.dueToday} bugün` : '')}</div>
        </div>
        <div className="card adm-stat">
          <div className="adm-stat-value">{v(stats ? num(stats.last30) : null)}</div>
          <div className="adm-stat-label">Ziyaret (30 gün)</div>
          <div className="ov-kpi-sub">{v(stats ? `bugün ${num(stats.today)} · WhatsApp ${num(stats.whatsappClicks30)}` : '')}</div>
        </div>
      </div>

      <div className="ov-grid-2">
        <section className="card adm-section">
          <h2 className="adm-section-title ov-title-row">
            <span>Son 6 ay ciro / kâr</span>
            <Link href="/admin/muhasebe" className="ov-more">Muhasebe</Link>
          </h2>
          <Bars data={monthBars} format={tl} />
          <div className="ov-legend"><span className="ov-dot" /> Ciro <span className="ov-dot ov-dot-2" /> Brüt kâr</div>
        </section>
        <section className="card adm-section">
          <h2 className="adm-section-title ov-title-row">
            <span>Son 14 gün ziyaret</span>
            <Link href="/admin/istatistik" className="ov-more">İstatistikler</Link>
          </h2>
          <Bars data={visitBars} format={num} />
          {stats && stats.topProducts.length > 0 && (
            <ul className="ov-mini-list">
              {stats.topProducts.slice(0, 3).map((p) => (
                <li key={p.id}><IconEye size={14} /> <span className="ov-ellipsis">{p.title}</span> <strong>{num(p.views)}</strong></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="ov-grid-2">
        <section className="card adm-section">
          <h2 className="adm-section-title">Dikkat / aksiyon</h2>
          <ul className="ov-mini-list">
            {actions.map((a) => (
              <li key={a.label}>
                <span className="ov-ellipsis">{a.label}</span>
                <Link href={a.href} className={`ov-pill ${a.count ? 'ov-pill-warn' : ''}`}>{a.count ?? '—'}</Link>
              </li>
            ))}
          </ul>
          {machine && (
            <div className="ov-status-row" aria-label="İş durumları">
              {Object.entries(machine.byStatus).filter(([k]) => k !== 'iptal').map(([k, n]) => (
                <span key={k} className="ov-chip">{STATUS_LABEL[k] ?? k}: <strong>{n}</strong></span>
              ))}
            </div>
          )}
        </section>

        <section className="card adm-section">
          <h2 className="adm-section-title ov-title-row">
            <span>Son sepet talepleri</span>
            <Link href="/admin/sepet-talepleri" className="ov-more">Tümü</Link>
          </h2>
          {!cart || cart.recent.length === 0 ? (
            <p className="adm-empty">{loading ? 'Yükleniyor…' : 'Henüz sepet talebi yok.'}</p>
          ) : (
            <ul className="ov-mini-list">
              {cart.recent.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <IconWhatsApp size={14} />
                  <span className="ov-ellipsis">{r.name || 'İsimsiz'} · {r.itemCount} ürün</span>
                  <strong>{r.total > 0 ? tl(r.total) : '—'}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="ov-grid-2">
        <section className="card adm-section">
          <h2 className="adm-section-title ov-title-row">
            <span>Sosyal medya otomasyonu</span>
            <Link href="/admin/sosyal-medya" className="ov-more">Merkez</Link>
          </h2>
          {!social ? (
            <p className="adm-empty">{loading ? 'Yükleniyor…' : 'Durum alınamadı.'}</p>
          ) : (
            <div className="ov-status-row">
              {social.map((s) => (
                <span key={s.platform} className={`ov-chip ${s.configured && s.enabled ? 'ov-chip-on' : ''}`}>
                  {s.platform} · {!s.configured ? 'bağlı değil' : s.enabled ? 'açık' : 'kapalı'}
                </span>
              ))}
            </div>
          )}
          <p className="ov-kpi-sub ov-mt">
            <IconMessage size={14} /> Yorum ortalaması: {v(reviews && reviews.approved > 0 ? `${reviews.average.toFixed(1)} / 5 (${reviews.approved})` : 'henüz yok')}
          </p>
        </section>

        <section className="card adm-section">
          <h2 className="adm-section-title">Katalog</h2>
          <div className="ov-status-row">
            <span className="ov-chip">Toplam: <strong>{v(total)}</strong></span>
            <span className="ov-chip">Aktif: <strong>{v(active)}</strong></span>
            <span className="ov-chip">Pasif: <strong>{v(total - active)}</strong></span>
            <span className="ov-chip">Öne çıkan: <strong>{v(products.filter((p) => p.featured).length)}</strong></span>
          </div>
          {!loading && total > 0 && CATEGORIES.map((cat) => {
            const count = products.filter((p) => getCategory(p) === cat).length;
            if (!count) return null;
            return (
              <div key={cat} className="adm-cat-row">
                <span className="adm-cat-name">{cat}</span>
                <div className="adm-cat-bar"><div style={{ width: `${Math.round((count / total) * 100)}%` }} /></div>
                <span className="adm-cat-count">{count}</span>
              </div>
            );
          })}
        </section>
      </div>

      {recent.length > 0 && (
        <section className="card adm-section">
          <h2 className="adm-section-title">Son düzenlenen ürünler</h2>
          <ul className="adm-recent-list">
            {recent.map((p) => (
              <li key={p.id} className="adm-recent-item">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cloudinaryThumb(p.images[0])} alt="" className="adm-recent-thumb" />
                ) : (
                  <div className="adm-recent-thumb" />
                )}
                <div className="adm-recent-main">
                  <Link href={`/admin/products/${p.id}`} className="adm-recent-title">{p.title}</Link>
                  <div className="adm-recent-meta">{getActive(p) ? 'Aktif' : 'Pasif'} · {getCategory(p)}</div>
                </div>
                <Link href={`/admin/products/${p.id}`} className="btn btn-secondary btn-sm">Düzenle</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
