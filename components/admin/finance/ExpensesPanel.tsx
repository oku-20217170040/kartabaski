'use client';

import { useEffect, useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRecord } from '@/lib/expense-types';
import {
  saveExpenseAction, deleteExpenseAction, getRecurringAction, saveRecurringAction, deleteRecurringAction,
} from '@/lib/actions-finance';
import type { RecurringExpense } from '@/lib/recurring';
import { fmtTL, fmtDate, toDateInput, fromDateInput } from '@/lib/finance-format';
import { computeExpenseStats } from '@/lib/finance-stats';
import { errorMessage, useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { IconEdit, IconTrash } from '@/components/admin/icons';

interface Props {
  expenses: ExpenseRecord[];
  onChange: (next: ExpenseRecord[]) => void;
  from: number;
  to: number;
  /** Tekrarlayan şablon kaydedilince otomatik oluşan giderleri yeniden yükler */
  onReload: () => Promise<void>;
}

type Pending = { title: string; message: string; run: () => Promise<void> } | null;

/** Giderler: hızlı ekleme, seçili dönemin dökümü ve aylık tekrarlayan şablonlar. */
export default function ExpensesPanel({ expenses, onChange, from, to, onReload }: Props) {
  const toast = useToast();
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [category, setCategory] = useState<ExpenseCategory>('Boş kupa / fincan');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expEditId, setExpEditId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const thisMonth = toDateInput(Date.now()).slice(0, 7);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [rCat, setRCat] = useState<ExpenseCategory>('Kira');
  const [rAmount, setRAmount] = useState('');
  const [rDay, setRDay] = useState('1');
  const [rStart, setRStart] = useState(thisMonth);
  const [rNote, setRNote] = useState('');
  const [rBusy, setRBusy] = useState(false);
  const [rError, setRError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { getRecurringAction().then(setRecurring).catch(() => {}); }, []);

  const stats = useMemo(() => computeExpenseStats(expenses, from, to), [expenses, from, to]);
  const list = useMemo(
    () => expenses.filter((e) => e.date >= from && e.date < to).sort((a, b) => b.date - a.date),
    [expenses, from, to],
  );

  const resetRecurringForm = () => {
    setEditId(null); setRCat('Kira'); setRAmount(''); setRDay('1'); setRStart(thisMonth); setRNote(''); setRError('');
  };

  const startEdit = (t: RecurringExpense) => {
    setEditId(t.id); setRCat(t.category); setRAmount(String(t.amountTRY)); setRDay(String(t.dayOfMonth));
    setRStart(t.startMonth); setRNote(t.note ?? ''); setRError('');
  };

  const addRecurring = async () => {
    const n = Number(rAmount);
    const day = Number(rDay);
    if (!Number.isFinite(n) || n <= 0) { setRError('Geçerli bir tutar girin.'); return; }
    if (!Number.isInteger(day) || day < 1 || day > 31) { setRError('Gün 1 ile 31 arasında olmalı.'); return; }
    setRBusy(true);
    setRError('');
    try {
      const current = editId ? recurring.find((x) => x.id === editId) : undefined;
      await saveRecurringAction(
        { category: rCat, amountTRY: Math.round(n), dayOfMonth: day, startMonth: rStart, active: current ? current.active : true, ...(rNote.trim() ? { note: rNote.trim() } : {}) },
        editId ?? undefined,
      );
      setRecurring(await getRecurringAction());
      await onReload();
      resetRecurringForm();
      toast.success('Aylık gider şablonu kaydedildi.');
    } catch (e) {
      setRError(errorMessage(e, 'Kaydedilemedi.'));
    } finally {
      setRBusy(false);
    }
  };

  const toggleRecurring = async (t: RecurringExpense) => {
    try {
      const { id, ...rest } = t;
      await saveRecurringAction({ ...rest, active: !t.active }, id);
      setRecurring(await getRecurringAction());
      await onReload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const removeRecurring = (t: RecurringExpense) =>
    setPending({
      title: 'Şablon silinsin mi?',
      message: `${t.category} · ${fmtTL(t.amountTRY)} aylık gider şablonu silinir. Şimdiye kadar oluşan giderler muhasebede kalır.`,
      run: async () => {
        await deleteRecurringAction(t.id);
        setRecurring((r) => r.filter((x) => x.id !== t.id));
        if (editId === t.id) resetRecurringForm();
      },
    });

  const resetForm = () => {
    setExpEditId(null); setDate(toDateInput(Date.now())); setCategory('Boş kupa / fincan'); setAmount(''); setNote(''); setError('');
  };

  const startEditExpense = (e: ExpenseRecord) => {
    setExpEditId(e.id); setDate(toDateInput(e.date)); setCategory(e.category); setAmount(String(e.amountTRY)); setNote(e.note ?? ''); setError('');
  };

  const add = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setError('Geçerli bir tutar girin.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = { date: fromDateInput(date), category, amountTRY: Math.round(n), note: note.trim() };
      if (expEditId) {
        await saveExpenseAction(data, expEditId);
        onChange(expenses.map((x) => (x.id === expEditId ? { ...x, ...data } : x)));
      } else {
        const id = await saveExpenseAction(data);
        onChange([{ id, ...data }, ...expenses]);
      }
      resetForm();
      toast.success('Gider kaydedildi.');
    } catch (e) {
      setError(errorMessage(e, 'Kaydedilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (e: ExpenseRecord) =>
    setPending({
      title: 'Gider silinsin mi?',
      message: `${e.category} · ${fmtTL(e.amountTRY)} gider kaydı silinir.`,
      run: async () => {
        await deleteExpenseAction(e.id);
        onChange(expenses.filter((x) => x.id !== e.id));
        if (expEditId === e.id) resetForm();
      },
    });

  const confirmPending = async () => {
    const p = pending;
    setPending(null);
    if (!p) return;
    try { await p.run(); toast.success('Silindi.'); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="card adm-section" style={{ padding: 0 }}>
      <div className="fin-panel-head">
        <h2>Giderler <span className="fin-sub">{fmtTL(stats.total)} · {stats.count} kayıt</span></h2>
      </div>

      {expEditId && <p className="fin-hint" style={{ padding: '0 20px' }}>Gider kaydını düzenliyorsun. Değişiklikleri yapıp &quot;Güncelle&quot;ye bas.</p>}
      <div className="fin-form">
        <input className="form-input" type="date" value={date} max={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value)} aria-label="Tarih" />
        <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} aria-label="Kategori">
          {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="form-input" type="number" inputMode="decimal" placeholder="Tutar ₺" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} aria-label="Tutar" />
        <input className="form-input" placeholder="Not (isteğe bağlı)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} aria-label="Not" />
        <div className="fin-form-actions">
          <button className="btn btn-primary" onClick={add} disabled={busy}>{busy ? '…' : expEditId ? 'Güncelle' : 'Ekle'}</button>
          {expEditId && <button className="btn btn-secondary" onClick={resetForm} disabled={busy}>Vazgeç</button>}
        </div>
      </div>
      {error && <div className="fin-error" style={{ padding: '0 20px 10px', marginTop: 0 }}>{error}</div>}

      {stats.byCategory.length > 0 && (
        <div className="fin-chips">
          {stats.byCategory.map(([cat, sum]) => <span key={cat} className="fin-pill">{cat} · {fmtTL(sum)}</span>)}
        </div>
      )}

      {list.length === 0 ? (
        <p className="fin-empty">Bu dönemde gider kaydı yok. Boş kupa, süblimasyon kağıdı, mürekkep, kargo gibi giderleri yukarıdan ekleyin.</p>
      ) : (
        <div className="fin-ledger">
          {list.map((e) => (
            <div key={e.id} className="fin-ledger-row">
              <div className="fin-ledger-main">
                <div className="fin-ledger-title">
                  {e.category}
                  {e.recurringId && <span className="fin-pill" style={{ marginLeft: 8 }} title="Aylık şablondan otomatik eklendi">otomatik</span>}
                </div>
                <div className="fin-ledger-meta">{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ''}</div>
              </div>
              <div className="fin-ledger-nums">
                <div className="fin-ledger-num neg"><strong>{fmtTL(e.amountTRY)}</strong></div>
              </div>
              <div className="fin-ledger-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => startEditExpense(e)} aria-label="Gideri düzenle"><IconEdit size={16} /></button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(e)} aria-label="Gideri sil"><IconTrash size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fin-rec">
        <h3>Aylık tekrarlayan giderler</h3>
        <p className="fin-muted">Kira, internet gibi her ay aynı olan giderleri bir kez tanımla; her ayın seçtiğin gününde otomatik eklenir. Başlangıç ayı geçmişteyse eksik aylar da tamamlanır.</p>
        {editId && <p className="fin-hint">Şablonu düzenliyorsun. Değişiklik yalnızca henüz oluşmamış aylara uygulanır.</p>}
        <div className="fin-form" style={{ padding: '12px 0 0' }}>
          <select className="form-select" value={rCat} onChange={(e) => setRCat(e.target.value as ExpenseCategory)} aria-label="Kategori">
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="form-input" type="number" inputMode="decimal" placeholder="Aylık tutar ₺" value={rAmount} onChange={(e) => setRAmount(e.target.value)} aria-label="Aylık tutar" />
          <input className="form-input" type="number" inputMode="numeric" min={1} max={31} value={rDay} onChange={(e) => setRDay(e.target.value)} aria-label="Ayın günü" title="Ayın kaçıncı günü" />
          <input className="form-input" type="month" value={rStart} onChange={(e) => setRStart(e.target.value)} aria-label="Başlangıç ayı" />
          <input className="form-input" placeholder="Not (isteğe bağlı)" value={rNote} maxLength={200} onChange={(e) => setRNote(e.target.value)} aria-label="Not" />
          <div className="fin-form-actions">
            <button className="btn btn-secondary" onClick={addRecurring} disabled={rBusy}>{rBusy ? '…' : editId ? 'Güncelle' : 'Tanımla'}</button>
            {editId && <button className="btn btn-secondary" onClick={resetRecurringForm} disabled={rBusy}>Vazgeç</button>}
          </div>
        </div>
        {rError && <div className="fin-error">{rError}</div>}

        {recurring.length > 0 && (
          <ul className="fin-rec-list">
            {recurring.map((t) => (
              <li key={t.id} className={`${t.active ? '' : 'off'} ${editId === t.id ? 'editing' : ''}`}>
                <span>
                  <strong>{t.category}</strong> · {fmtTL(t.amountTRY)}
                  <span className="fin-muted" style={{ display: 'block' }}>
                    Her ayın {t.dayOfMonth}. günü · {t.startMonth} ayından beri{t.note ? ` · ${t.note}` : ''}{!t.active && ' · durduruldu'}
                  </span>
                </span>
                <span className="fin-ledger-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => startEdit(t)}>Düzenle</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleRecurring(t)}>{t.active ? 'Durdur' : 'Sürdür'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeRecurring(t)}>Sil</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message}
        confirmLabel="Sil"
        danger
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
