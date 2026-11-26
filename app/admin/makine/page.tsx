'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './makine.css';
import BarList from '@/components/admin/finance/BarList';
import '../muhasebe/muhasebe.css';
import OrderModal from '@/components/admin/finance/OrderModal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { IconEdit, IconPlus, IconTrash, IconWhatsApp } from '@/components/admin/icons';
import { errorMessage, useToast } from '@/components/admin/Toast';
import {
  deleteOrderAction, getMachineDataAction, refreshMachineAction, saveOrderAction, sendMachineReportAction,
  setOrderStatusAction, settleOrderAction, type MachineData,
} from '@/lib/actions-machine';
import { computeMachine } from '@/lib/machine';
import {
  ACTIVE_STATUSES, ORDER_STATUS_LABELS, isDueToday, isLate, lateDays, nextStatus, orderTitle, orderTotal, orderUnits,
  type Order, type OrderStatus,
} from '@/lib/orders-utils';
import { fmtDate, fmtPct, fmtTL } from '@/lib/finance-format';
import type { OrderEditInput } from '@/lib/orders';

type Filter = 'acik' | OrderStatus | 'tum';
const FILTERS: [Filter, string][] = [
  ['acik', 'Açık işler'], ['yeni', 'Yeni'], ['tasarim', 'Tasarım'], ['baski', 'Baskı'], ['paketleme', 'Paketleme'],
  ['kargoda', 'Kargoda'], ['teslim', 'Teslim'], ['iptal', 'İptal'], ['tum', 'Tümü'],
];

type Confirm = { title: string; message: string; label: string; run: () => Promise<void> } | null;

const waLink = (phone?: string) => {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const full = d.startsWith('90') ? d : d.startsWith('0') ? `9${d}` : `90${d}`;
  return `https://wa.me/${full}`;
};

