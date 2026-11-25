'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './muhasebe.css';
import MonthChart from '@/components/admin/finance/MonthChart';
import BarList from '@/components/admin/finance/BarList';
import SaleModal from '@/components/admin/finance/SaleModal';
import ExpensesPanel from '@/components/admin/finance/ExpensesPanel';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { IconEdit, IconPlus, IconTrash } from '@/components/admin/icons';
import { errorMessage, useToast } from '@/components/admin/Toast';
import {
  computeExpenseStats, computeSalesStats, netProfit, periodRange, saleProfit, saleRevenue, type PeriodKind,
} from '@/lib/finance-stats';
import { fmtDate, fmtPct, fmtTL } from '@/lib/finance-format';
import {
  deleteSaleAction, generateRecurringAction, getExpensesAction, getFinanceDataAction, saveSaleAction,
  type PickerProduct,
} from '@/lib/actions-finance';
import type { SaleInput, SaleRecord } from '@/lib/finance-types';
import type { ExpenseRecord } from '@/lib/expense-types';

const PERIODS: [PeriodKind, string][] = [
  ['month', 'Bu ay'], ['last3', 'Son 3 ay'], ['year', 'Bu yıl'], ['all', 'Tümü'],
];

const isoDay = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export default function AccountingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [period, setPeriod] = useState<PeriodKind>('month');
  const [modal, setModal] = useState<{ record?: SaleRecord } | null>(null);
  const [toDelete, setToDelete] = useState<SaleRecord | null>(null);

  const load = useCallback(async () => {
    try {
      // Önce aylık tekrarlayan giderlerin eksik aylarını tamamla, sonra tüm veriyi oku
      await generateRecurringAction().catch(() => 0);
      const d = await getFinanceDataAction();
      setSales(d.sales);
      setExpenses(d.expenses);
      setProducts(d.products);
    } catch (e) {
      toast.error(errorMessage(e, 'Muhasebe verisi yüklenemedi.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const reloadExpenses = async () => { setExpenses(await getExpensesAction()); };

  const [from, to] = useMemo(() => periodRange(period), [period]);
  const monthCount = period === 'year' || period === 'all' ? 12 : 6;
  const stats = useMemo(
    () => computeSalesStats(sales, from, to, monthCount, Date.now(), expenses),
    [sales, expenses, from, to, monthCount],
  );
  const expStats = useMemo(() => computeExpenseStats(expenses, from, to), [expenses, from, to]);
  const net = netProfit(stats.profit, expStats.total);
  const ledger = useMemo(
    () => sales.filter((r) => r.date >= from && r.date < to).sort((a, b) => b.date - a.date),
    [sales, from, to],
  );

  const save = async (data: SaleInput) => {
    const id = await saveSaleAction(data, modal?.record?.id);
    setSales((prev) => (modal?.record ? prev.map((r) => (r.id === id ? { ...r, ...data, id } : r)) : [{ ...data, id }, ...prev]));
    setModal(null);
    toast.success('Satış kaydedildi.');
  };

  const confirmDelete = async () => {
    const r = toDelete;
    setToDelete(null);
    if (!r) return;
    try {
      await deleteSaleAction(r.id);
      setSales((prev) => prev.filter((x) => x.id !== r.id));
      toast.success('Satış silindi.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [['Tür', 'Tarih', 'Ürün / Not', 'Kategori', 'Kanal', 'Müşteri', 'Adet', 'Birim fiyat', 'Birim maliyet', 'Kargo/ek', 'Tutar', 'Kâr']];
    for (const r of ledger) {
      const p = saleProfit(r);
      rows.push(['Satış', isoDay(r.date), r.title, r.category, r.channel, r.customerName ?? '', String(r.qty), String(r.unitPrice), String(r.unitCost ?? ''), String(r.extraCost ?? ''), String(saleRevenue(r)), p === null ? '' : String(p)]);
    }
    for (const e of expenses.filter((x) => x.date >= from && x.date < to)) {
      rows.push(['Gider', isoDay(e.date), e.note ?? '', e.category, '', '', '', '', '', '', String(-e.amountTRY), String(-e.amountTRY)]);
    }
    // Excel'de Türkçe karakterler ve ';' ayracı için BOM ile
    const csv = '﻿' + rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `muhasebe-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const v = (x: string) => (loading ? '—' : x);
  const kpis: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }[] = [
    { label: 'Ciro', value: v(fmtTL(stats.revenue)), sub: v(`${stats.units} adet`) },
    {
      label: 'Brüt kâr',
      value: v(fmtTL(stats.profit)),
      sub: v(stats.cost > 0 ? `marj ${fmtPct(stats.margin, 1)}` : stats.missingCost ? `${stats.missingCost} satırda maliyet yok` : '—'),
      tone: stats.profit > 0 ? 'pos' : stats.profit < 0 ? 'neg' : undefined,
    },
    { label: 'Giderler', value: v(fmtTL(expStats.total)), sub: v(`${expStats.count} kayıt`) },
    {
      label: 'Net kâr',
      value: v(fmtTL(net)),
      sub: v(stats.revenue > 0 ? `net marj ${fmtPct(net / stats.revenue, 1)}` : 'brüt kâr − gider'),
      tone: net > 0 ? 'pos' : net < 0 ? 'neg' : undefined,
    },
    { label: 'Sipariş', value: v(String(stats.orders)), sub: v(`${stats.count} satır`) },
    { label: 'Ortalama sipariş', value: v(fmtTL(stats.avgOrder)) },
    { label: 'Adet', value: v(String(stats.units)), sub: 'kupa / fincan' },
  ];

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Muhasebe</h1>
          <p className="adm-page-sub">Satışlar, kârlılık ve giderler · yalnızca yöneticiler görür</p>
        </div>
        <div className="fin-head-actions">
          <div className="fin-tabs" role="tablist" aria-label="Dönem">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{label}</button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={ledger.length === 0 && expenses.length === 0}>CSV indir</button>
          <button className="btn btn-primary" onClick={() => setModal({})}><IconPlus size={16} /> Satış ekle</button>
        </div>
      </div>

      <div className="fin-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card fin-kpi ${k.tone ?? ''}`}>
            <div className="fin-kpi-label">{k.label}</div>
            <div className="fin-kpi-value">{k.value}</div>
            {k.sub && <div className="fin-kpi-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="fin-grid-2">
        <div className="card adm-section">
          <h2 className="adm-section-title">Aylık ciro, kâr ve gider<span className="fin-sub">son {stats.months.length} ay</span></h2>
          <MonthChart months={stats.months} />
        </div>
        <div className="card adm-section">
          <h2 className="adm-section-title">Kategoriye göre ciro</h2>
          <BarList rows={stats.byCategory} empty="Bu dönemde satış yok." />
        </div>
      </div>

      <div className="fin-grid-2">
        <div className="card adm-section">
          <h2 className="adm-section-title">Kanala göre ciro</h2>
          <BarList rows={stats.byChannel} empty="Bu dönemde satış yok." />
        </div>
        <div className="card adm-section">
          <h2 className="adm-section-title">Gider dağılımı</h2>
          {expStats.byCategory.length === 0 ? (
            <p className="fin-muted">Bu dönemde gider yok.</p>
          ) : (
            <BarList
              rows={expStats.byCategory.map(([name, revenue]) => ({ name, revenue, profit: 0, units: 0, count: 0 }))}
              empty=""
              hideMeta
            />
          )}
        </div>
      </div>

      <ExpensesPanel expenses={expenses} onChange={setExpenses} from={from} to={to} onReload={reloadExpenses} />

      <div className="card adm-section" style={{ padding: 0 }}>
        <div className="fin-panel-head">
          <h2>Satış defteri <span className="fin-sub">{ledger.length} satır</span></h2>
        </div>
        {loading ? (
          <p className="fin-empty">Yükleniyor…</p>
        ) : ledger.length === 0 ? (
          <p className="fin-empty">Bu dönemde satış kaydı yok. &quot;Satış ekle&quot; ile elle kayıt oluşturabilir ya da Makine sayfasında teslim edilen işleri otomatik muhasebeye işleyebilirsiniz.</p>
        ) : (
          <div className="fin-ledger">
            {ledger.map((r) => {
              const p = saleProfit(r);
              return (
                <div key={r.id} className="fin-ledger-row">
                  <div className="fin-ledger-main">
                    <div className="fin-ledger-title">{r.title}</div>
                    <div className="fin-ledger-meta">
                      {fmtDate(r.date)} · {r.category} · {r.channel}{r.customerName ? ` · ${r.customerName}` : ''}
                      {r.orderId && <span className="fin-pill" style={{ marginLeft: 6 }}>iş</span>}
                    </div>
                    {r.note && <div className="fin-ledger-meta">{r.note}</div>}
                  </div>
                  <div className="fin-ledger-nums">
                    <div className="fin-ledger-num"><small>{r.qty} × {fmtTL(r.unitPrice)}</small><strong>{fmtTL(saleRevenue(r))}</strong></div>
                    <div className={`fin-ledger-num ${p === null ? '' : p < 0 ? 'neg' : 'pos'}`}>
                      <small>Kâr</small>
                      {p === null ? <button className="fin-pill warn" onClick={() => setModal({ record: r })}>maliyet gir</button> : <strong>{fmtTL(p)}</strong>}
                    </div>
                  </div>
                  <div className="fin-ledger-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ record: r })} aria-label="Satışı düzenle"><IconEdit size={16} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setToDelete(r)} aria-label="Satışı sil"><IconTrash size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <SaleModal initial={modal.record} products={products} onClose={() => setModal(null)} onSubmit={save} />}

      <ConfirmDialog
        open={toDelete !== null}
        title="Satış silinsin mi?"
        message={toDelete ? `${toDelete.title} · ${fmtTL(saleRevenue(toDelete))} satış kaydı kalıcı olarak silinir.` : undefined}
        confirmLabel="Sil"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
