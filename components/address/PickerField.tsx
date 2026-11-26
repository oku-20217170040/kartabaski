'use client';

import { useEffect, useRef, useState } from 'react';
import { filterOptions } from '@/lib/address';
import { CloseIcon, SearchIcon } from '@/components/icons';

export interface PickerOption { value: string; label: string; hint?: string }

interface Props {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: PickerOption[];
  onPick: (option: PickerOption) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Listede olmayan değeri elle yazma seçeneği. */
  onCustom?: () => void;
  invalid?: boolean;
  describedBy?: string;
}

/** Aranabilir seçim alanı: telefonda alttan açılan, bilgisayarda ortada duran liste. */
export default function PickerField({ id, label, value, placeholder, options, onPick, disabled, loading, onCustom, invalid, describedBy }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = open ? filterOptions(options, query) : [];

  useEffect(() => {
    const el = dialog.current;
    if (!open || !el || el.open) return;
    el.showModal();
    search.current?.focus();
  }, [open]);

  const close = () => dialog.current?.close();
  const pick = (option: PickerOption) => { onPick(option); close(); };

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('[data-option]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
    if (next < 0) search.current?.focus();
    else items[Math.min(next, items.length - 1)]?.focus();
  };

  return (
    <div className="adr-field">
      <span className="cart-label" id={`${id}-etiket`}>{label}</span>
      <button
        type="button"
        id={id}
        className={`adr-trigger${value ? '' : ' is-empty'}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-labelledby={`${id}-etiket ${id}`}
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => { setQuery(''); setOpen(true); }}
      >
        <span>{loading ? 'Yükleniyor…' : value || placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <dialog ref={dialog} className="adr-dialog" aria-label={label} onClose={() => setOpen(false)} onKeyDown={move}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="adr-sheet">
            <div className="adr-head">
              <b>{label} seçin</b>
              <button type="button" onClick={close} aria-label="Kapat"><CloseIcon /></button>
            </div>
            <div className="adr-search">
              <SearchIcon size={18} />
              <input
                ref={search}
                type="search"
                value={query}
                placeholder={`${label} ara`}
                aria-label={`${label} ara`}
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (shown[0]) pick(shown[0]); } }}
              />
            </div>
            <p className="adr-count" role="status">{shown.length ? `${shown.length} sonuç` : 'Eşleşen yok'}</p>
            <ul className="adr-list">
              {shown.map((o) => (
                <li key={o.value}>
                  <button type="button" data-option aria-current={o.label === value ? 'true' : undefined} onClick={() => pick(o)}>
                    <span>{o.label}</span>
                    {o.hint && <small>{o.hint}</small>}
                  </button>
                </li>
              ))}
            </ul>
            {onCustom && (
              <button type="button" className="adr-custom" onClick={() => { onCustom(); close(); }}>Listede yok, elle yazacağım</button>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