export default function MachinePage() {
  const toast = useToast();
  const [data, setData] = useState<MachineData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('acik');
  const [modal, setModal] = useState<{ order?: Order } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const d = await getMachineDataAction();
      setData(d);
      setOrders(d.orders);
      setNow(d.now);
    } catch (e) {
      toast.error(errorMessage(e, 'Üretim hattı yüklenemedi.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const m = useMemo(() => computeMachine({ orders, now }), [orders, now]);

  const visible = useMemo(() => {
    const list = filter === 'tum' ? orders
      : filter === 'acik' ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
      : orders.filter((o) => o.status === filter);
    // Açık işlerde en yakın teslim tarihi üstte; kapalılarda en yeni üstte
    return [...list].sort((a, b) => (ACTIVE_STATUSES.includes(a.status) && ACTIVE_STATUSES.includes(b.status) ? a.dueAt - b.dueAt : b.createdAt - a.createdAt));
  }, [orders, filter]);

  const replace = (o: Order) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));

  const advance = async (o: Order, status: OrderStatus) => {
    setBusyId(o.id);
    try {
      replace(await setOrderStatusAction(o.id, status));
      setNow(Date.now());
      toast.success(`${orderTitle(o)}: ${ORDER_STATUS_LABELS[status]}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const settle = async (o: Order) => {
    setBusyId(o.id);
    try {
      const n = await settleOrderAction(o.id);
      replace({ ...o, settled: true });
      toast.success(n > 0 ? `${n} satış satırı muhasebeye işlendi.` : 'Bu iş zaten muhasebede.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const save = async (form: OrderEditInput) => {
    await saveOrderAction(form, modal?.order?.id);
    setModal(null);
    await load();
    toast.success('İş kaydedildi.');
  };

  const runConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try { await c.run(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const askCancel = (o: Order) => setConfirm({
    title: 'İş iptal edilsin mi?', message: `${orderTitle(o)} iptal edilir; muhasebeye işlenmez.`, label: 'İptal et',
    run: async () => { replace(await setOrderStatusAction(o.id, 'iptal')); toast.success('İş iptal edildi.'); },
  });
  const askDelete = (o: Order) => setConfirm({
    title: 'İş silinsin mi?', message: `${orderTitle(o)} kalıcı olarak silinir. Muhasebeye işlenmiş satışlar silinmez.`, label: 'Sil',
    run: async () => { await deleteOrderAction(o.id); setOrders((p) => p.filter((x) => x.id !== o.id)); toast.success('İş silindi.'); },
  });

  const sendReport = async () => {
    try {
      const ok = await sendMachineReportAction();
      if (ok) toast.success('Rapor Telegram’a gönderildi.');
      else toast.error('Telegram bağlı değil (TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID tanımlı olmalı).');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const refresh = async () => {
    try {
      const snap = await refreshMachineAction();
      setData((d) => (d ? { ...d, snapshot: snap } : d));
      toast.success('Günlük özet güncellendi.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const v = (x: string) => (loading ? '—' : x);
  const counts = (f: Filter) =>
    f === 'tum' ? orders.length : f === 'acik' ? m.active : orders.filter((o) => o.status === f).length;

  const kpis: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }[] = [
    { label: 'Açık iş', value: v(String(m.active)), sub: v(`bugün teslim: ${m.dueToday}`) },
    { label: 'Geciken', value: v(String(m.late.length)), sub: 'sözlü tarihi geçti', tone: m.late.length > 0 ? 'neg' : undefined },
    { label: 'Ort. teslim süresi', value: v(m.avgLeadDays === null ? '—' : `${m.avgLeadDays.toFixed(1).replace('.', ',')} gün`), sub: v(`${m.delivered} teslim · ${m.days} gün`) },
    { label: 'Zamanında teslim', value: v(m.onTimePct === null ? '—' : fmtPct(m.onTimePct)), tone: m.onTimePct !== null && m.onTimePct >= 0.9 ? 'pos' : undefined },
    { label: 'Yeni iş', value: v(String(m.created)), sub: v(`${m.cancelled} iptal`) },
    { label: 'Ciro (açılan işler)', value: v(fmtTL(m.revenue)), sub: `son ${m.days} gün` },
  ];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Makine</h1>
          <p className="adm-page-sub">Sipariş, tasarım, baskı, paketleme ve kargo hattı · son {m.days} gün</p>
        </div>
        <div className="mak-head-actions">
          <button className="btn btn-secondary" onClick={sendReport}>Raporu Telegram&apos;a gönder</button>
          <button className="btn btn-secondary" onClick={refresh}>Özeti yenile</button>
          <button className="btn btn-primary" onClick={() => setModal({})}><IconPlus size={16} /> Yeni iş</button>
        </div>
      </div>

      <div className={`card mak-callout${m.constraint.key !== 'belirsiz' ? ' warn' : ''}`}>
        <small>Şu anki durum</small>
        <h2>{v(m.constraint.label)}</h2>
        <p>{v(m.constraint.why)}</p>
      </div>

      <div className="mak-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card mak-kpi ${k.tone ?? ''}`}>
            <div className="mak-kpi-label">{k.label}</div>
            <div className="mak-kpi-value">{k.value}</div>
            {k.sub && <div className="mak-kpi-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="mak-grid-2">
        <div className="card adm-section">
          <h2 className="adm-section-title">Geciken işler</h2>
          {m.late.length === 0 ? (
            <p className="mak-muted">Geciken iş yok.</p>
          ) : (
            <ul className="mak-late-list">
              {m.late.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <span>{l.title}{l.customer ? ` · ${l.customer}` : ''}<span className="mak-muted" style={{ display: 'block' }}>{ORDER_STATUS_LABELS[l.status]}</span></span>
                  <strong>{l.lateDays} gün</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card adm-section">
          <h2 className="adm-section-title">Malzeme tahmini<span className="mak-sub">kupa / fincan adedi</span></h2>
          {m.materials.length === 0 ? (
            <p className="mak-muted">Henüz iş yok.</p>
          ) : (
            <table className="mak-table">
              <thead><tr><th>Kategori</th><th className="num">Baskı bekleyen</th><th className="num">14 gün tahmini</th></tr></thead>
              <tbody>
                {m.materials.map((r) => (
                  <tr key={r.category}><td>{r.category}</td><td className="num">{r.needNow}</td><td className="num">{r.forecast}</td></tr>
                ))}
                <tr><td><strong>Toplam</strong></td><td className="num"><strong>{m.totalNeedNow}</strong></td><td className="num"><strong>{m.totalForecast}</strong></td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mak-grid-2">
        <div className="card adm-section">
          <h2 className="adm-section-title">En çok satan kategoriler</h2>
          <BarList rows={m.topCategories.map((r) => ({ name: r.name, revenue: r.revenue, profit: 0, units: r.qty, count: 0 }))} empty="Henüz veri yok." hideMeta />
        </div>
        <div className="card adm-section">
          <h2 className="adm-section-title">En çok satan ürünler</h2>
          <BarList rows={m.topProducts.map((r) => ({ name: r.name, revenue: r.revenue, profit: 0, units: r.qty, count: 0 }))} empty="Henüz veri yok." hideMeta />
        </div>
      </div>

      <div className="card adm-section" style={{ padding: 0 }}>
        <div className="mak-panel-head">
          <h2>İşler <span className="mak-sub">{visible.length} kayıt</span></h2>
          {m.unsettled > 0 && <span className="mak-badge today">{m.unsettled} teslim iş muhasebeye işlenmedi</span>}
        </div>
        <div className="mak-steps" role="tablist" aria-label="Durum filtresi">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={`mak-step${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>
              {label} <b>{loading ? '' : counts(k)}</b>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mak-empty">Yükleniyor…</p>
        ) : visible.length === 0 ? (
          <p className="mak-empty">Bu durumda iş yok. &quot;Yeni iş&quot; ile elle ekleyebilirsiniz; sepet talepleri otomatik buraya düşer.</p>
        ) : (
          <div className="mak-list">
            {visible.map((o) => {
              const late = isLate(o, now);
              const today = isDueToday(o, now);
              const next = nextStatus(o.status);
              const wa = waLink(o.phone);
              const open = ACTIVE_STATUSES.includes(o.status);
              return (
                <div key={o.id} className="mak-job">
                  <div className="mak-job-main">
                    <div className="mak-job-title">{orderTitle(o)} <span className="mak-badge">{ORDER_STATUS_LABELS[o.status]}</span></div>
                    <div className="mak-job-meta">
                      {o.customerName ?? 'Müşteri adı yok'}{o.phone ? ` · ${o.phone}` : ''} · {o.channel} · {fmtDate(o.createdAt)} açıldı
                      {open && <> · teslim {fmtDate(o.dueAt)}</>}
                    </div>
                    <div className="mak-job-items">
                      {o.items.map((i) => `${i.qty} × ${i.title}${i.color ? ` (${i.color})` : ''}`).join(', ')}
                    </div>
                    {o.note && <div className="mak-job-meta">Not: {o.note}</div>}
                  </div>
                  <div className="mak-job-side">
                    <div>
                      {late && <span className="mak-badge late">{lateDays(o, now)} gün gecikti</span>}
                      {!late && today && <span className="mak-badge today">bugün teslim</span>}
                      {o.status === 'teslim' && o.settled && <span className="mak-badge done">muhasebede</span>}
                      {' '}<strong>{fmtTL(orderTotal(o))}</strong> <span className="mak-muted">· {orderUnits(o)} adet</span>
                    </div>
                    <div className="mak-job-actions">
                      {next && open && (
                        <button className="btn btn-primary btn-sm" disabled={busyId === o.id} onClick={() => advance(o, next)}>{ORDER_STATUS_LABELS[next]}&apos;a geçir</button>
                      )}
                      {o.status === 'teslim' && !o.settled && (
                        <button className="btn btn-primary btn-sm" disabled={busyId === o.id} onClick={() => settle(o)}>Muhasebeye işle</button>
                      )}
                      {wa && <a className="btn btn-secondary btn-sm" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ile yaz"><IconWhatsApp size={16} /></a>}
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ order: o })} aria-label="İşi düzenle"><IconEdit size={16} /></button>
                      {open && <button className="btn btn-secondary btn-sm" onClick={() => askCancel(o)}>İptal</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => askDelete(o)} aria-label="İşi sil"><IconTrash size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mak-muted">
        Haftalık rapor her pazartesi 09:00&apos;dan sonra Telegram&apos;a gider{data && !data.telegram ? ' (şu an Telegram bağlı değil)' : ''}.
        {data?.snapshot && ` Günlük özet: ${new Date(data.snapshot.updatedAt).toLocaleString('tr-TR')}.`}
      </p>

      {modal && <OrderModal initial={modal.order} products={data?.products ?? []} onClose={() => setModal(null)} onSubmit={save} />}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        danger
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
