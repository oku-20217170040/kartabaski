'use client';

import { useState } from 'react';
import { CATEGORIES } from '@/types';
import { SALE_CHANNELS, type SaleChannel } from '@/lib/finance-types';
import { fmtTL, fromDateInput, toDateInput } from '@/lib/finance-format';
import { orderTotal, type Order, type OrderItem } from '@/lib/orders-utils';
import type { PickerProduct } from '@/lib/actions-finance';
import type { OrderEditInput } from '@/lib/orders';
import { IconPlus, IconTrash } from '@/components/admin/icons';

interface Props {
  initial?: Order;
  products: PickerProduct[];
  onClose: () => void;
  onSubmit: (data: OrderEditInput) => Promise<void>;
}

interface Row { productId: string; title: string; category: string; qty: string; unitPrice: string; unitCost: string; color: string; note: string }

const blank = (): Row => ({ productId: '', title: '', category: CATEGORIES[0], qty: '1', unitPrice: '', unitCost: '', color: '', note: '' });
const toRow = (i: OrderItem): Row => ({
  productId: i.productId ?? '', title: i.title, category: i.category ?? CATEGORIES[0], qty: String(i.qty), unitPrice: String(i.unitPrice),
  unitCost: typeof i.unitCost === 'number' ? String(i.unitCost) : '', color: i.color ?? '', note: i.note ?? '',
});

/** Üretim hattına elle iş ekleme / düzenleme penceresi (WhatsApp, Instagram, elden siparişler). */
export default function OrderModal({ initial, products, onClose, onSubmit }: Props) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [channel, setChannel] = useState<SaleChannel>(initial?.channel ?? 'WhatsApp');
  const [note, setNote] = useState(initial?.note ?? '');
  const [extraCost, setExtraCost] = useState(initial?.extraCost ? String(initial.extraCost) : '');
  const [due, setDue] = useState(initial ? toDateInput(initial.dueAt) : '');
  const [rows, setRows] = useState<Row[]>(initial?.items.length ? initial.items.map(toRow) : [blank()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const pick = (i: number, id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) { patch(i, { productId: '' }); return; }
    patch(i, { productId: id, title: p.title, category: p.category, unitPrice: rows[i].unitPrice || String(p.priceMin) });
  };

  const items: OrderItem[] = rows.map((r) => ({
    title: r.title.trim(),
    category: r.category,
    qty: Number(r.qty),
    unitPrice: Number(r.unitPrice),
    ...(r.unitCost.trim() !== '' ? { unitCost: Number(r.unitCost) } : {}),
    ...(r.productId ? { productId: r.productId } : {}),
    ...(r.color.trim() ? { color: r.color.trim() } : {}),
    ...(r.note.trim() ? { note: r.note.trim() } : {}),
  }));
  const valid = items.length > 0 && items.every((i) =>
    i.title !== '' && Number.isInteger(i.qty) && i.qty >= 1 && Number.isFinite(i.unitPrice) && i.unitPrice >= 0 && (i.unitCost == null || (Number.isFinite(i.unitCost) && i.unitCost >= 0)));
  const extra = extraCost.trim() === '' ? 0 : Number(extraCost);

  const submit = async () => {
    if (!valid || !Number.isFinite(extra) || extra < 0) { setError('Her kalem için ürün adı, adet ve birim fiyatı doldurun.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        items,
        channel,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(extra > 0 ? { extraCost: Math.round(extra) } : {}),
        ...(due ? { dueAt: fromDateInput(due) } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal mak-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="İş">
        <h3 className="adm-modal-title">{initial ? 'İşi düzenle' : 'Yeni iş'}</h3>

        <div className="mak-modal-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="mak-cust">Müşteri</label>
            <input id="mak-cust" className="form-input" value={customerName} maxLength={120} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mak-phone">Telefon</label>
            <input id="mak-phone" className="form-input" type="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mak-channel">Kanal</label>
            <select id="mak-channel" className="form-select" value={channel} onChange={(e) => setChannel(e.target.value as SaleChannel)}>
              {SALE_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mak-due">Teslim tarihi {initial ? '' : '(boşsa ürün süresinden)'}</label>
            <input id="mak-due" className="form-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>

        {rows.map((r, i) => (
          <div key={i} className="mak-item">
            <div className="mak-item-head">
              <span>Kalem {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} aria-label="Kalemi sil"><IconTrash size={16} /></button>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={`mak-p-${i}`}>Ürün</label>
              <select id={`mak-p-${i}`} className="form-select" value={r.productId} onChange={(e) => pick(i, e.target.value)}>
                <option value="">Katalogdan seç veya aşağıya yaz</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="mak-item-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor={`mak-t-${i}`}>Başlık</label>
                <input id={`mak-t-${i}`} className="form-input" value={r.title} maxLength={200} onChange={(e) => patch(i, { title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-q-${i}`}>Adet</label>
                <input id={`mak-q-${i}`} className="form-input" type="number" inputMode="numeric" min={1} value={r.qty} onChange={(e) => patch(i, { qty: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-u-${i}`}>Birim fiyat (₺)</label>
                <input id={`mak-u-${i}`} className="form-input" type="number" inputMode="decimal" min={0} value={r.unitPrice} onChange={(e) => patch(i, { unitPrice: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-c-${i}`}>Birim maliyet (₺)</label>
                <input id={`mak-c-${i}`} className="form-input" type="number" inputMode="decimal" min={0} value={r.unitCost} onChange={(e) => patch(i, { unitCost: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-cat-${i}`}>Kategori</label>
                <select id={`mak-cat-${i}`} className="form-select" value={r.category} onChange={(e) => patch(i, { category: e.target.value })}>
                  {(CATEGORIES.includes(r.category as (typeof CATEGORIES)[number]) ? CATEGORIES : [r.category, ...CATEGORIES]).map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-col-${i}`}>Renk</label>
                <input id={`mak-col-${i}`} className="form-input" value={r.color} maxLength={60} onChange={(e) => patch(i, { color: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={`mak-n-${i}`}>Kalem notu</label>
                <input id={`mak-n-${i}`} className="form-input" value={r.note} maxLength={300} onChange={(e) => patch(i, { note: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows((r) => [...r, blank()])} style={{ marginBottom: 14 }}><IconPlus size={16} /> Kalem ekle</button>

        <div className="mak-modal-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="mak-extra">Kargo / ek maliyet (₺)</label>
            <input id="mak-extra" className="form-input" type="number" inputMode="decimal" min={0} value={extraCost} onChange={(e) => setExtraCost(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mak-note">İş notu</label>
            <input id="mak-note" className="form-input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {valid && <p className="mak-muted">Toplam {fmtTL(orderTotal({ items }))}</p>}
        {error && <div className="mak-error">{error}</div>}

        <div className="adm-modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Vazgeç</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Kaydediliyor…' : initial ? 'Güncelle' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  );
}
