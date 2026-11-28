'use client';

import Link from 'next/link';
import { IBack, IClose } from './ikonlar';

/** Stüdyonun ortak parçaları: üst çubuk, simge menüsü ve panel. Yerleşim `studyo.css`'te. */

export function UstCubuk({ back, title, subtitle, children }: { back: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <header className="std-top">
      <Link className="std-icon-btn" href={back} aria-label="Geri dön" title="Geri dön"><IBack /></Link>
      <div className="std-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="std-top-actions">{children}</div>
    </header>
  );
}

export interface MenuItem<T extends string> { id: T; label: string; icon: React.ReactNode }

/** Masaüstünde sol şerit, telefonda alt çubuk. */
export function Menu<T extends string>({ items, active, onPick, label }: { items: MenuItem<T>[]; active: T | null; onPick: (id: T) => void; label: string }) {
  return (
    <nav className="std-rail" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} type="button" className="std-tool" aria-pressed={active === item.id} onClick={() => onPick(item.id)}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Panel({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => void; children: React.ReactNode }) {
  return (
    <section className="std-panel" aria-label={title}>
      <div className="std-panel-head">
        {onBack && <button type="button" className="std-icon-btn" onClick={onBack} aria-label="Geri"><IBack /></button>}
        <h2>{title}</h2>
        <button type="button" className="std-icon-btn std-panel-close" onClick={onClose} aria-label="Paneli kapat"><IClose /></button>
      </div>
      {/* Anahtar: panel değişince kaydırma başa döner. */}
      <div className="std-panel-body" key={title}>{children}</div>
    </section>
  );
}
