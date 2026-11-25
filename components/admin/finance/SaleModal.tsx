'use client';

import { useState } from 'react';
import { CATEGORIES } from '@/types';
import { SALE_CHANNELS, type SaleChannel, type SaleInput, type SaleRecord } from '@/lib/finance-types';
import { fmtTL, fromDateInput, toDateInput } from '@/lib/finance-format';
import { saleProfit } from '@/lib/finance-stats';
import type { PickerProduct } from '@/lib/actions-finance';

interface Props {
  initial?: SaleRecord;
  products: PickerProduct[];
  onClose: () => void;
  onSubmit: (data: SaleInput) => Promise<void>;
}

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Satış defteri satırı ekleme / düzenleme penceresi. */
export default function SaleModal({ initial, products, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(toDateInput(initial?.date ?? Date.now()));
  const [productId, setProductId] = useState(initial?.productId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [qty, setQty] = useState(String(initial?.qty ?? 1));
  const [unitPrice, setUnitPrice] = useState(initial ? String(initial.unitPrice) : '');
  const [unitCost, setUnitCost] = useState(typeof initial?.unitCost === 'number' ? String(initial.unitCost) : '');
  const [extraCost, setExtraCost] = useState(initial?.extraCost ? String(initial.extraCost) : '');
  const [channel, setChannel] = useState<SaleChannel>(initial?.channel ?? 'WhatsApp');
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pick = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setTitle(p.title);
    setCategory(p.category);
    if (!unitPrice) setUnitPrice(String(p.priceMin));
  };

  const q = Number(qty);
  const price = num(unitPrice);
  const cost = num(unitCost);
  const extra = num(extraCost) ?? 0;
  const valid = title.trim() !== '' && Number.isInteger(q) && q >= 1 && price !== null && Number.isFinite(price) && price >= 0
    && (cost === null || (Number.isFinite(cost) && cost >= 0)) && Number.isFinite(extra) && extra >= 0;

  const preview = valid
    ? saleProfit({ id: '', date: 0, title, category, qty: q, unitPrice: price as number, unitCost: cost, extraCost: extra, channel })
    : null;

  const submit = async () => {
    if (!valid) { setError('Ürün adı, adet ve birim fiyatı kontrol edin.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        date: fromDateInput(date),
        title: title.trim(),
        category,
        qty: q,
        unitPrice: Math.round(price as number),
        unitCost: cost === null ? null : Math.round(cost),
        ...(extra > 0 ? { extraCost: Math.round(extra) } : {}),
        channel,
        ...(productId ? { productId } : {}),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(initial?.orderId ? { orderId: initial.orderId } : {}),
        ...(initial?.sepetTalebiId ? { sepetTalebiId: initial.sepetTalebiId } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  const categories = CATEGORIES.includes(category as (typeof CATEGORIES)[number]) ? CATEGORIES : [category, ...CATEGORIES];

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal fin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Satış kaydı">
        <h3 className="adm-modal-title">{initial ? 'Satışı düzenle' : 'Satış ekle'}</h3>

        <div className="fin-modal-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="fin-date">Tarih</label>
            <input id="fin-date" className="form-input" type="date" value={date} max={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-channel">Kanal</label>
            <select id="fin-channel" className="form-select" value={channel} onChange={(e) => setChannel(e.target.value as SaleChannel)}>
              {SALE_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group fin-full">
            <label className="form-label" htmlFor="fin-product">Ürün (isteğe bağlı)</label>
            <select id="fin-product" className="form-select" value={productId} onChange={(e) => pick(e.target.value)}>
              <option value="">Katalogdan seç veya aşağıya yaz</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-title">Başlık</label>
            <input id="fin-title" className="form-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-cat">Kategori</label>
            <select id="fin-cat" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fin-qty">Adet</label>
            <input id="fin-qty" className="form-input" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-price">Birim satış fiyatı (₺)</label>
            <input id="fin-price" className="form-input" type="number" inputMode="decimal" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-cost">Birim maliyet (₺)</label>
            <input id="fin-cost" className="form-input" type="number" inputMode="decimal" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="boş: kâr hesaplanmaz" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-extra">Kargo / ek maliyet (₺)</label>
            <input id="fin-extra" className="form-input" type="number" inputMode="decimal" min={0} value={extraCost} onChange={(e) => setExtraCost(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fin-cust">Müşteri (isteğe bağlı)</label>
            <input id="fin-cust" className="form-input" value={customerName} maxLength={120} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fin-note">Not (isteğe bağlı)</label>
            <input id="fin-note" className="form-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {valid && (
          <div className={`fin-profit${preview !== null && preview < 0 ? ' neg' : ''}`}>
            Tutar {fmtTL(q * (price as number))}
            {preview !== null ? <> · kâr <strong>{fmtTL(preview)}</strong></> : ' · maliyet girilmediği için kâr hesaplanmaz'}
          </div>
        )}
        {error && <div className="fin-error">{error}</div>}

        <div className="adm-modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Vazgeç</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !valid}>{saving ? 'Kaydediliyor…' : initial ? 'Güncelle' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  );
}
